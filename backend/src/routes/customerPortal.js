import { Router } from "express";
import { authenticateCustomer } from "../middleware/auth.js";
import { MongoRepository } from "../repositories/MongoRepository.js";
import { getCustomerPurchaseHistory } from "../services/customerPurchases.js";
import { createSale } from "../services/sales.js";
import {
  cancelPaymentRequest,
  confirmSandboxPayment,
  getPaymentRequest,
  initiatePayment,
  isMobileMoneyMethod,
  linkPaymentRequestToSale,
  listMobileMoneyProviders
} from "../services/mobileMoney.js";

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

router.get("/mobile-money/providers", (req, res) => {
  res.json({ data: listMobileMoneyProviders() });
});

// The prompt is always sent to the authenticated customer's own registered
// number, so one customer can never push a prompt to someone else's handset.
router.post("/mobile-money/requests", async (req, res, next) => {
  try {
    const customer = await getActiveCustomer(req, res);
    if (!customer) return;
    if (!customer.phone) {
      return res.status(400).json({ error: "Add a phone number to your profile before paying with mobile money" });
    }
    const record = await initiatePayment({
      provider: String(req.body.provider || ""),
      phone: customer.phone,
      amountMinor: req.body.amountMinor,
      reference: req.body.reference,
      description: req.body.description || "Customer portal order",
      actor: { id: customer.id, type: "Customer" }
    });
    res.status(201).json({ data: record });
  } catch (error) { next(error); }
});

async function loadOwnedRequest(req, res) {
  const customer = await getActiveCustomer(req, res);
  if (!customer) return null;
  const record = await getPaymentRequest(req.params.id);
  if (record.initiatedBy !== customer.id || record.initiatedByType !== "Customer") {
    res.status(403).json({ error: "This payment request belongs to another customer" });
    return null;
  }
  return record;
}

router.get("/mobile-money/requests/:id", async (req, res, next) => {
  try {
    const record = await loadOwnedRequest(req, res);
    if (record) res.json({ data: record });
  } catch (error) { next(error); }
});

router.post("/mobile-money/requests/:id/confirm", async (req, res, next) => {
  try {
    const record = await loadOwnedRequest(req, res);
    if (!record) return;
    res.json({ data: await confirmSandboxPayment(record.id) });
  } catch (error) { next(error); }
});

router.post("/mobile-money/requests/:id/cancel", async (req, res, next) => {
  try {
    const record = await loadOwnedRequest(req, res);
    if (!record) return;
    res.json({ data: await cancelPaymentRequest(record.id) });
  } catch (error) { next(error); }
});

async function cartTotalMinor(items) {
  const catalog = await products.read();
  let total = 0;
  for (const item of items || []) {
    const product = catalog.find(record => Number(record.id) === Number(item.productId) && record.status !== "Inactive");
    if (!product) return null;
    total += Number(product.priceMinor) * Number(item.quantity || 0);
  }
  return total;
}

router.post("/checkout", async (req, res, next) => {
  try {
    const customer = await getActiveCustomer(req, res);
    if (!customer) return;
    const method = String(req.body.paymentMethod || "");
    const paymentMethods = new Set(["M-Pesa", "EcoCash", "E-wallet", "Credit Card"]);
    if (!paymentMethods.has(method)) {
      return res.status(400).json({ error: "Choose M-Pesa, EcoCash, E-wallet, or Credit Card" });
    }
    const tender = [{ method }];
    const paymentRequestId = req.body.paymentRequestId;
    if (isMobileMoneyMethod(method)) {
      if (paymentRequestId === undefined || paymentRequestId === null || paymentRequestId === "") {
        return res.status(400).json({ error: `Send an ${method} payment prompt and approve it on your phone before checkout` });
      }
      const request = await loadOwnedRequest({ ...req, params: { id: paymentRequestId } }, res);
      if (!request) return;
      if (request.provider !== method) {
        return res.status(400).json({ error: `The approved prompt was for ${request.provider}, not ${method}` });
      }
      if (request.status !== "confirmed") {
        return res.status(400).json({ error: `Your ${method} payment is ${request.status}. Approve the prompt before checkout.` });
      }
      const total = await cartTotalMinor(req.body.items);
      if (total !== null && total !== request.amountMinor) {
        return res.status(400).json({ error: "Your order total changed after the prompt was sent. Send a new payment prompt." });
      }
      tender[0].reference = request.providerRef;
    }
    const sale = await createSale({
      items: req.body.items,
      customerId: customer.id,
      tender,
      actor: {
        id: customer.id,
        name: "Customer Portal",
        username: customer.customerId,
        type: "Customer"
      },
      source: "Customer Portal",
      autoPay: true
    });
    if (tender[0].reference) await linkPaymentRequestToSale(paymentRequestId, sale.id);
    res.status(201).json({ data: sale });
  } catch (error) { next(error); }
});

export default router;
