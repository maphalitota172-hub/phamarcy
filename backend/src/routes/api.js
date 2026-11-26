import { Router } from "express";
import { authenticateEmployee } from "../middleware/auth.js";
import { MongoRepository } from "../repositories/MongoRepository.js";

const router = Router();
router.use(authenticateEmployee);

const repositories = {
  users: new MongoRepository("users.json"),
  suppliers: new MongoRepository("suppliers.json"),
  products: new MongoRepository("products.json"),
  sales: new MongoRepository("sales.json"),
  income: new MongoRepository("income.json"),
  expenses: new MongoRepository("expenses.json"),
  payments: new MongoRepository("payments.json"),
  budgets: new MongoRepository("budgets.json"),
  supplierInvoices: new MongoRepository("supplierInvoices.json"),
  supplierPayments: new MongoRepository("supplierPayments.json"),
  stockMovements: new MongoRepository("stockMovements.json"),
  "audit-logs": new MongoRepository("auditLogs.json")
};

function validateIdentity(req, res, requiredRole) {
  if (!requiredRole) return true;
  return requiredRole.includes(req.user.role);
}

for (const [resource, repository] of Object.entries(repositories)) {
  router.get(`/${resource}`, async (req, res, next) => {
    try {
      let records = await repository.read();
      if (resource === "users") {
        const canViewUsers = ["System Administrator", "Finance Manager"].includes(req.user.role);
        if (!canViewUsers) return res.status(403).json({ error: "You do not have permission to view users" });
        records = records.map(({ passwordHash, ...safeUser }) => safeUser);
      }
      const search = String(req.query.search || "").trim().toLowerCase();
      if (search) records = records.filter(record =>
        Object.values(record).some(value => typeof value === "string" && value.toLowerCase().includes(search)));
      res.json({ data: records });
    } catch (error) { next(error); }
  });

  router.post(`/${resource}`, async (req, res, next) => {
    try {
      if (resource === "users") return res.status(403).json({ error: "User accounts are created through registration and managed by an administrator" });
      if (resource === "sales") return res.status(405).json({ error: "Use the POS sales endpoint to complete a sale" });
      const readOnly = req.user.role === "Auditor";
      if (readOnly) return res.status(403).json({ error: "Auditors have read-only access" });
      if (["audit-logs"].includes(resource)) return res.status(403).json({ error: "Audit records are append-only" });
      const records = await repository.read();
      const record = { ...req.body, id: repository.nextId(records) };
      records.push(record);
      await repository.write(records);
      res.status(201).json({ data: record });
    } catch (error) { next(error); }
  });

  router.put(`/${resource}/:id`, async (req, res, next) => {
    try {
      if (resource === "users") return res.status(403).json({ error: "Use the administrator approval action to manage pending accounts" });
      if (resource === "sales") return res.status(405).json({ error: "Completed sales are immutable; use an authorised refund workflow" });
      if (req.user.role === "Auditor") return res.status(403).json({ error: "Auditors have read-only access" });
      if (["audit-logs"].includes(resource)) return res.status(403).json({ error: "Audit records cannot be modified" });
      const records = await repository.read();
      const index = records.findIndex(record => String(record.id) === String(req.params.id));
      if (index < 0) return res.status(404).json({ error: "Record not found" });
      records[index] = { ...records[index], ...req.body, id: records[index].id };
      await repository.write(records);
      res.json({ data: records[index] });
    } catch (error) { next(error); }
  });
}

router.patch("/users/:id/activate", async (req, res, next) => {
  try {
    if (req.user.role !== "System Administrator") {
      return res.status(403).json({ error: "Only a System Administrator can approve accounts" });
    }
    const users = await repositories.users.read();
    const user = users.find(record => String(record.id) === String(req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.active) return res.status(409).json({ error: "This account is already active" });

    const audit = await repositories["audit-logs"].read();
    audit.push({
      id: repositories["audit-logs"].nextId(audit),
      userId: req.user.id,
      username: req.user.username,
      action: "ACCOUNT_APPROVED",
      recordType: "user",
      recordId: user.id,
      timestamp: new Date().toISOString(),
      details: { approvedUsername: user.username }
    });
    user.active = true;
    user.accountStatus = "Active";
    await MongoRepository.writeAtomically([
      [repositories.users, users],
      [repositories["audit-logs"], audit]
    ]);
    const { passwordHash, ...safeUser } = user;
    res.json({ data: safeUser });
  } catch (error) { next(error); }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const [sales, expenses, suppliers, products, customers, budgets] = await Promise.all([
      repositories.sales.read(), repositories.expenses.read(), repositories.suppliers.read(),
      repositories.products.read(), new MongoRepository("customers.json").read(), repositories.budgets.read()
    ]);
    const activeSales = sales.filter(sale => sale.status !== "Refunded");
    const isCompleteSale = sale =>
      Number.isSafeInteger(sale.totalMinor) &&
      sale.totalMinor >= 0 &&
      (sale.items || []).every(item => Number.isSafeInteger(item.unitPriceMinor) && item.unitPriceMinor >= 0);
    const incompleteSalesCount = activeSales.filter(sale =>
      sale.financialCompleteness === "Incomplete" || !isCompleteSale(sale)).length;
    const completeSales = activeSales.filter(isCompleteSale);
    const totalRevenueMinor = activeSales.length > 0 && incompleteSalesCount === 0
      ? completeSales.reduce((sum, sale) => sum + sale.totalMinor, 0)
      : null;
    const expensesForTotal = expenses.filter(expense => expense.status !== "Rejected");
    const completeExpenses = expensesForTotal.every(expense =>
      Number.isSafeInteger(expense.amountMinor) && expense.amountMinor >= 0);
    const totalExpensesMinor = expensesForTotal.length > 0 && completeExpenses
      ? expensesForTotal.reduce((sum, expense) => sum + expense.amountMinor, 0)
      : null;
    const completeSupplierBalances = suppliers.every(supplier =>
      Number.isSafeInteger(supplier.balanceMinor) && supplier.balanceMinor >= 0);
    const supplierLiabilitiesMinor = suppliers.length > 0 && completeSupplierBalances
      ? suppliers.reduce((sum, supplier) => sum + supplier.balanceMinor, 0)
      : null;
    const minorUnit = 100;
    res.json({
      data: {
        totalRevenue: totalRevenueMinor === null ? null : totalRevenueMinor / minorUnit,
        incompleteSalesCount,
        totalExpenses: totalExpensesMinor === null ? null : totalExpensesMinor / minorUnit,
        netPosition: totalRevenueMinor === null || totalExpensesMinor === null
          ? null
          : (totalRevenueMinor - totalExpensesMinor) / minorUnit,
        supplierLiabilities: supplierLiabilitiesMinor === null ? null : supplierLiabilitiesMinor / minorUnit,
        activeCustomers: customers.filter(customer => !customer.isWalkIn && customer.active !== false).length,
        totalProducts: products.length,
        lowStockProducts: products.filter(product => Number(product.stock) <= Number(product.reorder)).length,
        recentSales: [...sales].sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || ""))).slice(0, 5),
        budgets
      }
    });
  } catch (error) { next(error); }
});

export default router;
