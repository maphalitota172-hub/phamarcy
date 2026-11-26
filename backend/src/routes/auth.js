import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { MongoRepository } from "../repositories/MongoRepository.js";
import { authenticateEmployee } from "../middleware/auth.js";
import { getJwtSecret } from "../config/jwt.js";

const router = Router();
const users = new MongoRepository("users.json");
const auditLogs = new MongoRepository("auditLogs.json");
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

router.post("/register", loginLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: "Name must be between 2 and 80 characters" });
    }
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json({ error: "Username must be 3–30 characters using letters, numbers, dot, underscore or hyphen" });
    }
    if (password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: "Password must be between 10 and 128 characters" });
    }

    const records = await users.read();
    if (records.some(user => user.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: "That username is already registered" });
    }
    const user = {
      id: users.nextId(records),
      name,
      username,
      role: "Cashier",
      active: false,
      accountStatus: "Pending approval",
      passwordHash: await bcrypt.hash(password, 12)
    };
    const logs = await auditLogs.read();
    logs.push({
      id: auditLogs.nextId(logs),
      userId: user.id,
      username,
      action: "ACCOUNT_REGISTERED",
      recordType: "user",
      recordId: user.id,
      timestamp: new Date().toISOString(),
      details: { role: user.role, accountStatus: user.accountStatus }
    });
    await MongoRepository.writeAtomically([
      [users, [...records, user]],
      [auditLogs, logs]
    ]);
    res.status(201).json({
      message: "Account created. An administrator must approve it before you can sign in."
    });
  } catch (error) { next(error); }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const records = await users.read();
    const user = records.find(item => item.username === username);
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      await auditLogs.write([...(await auditLogs.read()), {
        id: 0, action: "LOGIN_FAILED", recordType: "auth", recordId: username,
        timestamp: new Date().toISOString(), details: { username }
      }].map((item, index) => ({ ...item, id: item.id || index + 1 })));
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const token = jwt.sign({ id: user.id, name: user.name, username: user.username, role: user.role }, getJwtSecret(), { expiresIn: "8h" });
    const logs = await auditLogs.read();
    logs.push({ id: logs.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1,
      userId: user.id, username: user.username, action: "LOGIN_SUCCESS",
      recordType: "auth", recordId: user.id, timestamp: new Date().toISOString(), details: {} });
    await auditLogs.write(logs);
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (error) { next(error); }
});

router.get("/me", authenticateEmployee, (req, res) => {
  res.json({ user: req.user });
});

export default router;
