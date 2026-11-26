import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/jwt.js";

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, getJwtSecret());
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

export function authenticateEmployee(req, res, next) {
  authenticate(req, res, () => {
    const employeeRoles = ["System Administrator", "Finance Manager", "Accountant", "Cashier", "Auditor"];
    if (!employeeRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Employee account required" });
    }
    next();
  });
}

export function authenticateCustomer(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== "Customer" || !Number.isSafeInteger(Number(req.user.customerId))) {
      return res.status(403).json({ error: "Customer account required" });
    }
    next();
  });
}

export function permit(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission for this operation" });
    }
    next();
  };
}
