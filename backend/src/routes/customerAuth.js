import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { MongoRepository } from "../repositories/MongoRepository.js";
import { findDuplicateCustomer, normalizeCustomerPhone, validateCustomerDetails } from "../utils/customerValidation.js";
import { getJwtSecret } from "../config/jwt.js";

const router = Router();
const customers = new MongoRepository("customers.json");
const credentials = new MongoRepository("customerCredentials.json");
const auditLogs = new MongoRepository("auditLogs.json");
const settings = new MongoRepository("settings.json");
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
let registrationQueue = Promise.resolve();

function issueCustomerToken(customer) {
  const user = {
    role: "Customer",
    customerId: customer.id,
    customerCode: customer.customerId,
    name: customer.name,
    phone: customer.phone
  };
  const token = jwt.sign(user, getJwtSecret(), { expiresIn: "8h" });
  return { token, customer: user };
}

router.post("/register", authLimiter, async (req, res, next) => {
  let release;
  const previous = registrationQueue;
  registrationQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    const validationError = validateCustomerDetails(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const password = String(req.body.password || "");
    if (password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: "Password must be between 10 and 128 characters" });
    }

    const [customerRecords, credentialRecords, settingsRecords] = await Promise.all([
      customers.read(), credentials.read(), settings.read()
    ]);
    const duplicate = findDuplicateCustomer(customerRecords, req.body);
    if (duplicate) return res.status(409).json({ error: "A customer with that phone number or email already exists" });

    const settingsData = settingsRecords[0] || {};
    const storedNextId = Number(settingsData.customerIdNext);
    const id = Math.max(
      customers.nextId(customerRecords),
      Number.isSafeInteger(storedNextId) && storedNextId > 0 ? storedNextId : 1
    );
    settingsData.customerIdNext = id + 1;
    const customer = {
      id,
      customerId: `CUST-${String(id).padStart(5, "0")}`,
      name: String(req.body.name).trim(),
      phone: String(req.body.phone).trim(),
      email: String(req.body.email || "").trim().toLowerCase(),
      address: String(req.body.address || "").trim(),
      registeredAt: new Date().toISOString(),
      status: "Active",
      active: true,
      notes: "",
      points: 0
    };
    if (!customer.email) delete customer.email;
    const phoneKey = normalizeCustomerPhone(customer.phone);
    customer.phoneKey = phoneKey || undefined;
    const credential = {
      id: credentials.nextId(credentialRecords),
      customerId: id,
      phoneLookup: normalizeCustomerPhone(customer.phone),
      passwordHash: await bcrypt.hash(password, 12),
      createdAt: new Date().toISOString()
    };
    const audit = await auditLogs.read();
    const auditEntry = {
      id: auditLogs.nextId(audit),
      userId: id,
      username: customer.customerId,
      action: "CUSTOMER_ACCOUNT_REGISTERED",
      recordType: "customer",
      recordId: id,
      timestamp: new Date().toISOString(),
      details: { customerId: customer.customerId, approvalRequired: false }
    };

    customerRecords.push(customer);
    await MongoRepository.writeAtomically([
      [customers, customerRecords],
      [credentials, [...credentialRecords, credential]],
      [auditLogs, [...audit, auditEntry]],
      [settings, [settingsData]]
    ]);
    res.status(201).json(issueCustomerToken(customer));
  } catch (error) { next(error); }
  finally { release(); }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const phoneLookup = normalizeCustomerPhone(req.body.phone);
    const password = String(req.body.password || "");
    if (phoneLookup.length < 7 || !password) {
      return res.status(400).json({ error: "Enter your registered phone number and password" });
    }
    const [customerRecords, credentialRecords] = await Promise.all([customers.read(), credentials.read()]);
    const credential = credentialRecords.find(record => record.phoneLookup === phoneLookup);
    const customer = credential && customerRecords.find(record => record.id === credential.customerId);
    if (!credential || !customer || !customer.active || customer.status !== "Active" ||
      !(await bcrypt.compare(password, credential.passwordHash))) {
      return res.status(401).json({ error: "Invalid customer credentials or inactive customer account" });
    }
    res.json(issueCustomerToken(customer));
  } catch (error) { next(error); }
});

export default router;
