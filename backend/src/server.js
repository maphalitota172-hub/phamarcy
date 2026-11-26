import "./config/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/api.js";
import customerRoutes from "./routes/customers.js";
import salesRoutes from "./routes/sales.js";
import customerAuthRoutes from "./routes/customerAuth.js";
import customerPortalRoutes from "./routes/customerPortal.js";
import mobileMoneyRoutes from "./routes/mobileMoney.js";
import { STORAGE_PROVIDER } from "./config/storage.js";
import { connectDatabase, isDatabaseConnected } from "./config/database.js";
import { getJwtSecret } from "./config/jwt.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(helmet());

// Explicit origins come from CORS_ORIGIN; Vercel preview/production domains and
// local dev servers are always allowed so deploy previews never break.
const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(origin => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins = configuredOrigins.length ? configuredOrigins : defaultOrigins;
const allowedOriginPatterns = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i
];

function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = origin.replace(/\/+$/, "");
  return allowedOrigins.includes(normalized) || allowedOriginPatterns.some(pattern => pattern.test(normalized));
}

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: isDatabaseConnected() ? "ok" : "unavailable", storageProvider: STORAGE_PROVIDER });
});
app.use("/api/auth", authRoutes);
app.use("/api/customer-auth", customerAuthRoutes);
app.use("/api/customer-portal", customerPortalRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/mobile-money", mobileMoneyRoutes);
app.use("/api", apiRoutes);

app.use((req, res) => res.status(404).json({ error: "API endpoint not found" }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Internal server error" });
});

let startupReady = true;
try {
  getJwtSecret();
} catch (error) {
  console.error(error.message);
  startupReady = false;
}

if (startupReady) connectDatabase()
  .then(() => app.listen(port, () => console.log(`Health City FIS backend listening on http://localhost:${port}`)))
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
