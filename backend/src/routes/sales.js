import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { createSale } from "../services/sales.js";

const router = Router();
router.use(authenticate);

const cashierRoles = ["System Administrator", "Finance Manager", "Cashier"];

router.post("/", async (req, res, next) => {
  try {
    if (!cashierRoles.includes(req.user.role)) return res.status(403).json({ error: "You do not have permission to process sales" });
    const sale = await createSale({
      items: req.body.items,
      customerId: req.body.customerId,
      tender: req.body.payments,
      actor: { id: req.user.id, name: req.user.name, username: req.user.username, type: "Employee" },
      source: "POS"
    });
    res.status(201).json({ data: sale });
  } catch (error) { next(error); }
});

export default router;
