import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { MongoRepository } from "../repositories/MongoRepository.js";
import { normalizeCustomerPhone, findDuplicateCustomer, validateCustomerDetails } from "../utils/customerValidation.js";
import { getCustomerPurchaseHistory } from "../services/customerPurchases.js";

const router = Router();
router.use(authenticate);

const customers = new MongoRepository("customers.json");
const auditLogs = new MongoRepository("auditLogs.json");
const readRoles = ["System Administrator", "Finance Manager", "Accountant", "Cashier", "Auditor"];
const writeRoles = ["System Administrator", "Finance Manager", "Accountant", "Cashier"];
const statusRoles = ["System Administrator", "Finance Manager"];

function hasRole(user, roles) {
  return roles.includes(user.role);
}

async function writeCustomerAndAudit(records, user, action, customer) {
  const logs = await auditLogs.read();
  logs.push({
    id: auditLogs.nextId(logs),
    userId: user.id,
    username: user.username,
    action,
    recordType: "customer",
    recordId: customer.id,
    timestamp: new Date().toISOString(),
    details: { customerId: customer.customerId }
  });
  await MongoRepository.writeAtomically([[customers, records], [auditLogs, logs]]);
}

router.get("/", async (req, res, next) => {
  try {
    if (!hasRole(req.user, readRoles)) return res.status(403).json({ error: "Employee access required" });
    const query = String(req.query.search || "").trim().toLowerCase();
    let records = await customers.read();
    records = records.filter(customer => !customer.isWalkIn);
    if (query) {
      records = records.filter(customer =>
        [customer.customerId, customer.name, customer.phone, customer.email]
          .some(value => String(value || "").toLowerCase().includes(query)));
    }
    res.json({ data: records });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    if (!hasRole(req.user, writeRoles)) return res.status(403).json({ error: "You do not have permission to register customers" });
    const validationError = validateCustomerDetails(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const records = await customers.read();
    const phone = normalizeCustomerPhone(req.body.phone);
    const email = String(req.body.email || "").trim().toLowerCase();
    const duplicate = findDuplicateCustomer(records, { phone, email });
    if (duplicate) return res.status(409).json({ error: "A customer with that phone number or email already exists" });

    const id = customers.nextId(records);
    const customer = {
      id,
      customerId: `CUST-${String(id).padStart(5, "0")}`,
      name: String(req.body.name).trim(),
      phone: String(req.body.phone).trim(),
      email: email || undefined,
      phoneKey: phone || undefined,
      address: String(req.body.address || "").trim(),
      registeredAt: new Date().toISOString(),
      status: req.body.status || "Active",
      active: (req.body.status || "Active") === "Active",
      notes: String(req.body.notes || "").trim(),
      points: 0
    };
    records.push(customer);
    await writeCustomerAndAudit(records, req.user, "CUSTOMER_REGISTERED", customer);
    res.status(201).json({ data: customer });
  } catch (error) { next(error); }
});

router.get("/:id/purchases", async (req, res, next) => {
  try {
    if (!hasRole(req.user, readRoles)) return res.status(403).json({ error: "Employee access required" });
    const customer = (await customers.read()).find(record =>
      String(record.id) === req.params.id || record.customerId === req.params.id);
    if (!customer || customer.isWalkIn) return res.status(404).json({ error: "Customer not found" });
    const history = await getCustomerPurchaseHistory(customer);
    const { passwordHash, ...safeCustomer } = history.customer;
    res.json({ data: { ...history, customer: safeCustomer } });
  } catch (error) { next(error); }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!hasRole(req.user, readRoles)) return res.status(403).json({ error: "Employee access required" });
    const customer = (await customers.read()).find(record =>
      String(record.id) === req.params.id || record.customerId === req.params.id);
    if (!customer || customer.isWalkIn) return res.status(404).json({ error: "Customer not found" });
    res.json({ data: customer });
  } catch (error) { next(error); }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!hasRole(req.user, writeRoles)) return res.status(403).json({ error: "You do not have permission to update customers" });
    const validationError = validateCustomerDetails(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const records = await customers.read();
    const index = records.findIndex(record => String(record.id) === req.params.id && !record.isWalkIn);
    if (index < 0) return res.status(404).json({ error: "Customer not found" });
    const phone = normalizeCustomerPhone(req.body.phone);
    const email = String(req.body.email || "").trim().toLowerCase();
    const duplicate = findDuplicateCustomer(records, { phone, email }, records[index].id);
    if (duplicate) return res.status(409).json({ error: "A customer with that phone number or email already exists" });
    const updated = {
      ...records[index],
      name: String(req.body.name).trim(),
      phone: String(req.body.phone).trim(),
      email: email || undefined,
      phoneKey: phone || undefined,
      address: String(req.body.address || "").trim(),
      notes: String(req.body.notes || "").trim()
    };
    records[index] = updated;
    await writeCustomerAndAudit(records, req.user, "CUSTOMER_UPDATED", updated);
    res.json({ data: updated });
  } catch (error) { next(error); }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    if (!hasRole(req.user, statusRoles)) return res.status(403).json({ error: "Only administrators and finance managers may change customer status" });
    if (!["Active", "Inactive"].includes(req.body.status)) {
      return res.status(400).json({ error: "Status must be Active or Inactive" });
    }
    const records = await customers.read();
    const customer = records.find(record => String(record.id) === req.params.id && !record.isWalkIn);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    customer.status = req.body.status;
    customer.active = req.body.status === "Active";
    await writeCustomerAndAudit(records, req.user, "CUSTOMER_STATUS_CHANGED", customer);
    res.json({ data: customer });
  } catch (error) { next(error); }
});

export default router;
