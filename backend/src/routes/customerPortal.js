import { Router } from "express";
import { authenticateCustomer } from "../middleware/auth.js";
import { MongoRepository } from "../repositories/MongoRepository.js";
import { getCustomerPurchaseHistory } from "../services/customerPurchases.js";
import { createSale } from "../services/sales.js";

const router = Router();
router.use(authenticateCustomer);

const customers = new MongoRepository("customers.json");
const products = new MongoRepository("products.json");

async function getActiveCustomer(req, res) {
  const customer = (await customers.read()).find(record => record.id === req.user.customerId);
  if (!customer || !customer.active || customer.status !== "Active") {
    res.status(403).json({ error: "Customer account is inactive" });
    return null;
  }
  const { passwordHash, ...safeCustomer } = customer;
  return safeCustomer;
}

router.get("/me", async (req, res, next) => {
  try {
    const customer = await getActiveCustomer(req, res);
    if (customer) res.json({ data: customer });
  } catch (error) { next(error); }
});

router.get("/products", async (req, res, next) => {
  try {
    const customer = await getActiveCustomer(req, res);
    if (!customer) return;
    const catalog = (await products.read())
      .filter(product => product.status !== "Inactive" && Number(product.stock) > 0)
      .map(({ id, sku, name, category, priceMinor, stock }) => ({ id, sku, name, category, priceMinor, stock }));
    res.json({ data: catalog });
  } catch (error) { next(error); }
});

router.get("/purchases", async (req, res, next) => {
  try {
    const customer = await getActiveCustomer(req, res);
    if (!customer) return;
    const history = await getCustomerPurchaseHistory(customer);
    res.json({ data: history });
  } catch (error) { next(error); }
});

router.post("/checkout", async (req, res, next) => {
  try {
    const customer = await getActiveCustomer(req, res);
    if (!customer) return;
    const method = String(req.body.paymentMethod || "");
    const paymentMethods = new Set(["M-Pesa", "EcoCash", "E-wallet", "Credit Card"]);
    if (!paymentMethods.has(method)) {
      return res.status(400).json({ error: "Choose M-Pesa, EcoCash, E-wallet, or Credit Card" });
    }
    const sale = await createSale({
      items: req.body.items,
      customerId: customer.id,
      tender: [{ method }],
      actor: {
        id: customer.id,
        name: "Customer Portal",
        username: customer.customerId,
        type: "Customer"
      },
      source: "Customer Portal",
      autoPay: true
    });
    res.status(201).json({ data: sale });
  } catch (error) { next(error); }
});

export default router;
