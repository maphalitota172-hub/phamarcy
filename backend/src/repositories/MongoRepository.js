import crypto from "node:crypto";
import {
  AuditLog, Budget, Customer, CustomerCredential, Expense, Income, Payment, PaymentRequest, Product,
  Sale, Settings, StockMovement, Supplier, SupplierInvoice, SupplierPayment, User
} from "../models/index.js";
import { mongoose } from "../config/database.js";

const modelByFile = {
  "users.json": User,
  "customers.json": Customer,
  "customerCredentials.json": CustomerCredential,
  "products.json": Product,
  "sales.json": Sale,
  "payments.json": Payment,
  "paymentRequests.json": PaymentRequest,
  "expenses.json": Expense,
  "income.json": Income,
  "suppliers.json": Supplier,
  "supplierInvoices.json": SupplierInvoice,
  "supplierPayments.json": SupplierPayment,
  "stockMovements.json": StockMovement,
  "budgets.json": Budget,
  "auditLogs.json": AuditLog,
  "settings.json": Settings
};

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function auditMigrationKey(record) {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(record))).digest("hex");
}

function fromDocument(document, model) {
  const { _id, __v, ...record } = document;
  if (model === AuditLog) return record;
  return { ...record, id: _id };
}

function toDocument(record, model) {
  const { id, _id, __v, ...fields } = record;
  if (model === AuditLog) {
    return { ...fields, id, migrationKey: record.migrationKey || auditMigrationKey(record) };
  }
  if (model === Settings) return { _id: "main", value: record };
  return { ...fields, _id: Number(id ?? _id) };
}

export class MongoRepository {
  constructor(fileName) {
    this.fileName = fileName;
    this.model = modelByFile[fileName];
    if (!this.model) throw new Error(`No MongoDB model registered for ${fileName}`);
  }

  async read({ session } = {}) {
    if (this.model === Settings) {
      const record = await Settings.findById("main").session(session || null).lean();
      return record ? [record.value] : [];
    }
    let query = this.model.find({}).sort({ _id: 1 });
    if (session) query = query.session(session);
    const records = await query.lean();
    return records.map(record => fromDocument(record, this.model));
  }

  async findById(id) {
    if (this.model === AuditLog || this.model === Settings) throw new Error(`${this.fileName} does not use numeric record IDs`);
    const record = await this.model.findById(Number(id)).lean();
    return record ? fromDocument(record, this.model) : null;
  }

  async findOne(filter) {
    const record = await this.model.findOne(filter).lean();
    return record ? fromDocument(record, this.model) : null;
  }

  async insert(record, { session } = {}) {
    const document = toDocument(record, this.model);
    const options = session ? { session } : {};
    const [created] = await this.model.create([document], options);
    return fromDocument(created.toObject(), this.model);
  }

  async updateById(id, changes, { session } = {}) {
    if (this.model === AuditLog || this.model === Settings) throw new Error(`${this.fileName} does not support numeric record updates`);
    const { id: ignoredId, _id: ignoredMongoId, ...update } = changes;
    let query = this.model.findByIdAndUpdate(
      Number(id),
      { $set: update },
      { new: true, runValidators: true, session }
    );
    const document = await query.lean();
    return document ? fromDocument(document, this.model) : null;
  }

  async write(records) {
    return MongoRepository.writeAtomically([[this, records]]);
  }

  async replace(records, session) {
    if (this.model === Settings) {
      const value = records[0] || {};
      await Settings.replaceOne({ _id: "main" }, { _id: "main", value }, { upsert: true, session });
      return;
    }
    await this.model.deleteMany({}, { session });
    if (!records.length) return;
    const documents = records.map(record => toDocument(record, this.model));
    const keys = new Set();
    const deduplicated = documents.filter(document => {
      if (this.model === AuditLog) {
        if (keys.has(document.migrationKey)) return false;
        keys.add(document.migrationKey);
      }
      return true;
    });
    await this.model.insertMany(deduplicated, { session, ordered: true });
  }

  nextId(records) {
    return records.reduce((highest, record) => Math.max(highest, Number(record.id) || 0), 0) + 1;
  }

  static async writeAtomically(entries) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const [repository, records] of entries) {
          await repository.replace(records, session);
        }
      });
    } finally {
      await session.endSession();
    }
  }
}

export { modelByFile, auditMigrationKey, toDocument };
