import "../src/config/env.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDatabase, mongoose } from "../src/config/database.js";
import { MongoRepository, auditMigrationKey, modelByFile, toDocument } from "../src/repositories/MongoRepository.js";
import { normalizeCustomerPhone } from "../src/utils/customerValidation.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(scriptDirectory, "../data");
const files = [
  "users.json", "customers.json", "customerCredentials.json", "products.json",
  "suppliers.json", "sales.json", "payments.json", "expenses.json", "income.json",
  "supplierInvoices.json", "supplierPayments.json", "stockMovements.json",
  "budgets.json", "auditLogs.json", "settings.json"
];
const dryRun = process.argv.includes("--dry-run");
const missingSourceFiles = new Set();

function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).filter(key => key !== "_id" && key !== "__v" && key !== "migrationKey")
      .sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function sameSourceFields(existing, source) {
  const actual = stable(existing);
  const expected = stable(source);
  return Object.entries(expected).every(([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value));
}

function prepareRecord(file, record) {
  const value = JSON.parse(JSON.stringify(record));
  if (file === "settings.json") {
    value.demoData = false;
    delete value.illustrativeMonthlySummaries;
  }
  if (file === "customers.json") {
    const email = String(value.email || "").trim().toLowerCase();
    if (email) value.email = email;
    else delete value.email;
    const phoneKey = normalizeCustomerPhone(value.phone);
    if (phoneKey) value.phoneKey = phoneKey;
  }
  if (file === "customerCredentials.json") {
    value.phoneLookup = normalizeCustomerPhone(value.phoneLookup);
  }
  if (file === "sales.json") {
    const missingFinancialFields = [];
    if (!Number.isSafeInteger(value.totalMinor) || value.totalMinor < 0) {
      missingFinancialFields.push("totalMinor");
    }
    (value.items || []).forEach((item, index) => {
      if (!Number.isSafeInteger(item.unitPriceMinor) || item.unitPriceMinor < 0) {
        missingFinancialFields.push(`items.${index}.unitPriceMinor`);
      }
    });
    value.financialCompleteness = missingFinancialFields.length ? "Incomplete" : "Complete";
    value.missingFinancialFields = missingFinancialFields;
  }
  return value;
}

async function loadSource(file) {
  try {
    const content = (await fs.readFile(path.join(dataDirectory, file), "utf8")).replace(/^\uFEFF/, "");
    const data = JSON.parse(content);
    if (file === "settings.json") {
      if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("expected a settings object");
      return [data];
    }
    if (!Array.isArray(data)) throw new Error("expected a JSON array");
    return data;
  } catch (error) {
    if (error.code === "ENOENT" && file === "supplierPayments.json") {
      missingSourceFiles.add(file);
      return [];
    }
    throw new Error(`${file}: ${error.message}`);
  }
}

function validateRelationships(sources) {
  const ids = file => new Set((sources.get(file) || []).map(record => Number(record.id)));
  const customers = ids("customers.json");
  const products = ids("products.json");
  const users = ids("users.json");
  const suppliers = ids("suppliers.json");
  const sales = ids("sales.json");
  const failures = [];

  for (const product of sources.get("products.json") || []) {
    if (product.supplierId != null && !suppliers.has(Number(product.supplierId))) {
      failures.push(`product ${product.id} references missing supplier`);
    }
  }
  for (const credential of sources.get("customerCredentials.json") || []) {
    if (!customers.has(Number(credential.customerId))) failures.push(`customer credential references missing customer ${credential.customerId}`);
  }
  for (const sale of sources.get("sales.json") || []) {
    if (sale.customerId != null && !customers.has(Number(sale.customerId))) failures.push(`sale ${sale.id} references missing customer`);
    if (sale.cashierUserId != null && !users.has(Number(sale.cashierUserId))) failures.push(`sale ${sale.id} references missing employee`);
    for (const item of sale.items || []) {
      const productId = Number(item.productId ?? item[0]);
      if (!products.has(productId)) failures.push(`sale ${sale.id} references missing product ${productId}`);
    }
  }
  for (const movement of sources.get("stockMovements.json") || []) {
    if (!products.has(Number(movement.productId))) failures.push(`stock movement ${movement.id} references missing product`);
    if (movement.userId != null && !users.has(Number(movement.userId))) failures.push(`stock movement ${movement.id} references missing employee`);
    if (movement.saleId != null && !sales.has(Number(movement.saleId))) failures.push(`stock movement ${movement.id} references missing sale`);
  }
  for (const invoice of sources.get("supplierInvoices.json") || []) {
    if (!suppliers.has(Number(invoice.supplierId))) failures.push(`supplier invoice ${invoice.id} references missing supplier`);
  }
  for (const payment of sources.get("supplierPayments.json") || []) {
    if (!suppliers.has(Number(payment.supplierId))) failures.push(`supplier payment ${payment.id} references missing supplier`);
    if (payment.invoiceId != null && !(sources.get("supplierInvoices.json") || []).some(invoice =>
      Number(invoice.id) === Number(payment.invoiceId))) {
      failures.push(`supplier payment ${payment.id} references missing invoice`);
    }
  }
  for (const payment of sources.get("payments.json") || []) {
    if (payment.saleId != null && !sales.has(Number(payment.saleId))) failures.push(`payment ${payment.id} references missing sale`);
  }
  return failures;
}

function uniqueSourceKeys(file, record) {
  const keys = [];
  const add = (name, value) => {
    if (value !== undefined && value !== null && value !== "") keys.push([name, String(value)]);
  };
  if (file === "users.json") add("username", String(record.username || "").toLowerCase());
  if (file === "customers.json") {
    add("customerId", record.customerId);
    add("phoneKey", record.phoneKey);
    add("email", String(record.email || "").trim().toLowerCase());
  }
  if (file === "customerCredentials.json") {
    add("customerId", record.customerId);
    add("phoneLookup", record.phoneLookup);
  }
  if (file === "products.json") add("sku", record.sku);
  if (file === "suppliers.json") add("name", record.name);
  if (file === "supplierInvoices.json") add("supplierId+invoiceNumber", `${record.supplierId}|${record.invoiceNumber}`);
  if (file === "supplierPayments.json") add("reference", record.reference);
  if (file === "budgets.json") add("period+category", `${record.period}|${record.category}`);
  if (file === "auditLogs.json") add("migrationKey", auditMigrationKey(record));
  return keys;
}

async function validateSources(sources) {
  const report = {};
  const problems = [];
  for (const file of files) {
    const records = sources.get(file);
    const model = modelByFile[file];
    const seenIds = new Map();
    const seenUniqueKeys = new Map();
    let exactDuplicates = 0;
    let duplicateIdConflicts = 0;
    let uniqueKeyConflicts = 0;
    let validationFailures = 0;
    const unmodeledFields = new Set();
    const legacyIdCounts = new Map();

    for (const raw of records) {
      const record = prepareRecord(file, raw);
      if (record.id !== undefined && record.id !== null) {
        const legacyId = String(record.id);
        legacyIdCounts.set(legacyId, (legacyIdCounts.get(legacyId) || 0) + 1);
      }
      if (file !== "settings.json") {
        const knownFields = new Set(Object.keys(model.schema.paths));
        for (const key of Object.keys(record)) {
          if (key !== "id" && !knownFields.has(key)) unmodeledFields.add(key);
        }
      }
      const recordHash = auditMigrationKey(record);
      const identity = file === "settings.json"
        ? "main"
        : file === "auditLogs.json"
          ? recordHash
          : String(record.id);

      if (seenIds.has(identity)) {
        if (seenIds.get(identity) === recordHash) exactDuplicates++;
        else {
          duplicateIdConflicts++;
          problems.push(`${file} contains conflicting records with the same migration ID`);
        }
        continue;
      }
      seenIds.set(identity, recordHash);

      for (const [field, key] of uniqueSourceKeys(file, record)) {
        const uniqueKey = `${field}:${key}`;
        if (seenUniqueKeys.has(uniqueKey)) {
          uniqueKeyConflicts++;
          problems.push(`${file} contains a duplicate value for unique field ${field}`);
        } else {
          seenUniqueKeys.set(uniqueKey, true);
        }
      }

      try {
        await new model(toDocument(record, model)).validate();
      } catch (error) {
        validationFailures++;
        const paths = Object.keys(error.errors || {});
        problems.push(`${file} record ${record.id ?? "(settings)"} failed schema validation${paths.length ? ` (${paths.join(", ")})` : ""}`);
      }
    }

    report[file] = {
      sourcePresent: !missingSourceFiles.has(file),
      sourceRecords: records.length,
      expectedImports: records.length - exactDuplicates,
      exactDuplicatesToSkip: exactDuplicates,
      duplicateIdConflicts,
      uniqueKeyConflicts,
      schemaValidationFailures: validationFailures,
      repeatedLegacyIdRows: [...legacyIdCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
      preservedUnmodeledFields: [...unmodeledFields].sort(),
      settingsAdjustments: file === "settings.json"
        ? ["demoData set to false", "illustrativeMonthlySummaries excluded from active settings"]
        : []
    };
  }
  return { report, problems };
}

async function migrateFile(file, source) {
  const model = modelByFile[file];
  const counts = { imported: 0, skipped: 0, failed: 0 };
  const problems = [];
  const seen = new Map();

  for (const raw of source) {
    const record = prepareRecord(file, raw);
    try {
      if (file === "settings.json") {
        const existing = await model.findById("main").lean();
        if (existing) {
          if (sameSourceFields(existing.value, record)) counts.skipped++;
          else {
            counts.failed++;
            problems.push("settings already exist with different values; no overwrite was attempted");
          }
          continue;
        }
        await model.create({ _id: "main", value: record });
        counts.imported++;
        continue;
      }

      const migrationKey = file === "auditLogs.json" ? auditMigrationKey(record) : null;
      const duplicateKey = migrationKey || String(record.id);
      if (seen.has(duplicateKey)) {
        if (seen.get(duplicateKey) === auditMigrationKey(record)) counts.skipped++;
        else {
          counts.failed++;
          problems.push(`conflicting source records share migration ID ${record.id}`);
        }
        continue;
      }
      seen.set(duplicateKey, auditMigrationKey(record));

      const existing = file === "auditLogs.json"
        ? await model.findOne({ migrationKey }).lean()
        : await new MongoRepository(file).findById(record.id);
      if (existing) {
        if (file === "auditLogs.json" || sameSourceFields(existing, record)) counts.skipped++;
        else {
          counts.failed++;
          problems.push(`record ID ${record.id} already exists with different data; no overwrite was attempted`);
        }
        continue;
      }

      const repository = new MongoRepository(file);
      await repository.insert(record);
      counts.imported++;
    } catch (error) {
      counts.failed++;
      problems.push(`record ${record.id ?? "(settings)"} failed validation or insertion (${error.name || "DatabaseError"})`);
    }
  }
  return { ...counts, problems };
}

async function verifyFile(file, source) {
  const model = modelByFile[file];
  if (file === "settings.json") {
    const current = await model.findById("main").lean();
    return Boolean(current && sameSourceFields(current.value, prepareRecord(file, source[0] || {})));
  }
  for (const raw of source) {
    const record = prepareRecord(file, raw);
    const current = file === "auditLogs.json"
      ? await model.findOne({ migrationKey: auditMigrationKey(record) }).lean()
      : await new MongoRepository(file).findById(record.id);
    if (!current) return false;
    if (file !== "auditLogs.json" && !sameSourceFields(current, record)) return false;
  }
  return true;
}

async function main() {
  const sources = new Map();
  for (const file of files) sources.set(file, await loadSource(file));

  const relationshipFailures = validateRelationships(sources);
  const sourceValidation = await validateSources(sources);
  const preflightProblems = [...relationshipFailures, ...sourceValidation.problems];
  if (dryRun || preflightProblems.length) {
    console.log(JSON.stringify({
      mode: dryRun ? "dry-run" : "migration-preflight",
      atlasQueried: false,
      atlasWrites: 0,
      backupsRead: false,
      source: sourceValidation.report,
      relationshipFailures,
      sourceValidationProblems: sourceValidation.problems
    }, null, 2));
    if (preflightProblems.length) process.exitCode = 1;
    return;
  }

  await connectDatabase();
  const report = {};
  for (const file of files) {
    report[file] = await migrateFile(file, sources.get(file));
  }

  const verification = {};
  for (const file of files) {
    const model = modelByFile[file];
    const count = await model.countDocuments({});
    verification[file] = {
      expected: file === "settings.json" ? Math.min(sources.get(file).length, 1) : sources.get(file).length,
      databaseCount: count,
      sourcePresent: await verifyFile(file, sources.get(file))
    };
  }

  console.log(JSON.stringify({ records: report, verification, relationshipFailures }, null, 2));
  const hasMigrationFailures = Object.values(report).some(result => result.failed > 0) ||
    relationshipFailures.length > 0 ||
    Object.values(verification).some(result => !result.sourcePresent);
  if (hasMigrationFailures) process.exitCode = 1;
}

main()
  .catch(error => {
    console.error(`Migration stopped: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
