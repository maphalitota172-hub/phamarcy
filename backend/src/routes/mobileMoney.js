import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  MOBILE_MONEY_METHODS,
  applyProviderCallback,
  cancelPaymentRequest,
  confirmSandboxPayment,
  getPaymentRequest,
  initiatePayment,
  listMobileMoneyProviders,
  refreshPaymentRequest
} from "../services/mobileMoney.js";

const router = Router();
const cashierRoles = ["System Administrator", "Finance Manager", "Cashier"];
const employeeRoles = [...cashierRoles, "Accountant", "Auditor"];

function requireEmployee(req, res, roles) {
  if (req.user.role === "Customer" || !employeeRoles.includes(req.user.role)) {
    res.status(403).json({ error: "Employee account required" });
    return false;
  }
  if (roles && !roles.includes(req.user.role)) {
    res.status(403).json({ error: "You do not have permission to request mobile money payments" });
    return false;
  }
  return true;
}

router.get("/providers", authenticate, (req, res) => {
  res.json({ data: listMobileMoneyProviders() });
});

router.post("/requests", authenticate, async (req, res, next) => {
  try {
    if (!requireEmployee(req, res, cashierRoles)) return;
    const record = await initiatePayment({
      provider: req.body.provider,
      phone: req.body.phone,
      amountMinor: req.body.amountMinor,
      reference: req.body.reference,
      description: req.body.description,
      actor: { id: req.user.id, type: "Employee" }
    });
    res.status(201).json({ data: record });
  } catch (error) { next(error); }
});

router.get("/requests/:id", authenticate, async (req, res, next) => {
  try {
    if (!requireEmployee(req, res)) return;
    res.json({ data: await getPaymentRequest(req.params.id) });
  } catch (error) { next(error); }
});

router.post("/requests/:id/confirm", authenticate, async (req, res, next) => {
  try {
    if (!requireEmployee(req, res, cashierRoles)) return;
    res.json({ data: await confirmSandboxPayment(req.params.id) });
  } catch (error) { next(error); }
});

router.post("/requests/:id/refresh", authenticate, async (req, res, next) => {
  try {
    if (!requireEmployee(req, res, cashierRoles)) return;
    res.json({ data: await refreshPaymentRequest(req.params.id) });
  } catch (error) { next(error); }
});

router.post("/requests/:id/cancel", authenticate, async (req, res, next) => {
  try {
    if (!requireEmployee(req, res, cashierRoles)) return;
    res.json({ data: await cancelPaymentRequest(req.params.id) });
  } catch (error) { next(error); }
});

// Provider-facing webhook (unauthenticated by design — the gateway calls this).
router.post("/callback/:provider", async (req, res, next) => {
  try {
    const provider = MOBILE_MONEY_METHODS.includes(req.params.provider) ? req.params.provider : null;
    if (!provider) return res.status(404).json({ error: "Unknown mobile money provider" });
    res.json({ data: await applyProviderCallback(provider, req.body) });
  } catch (error) { next(error); }
});

export default router;
