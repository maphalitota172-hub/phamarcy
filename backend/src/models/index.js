import mongoose from "mongoose";

const { Schema } = mongoose;
const roles = ["System Administrator", "Finance Manager", "Accountant", "Cashier", "Auditor"];
const statuses = ["Draft", "Pending approval", "Pending Approval", "Approved", "Rejected", "Paid", "Active", "Inactive", "Completed", "Refunded"];
const paymentMethods = ["Cash", "Card", "Mobile Money", "Credit Card", "E-wallet", "M-Pesa", "EcoCash", "Other"];

function createNumericModel(name, collection, fields, indexes = []) {
  const schema = new Schema({
    _id: { type: Number, required: true },
    ...fields
  }, { strict: false, versionKey: false, minimize: false });
  for (const index of indexes) schema.index(index.fields, index.options);
  return mongoose.models[name] || mongoose.model(name, schema, collection);
}

export const User = createNumericModel("FisUser", "users", {
  name: { type: String, required: true, trim: true, maxlength: 100 },
  username: { type: String, required: true, trim: true, maxlength: 30 },
  role: { type: String, required: true, enum: roles },
  accountStatus: { type: String, enum: ["Active", "Pending approval"] },
  active: { type: Boolean, default: true },
  passwordHash: { type: String, required: true }
}, [
  { fields: { username: 1 }, options: { unique: true, collation: { locale: "en", strength: 2 } } }
]);

export const Customer = createNumericModel("FisCustomer", "customers", {
  customerId: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, default: "" },
  phoneKey: { type: String },
  email: { type: String, lowercase: true, trim: true },
  address: { type: String, maxlength: 300 },
  registeredAt: { type: Date, default: null },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  active: { type: Boolean, default: true },
  isWalkIn: { type: Boolean, default: false },
  notes: { type: String, maxlength: 1000 },
  points: { type: Number, min: 0, default: 0 }
}, [
  { fields: { customerId: 1 }, options: { unique: true } },
  { fields: { phoneKey: 1 }, options: { unique: true, sparse: true } },
  { fields: { email: 1 }, options: { unique: true, partialFilterExpression: { email: { $type: "string", $gt: "" } } } }
]);

export const CustomerCredential = createNumericModel("FisCustomerCredential", "customerCredentials", {
  customerId: { type: Number, required: true, ref: "FisCustomer" },
  phoneLookup: { type: String, required: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, [
  { fields: { customerId: 1 }, options: { unique: true } },
  { fields: { phoneLookup: 1 }, options: { unique: true } }
]);

export const Product = createNumericModel("FisProduct", "products", {
  sku: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, default: "" },
  priceMinor: { type: Number, required: true, min: 0 },
  costMinor: { type: Number, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  reorder: { type: Number, min: 0, default: 0 },
  supplierId: { type: Number, ref: "FisSupplier" },
  status: { type: String, default: "Active" }
}, [
  { fields: { sku: 1 }, options: { unique: true } }
]);

const SaleItem = new Schema({
  productId: { type: Number, required: true, ref: "FisProduct" },
  quantity: { type: Number, required: true, min: 1 },
  unitPriceMinor: { type: Number, min: 0 }
}, { _id: false, strict: false });

const SalePayment = new Schema({
  method: { type: String, enum: paymentMethods, required: true },
  amountMinor: { type: Number, required: true, min: 1 }
}, { _id: false, strict: false });

export const Sale = createNumericModel("FisSale", "sales", {
  date: { type: String, required: true },
  createdAt: { type: Date },
  customerId: { type: Number, ref: "FisCustomer", default: null },
  customer: { type: String, default: "Walk-in" },
  walkIn: { type: Boolean },
  cashier: { type: String },
  cashierUserId: { type: Number, ref: "FisUser" },
  items: { type: [SaleItem], required: true },
  totalMinor: { type: Number, min: 0 },
  financialCompleteness: { type: String, enum: ["Complete", "Incomplete"] },
  missingFinancialFields: { type: [String] },
  payments: { type: [SalePayment], default: [] },
  status: { type: String, enum: ["Completed", "Refunded", "Pending"], default: "Completed" }
}, [
  { fields: { customerId: 1, date: -1 }, options: {} },
  { fields: { cashierUserId: 1, date: -1 }, options: {} }
]);

export const Payment = createNumericModel("FisPayment", "payments", {
  saleId: { type: Number, ref: "FisSale" },
  method: { type: String, enum: paymentMethods, required: true },
  amountMinor: { type: Number, required: true, min: 1 },
  date: { type: Date },
  recordedBy: { type: Number, ref: "FisUser" }
}, [
  { fields: { saleId: 1 }, options: {} }
]);

export const PaymentRequest = createNumericModel("FisPaymentRequest", "paymentRequests", {
  provider: { type: String, enum: ["M-Pesa", "EcoCash"], required: true },
  phone: { type: String, required: true },
  amountMinor: { type: Number, required: true, min: 1 },
  currency: { type: String, default: "LSL" },
  reference: { type: String },
  description: { type: String, default: "" },
  status: { type: String, enum: ["pending", "confirmed", "failed", "cancelled"], default: "pending" },
  mode: { type: String, enum: ["live", "sandbox"], default: "sandbox" },
  providerRef: { type: String },
  saleId: { type: Number, default: null },
  initiatedBy: { type: Number, default: null },
  initiatedByType: { type: String, default: null },
  message: { type: String, default: "" },
  failureReason: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, [
  { fields: { providerRef: 1 }, options: { unique: true, partialFilterExpression: { providerRef: { $type: "string" } } } },
  { fields: { status: 1 }, options: {} }
]);

export const Expense = createNumericModel("FisExpense", "expenses", {
  date: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, default: "" },
  amountMinor: { type: Number, required: true, min: 0 },
  status: { type: String, enum: statuses, default: "Pending approval" },
  approvedBy: { type: String },
  receiptReference: { type: String },
  recordedBy: { type: Number, ref: "FisUser" }
}, [
  { fields: { date: -1, category: 1 }, options: {} }
]);

export const Income = createNumericModel("FisIncome", "income", {
  date: { type: String, required: true },
  category: { type: String, required: true },
  reference: { type: String },
  paymentMethod: { type: String },
  amountMinor: { type: Number, required: true, min: 0 },
  status: { type: String, default: "Posted" },
  description: { type: String, default: "" },
  recordedBy: { type: Number, ref: "FisUser" }
}, [
  { fields: { date: -1, category: 1 }, options: {} }
]);

export const Supplier = createNumericModel("FisSupplier", "suppliers", {
  name: { type: String, required: true, trim: true },
  contact: { type: String },
  phone: { type: String },
  terms: { type: String },
  balanceMinor: { type: Number, min: 0, default: 0 },
  active: { type: Boolean, default: true }
}, [
  { fields: { name: 1 }, options: { unique: true } }
]);

export const SupplierInvoice = createNumericModel("FisSupplierInvoice", "supplierInvoices", {
  supplierId: { type: Number, ref: "FisSupplier", required: true },
  invoiceNumber: { type: String, required: true },
  date: { type: String, required: true },
  dueDate: { type: String },
  amountMinor: { type: Number, required: true, min: 0 },
  status: { type: String, enum: statuses, default: "Pending approval" }
}, [
  { fields: { supplierId: 1, invoiceNumber: 1 }, options: { unique: true } }
]);

export const SupplierPayment = createNumericModel("FisSupplierPayment", "supplierPayments", {
  supplierId: { type: Number, ref: "FisSupplier", required: true },
  invoiceId: { type: Number, ref: "FisSupplierInvoice" },
  amountMinor: { type: Number, required: true, min: 1 },
  method: { type: String, enum: paymentMethods },
  reference: { type: String },
  date: { type: String, required: true },
  recordedBy: { type: Number, ref: "FisUser" }
}, [
  { fields: { supplierId: 1, date: -1 }, options: {} },
  { fields: { reference: 1 }, options: { sparse: true, unique: true } }
]);

export const StockMovement = createNumericModel("FisStockMovement", "stockMovements", {
  date: { type: String, required: true },
  productId: { type: Number, required: true, ref: "FisProduct" },
  quantityChange: { type: Number, required: true },
  reason: { type: String, required: true },
  saleId: { type: Number, ref: "FisSale" },
  userId: { type: Number, ref: "FisUser" }
}, [
  { fields: { productId: 1, date: -1 }, options: {} }
]);

export const Budget = createNumericModel("FisBudget", "budgets", {
  period: { type: String, required: true },
  category: { type: String, required: true },
  budgetMinor: { type: Number, required: true, min: 0 },
  status: { type: String, default: "Active" }
}, [
  { fields: { period: 1, category: 1 }, options: { unique: true } }
]);

const auditSchema = new Schema({
  id: { type: Number, required: true },
  migrationKey: { type: String, required: true, unique: true },
  userId: { type: Number },
  username: { type: String },
  action: { type: String, required: true },
  recordType: { type: String, required: true },
  recordId: { type: Schema.Types.Mixed },
  timestamp: { type: Date, required: true },
  details: { type: Schema.Types.Mixed, default: {} }
}, { strict: false, versionKey: false, minimize: false });
auditSchema.index({ timestamp: -1 });
export const AuditLog = mongoose.models.FisAuditLog || mongoose.model("FisAuditLog", auditSchema, "auditLogs");

const settingsSchema = new Schema({
  _id: { type: String, default: "main" },
  value: { type: Schema.Types.Mixed, required: true }
}, { versionKey: false, minimize: false });
export const Settings = mongoose.models.FisSettings || mongoose.model("FisSettings", settingsSchema, "settings");

