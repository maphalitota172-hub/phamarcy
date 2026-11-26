import crypto from "node:crypto";
import { MongoRepository } from "../repositories/MongoRepository.js";

const paymentRequests = new MongoRepository("paymentRequests.json");

export const MOBILE_MONEY_METHODS = ["M-Pesa", "EcoCash"];
const MOBILE_MONEY_SET = new Set(MOBILE_MONEY_METHODS);

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function notFound(message) {
  return Object.assign(new Error(message), { status: 404 });
}

function env(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) return String(value).trim();
  }
  return "";
}

// Merchant credentials are read from the environment. Until real Vodacom M-Pesa /
// Econet EcoCash merchant credentials are supplied the provider runs in sandbox
// mode, which simulates the prompt without contacting a live gateway.
const providerConfig = {
  "M-Pesa": {
    operator: "Vodacom Lesotho M-Pesa",
    currency: "LSL",
    countryCode: "266",
    baseUrl: env("MPESA_BASE_URL"),
    apiKey: env("MPESA_API_KEY"),
    publicKey: env("MPESA_PUBLIC_KEY"),
    serviceProviderCode: env("MPESA_SERVICE_PROVIDER_CODE", "MPESA_SHORTCODE"),
    required: ["baseUrl", "apiKey", "serviceProviderCode"]
  },
  "EcoCash": {
    operator: "Econet Lesotho EcoCash",
    currency: "LSL",
    countryCode: "266",
    baseUrl: env("ECOCASH_BASE_URL"),
    paymentPath: env("ECOCASH_PAYMENT_PATH") || "/api/v1/transactions/amount/",
    merchantCode: env("ECOCASH_MERCHANT_CODE"),
    apiUsername: env("ECOCASH_API_USERNAME"),
    apiPassword: env("ECOCASH_API_PASSWORD"),
    channel: env("ECOCASH_CHANNEL") || "USSD",
    required: ["baseUrl", "merchantCode", "apiUsername", "apiPassword"]
  }
};

function isConfigured(config) {
  return config.required.every(key => Boolean(config[key]));
}

export function isMobileMoneyMethod(method) {
  return MOBILE_MONEY_SET.has(String(method));
}

export function listMobileMoneyProviders() {
  return MOBILE_MONEY_METHODS.map(name => {
    const config = providerConfig[name];
    const live = isConfigured(config);
    return {
      name,
      operator: config.operator,
      currency: config.currency,
      mode: live ? "live" : "sandbox",
      message: live
        ? "Merchant credentials detected — prompts are sent through the live provider API."
        : "No merchant credentials configured — prompts are simulated in sandbox mode."
    };
  });
}

export function normalizeMsisdn(value, countryCode = "266") {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) throw badRequest("Enter the mobile number that should receive the payment prompt");
  if (digits.startsWith(countryCode)) return digits;
  if (digits.startsWith("0")) return countryCode + digits.slice(1);
  return countryCode + digits;
}

function amountToMajor(amountMinor) {
  return (Number(amountMinor) / 100).toFixed(2);
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function toPublicKeyPem(value) {
  const trimmed = String(value).trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  const wrapped = trimmed.replace(/(.{64})/g, "$1\n").trim();
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
}

function encryptApiKey(apiKey, publicKey) {
  const encrypted = crypto.publicEncrypt(
    { key: toPublicKeyPem(publicKey), padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(apiKey, "utf8")
  );
  return encrypted.toString("base64");
}

async function mpesaPublicKey(config) {
  if (config.publicKey) return config.publicKey;
  const response = await fetch(`${config.baseUrl}/publicKey/v2/publickey`, { method: "GET" });
  const body = await readJsonResponse(response);
  const key = body.output_publicKey || body.publicKey;
  if (!response.ok || !key) {
    throw new Error(body.output_ResponseDesc || `Could not load the M-Pesa public key (HTTP ${response.status})`);
  }
  return key;
}

// Vodacom M-Pesa OpenAPI "single stage" C2B payment: the customer receives a
// USSD/STK prompt on their handset. A response code of INS-0 means the prompt
// was accepted and the transaction is awaiting the customer's PIN.
async function requestMpesaPrompt(config, { msisdn, amountMinor, reference, description }) {
  const publicKey = await mpesaPublicKey(config);
  const bearer = encryptApiKey(config.apiKey, publicKey);
  const response = await fetch(`${config.baseUrl}/ipg/v1x/c2bPayment/singleStage/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      Origin: config.baseUrl
    },
    body: JSON.stringify({
      input_TransactionReference: reference,
      input_CustomerMSISDN: msisdn,
      input_Amount: amountToMajor(amountMinor),
      input_ThirdPartyReference: reference,
      input_ServiceProviderCode: config.serviceProviderCode
    })
  });
  const body = await readJsonResponse(response);
  const code = String(body.output_ResponseCode || "");
  const accepted = response.ok && code === "INS-0";
  return {
    providerRef: body.output_TransactionID || body.output_ConversationID || reference,
    status: accepted ? "pending" : "failed",
    message: body.output_ResponseDesc || (accepted ? "M-Pesa prompt accepted." : `M-Pesa returned code ${code || response.status}`),
    description
  };
}

// Econet EcoCash charges the customer's wallet and pushes a USSD approval
// prompt. Field names follow Econet's merchant API contract and can be tuned
// with the ECOCASH_* environment variables once merchant documentation is held.
async function requestEcocashPrompt(config, { msisdn, amountMinor, reference, description }) {
  const credentials = Buffer.from(`${config.apiUsername}:${config.apiPassword}`).toString("base64");
  const response = await fetch(`${config.baseUrl}${config.paymentPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${credentials}` },
    body: JSON.stringify({
      merchantCode: config.merchantCode,
      customerMsisdn: msisdn,
      amount: amountToMajor(amountMinor),
      currency: config.currency,
      reference,
      description,
      channel: config.channel
    })
  });
  const body = await readJsonResponse(response);
  const status = String(body.status || body.transactionStatus || "").toUpperCase();
  const accepted = response.ok && status !== "FAILED" && status !== "REJECTED" && !body.error;
  return {
    providerRef: body.transactionId || body.reference || reference,
    status: accepted ? "pending" : "failed",
    message: body.message || body.responseMessage || (accepted ? "EcoCash prompt accepted." : `EcoCash request rejected (HTTP ${response.status})`)
  };
}

function sandboxPrompt(record) {
  return {
    providerRef: `SBX-${record.provider.replace(/[^A-Za-z]/g, "").toUpperCase()}-${record.id}`,
    status: "pending",
    message: `Sandbox: a payment prompt for ${record.currency} ${amountToMajor(record.amountMinor)} was sent to ${record.phone}. The customer must approve it before the sale can be completed.`
  };
}

export async function initiatePayment({ provider, phone, amountMinor, reference, description, actor }) {
  const config = providerConfig[provider];
  if (!config) throw badRequest("Choose either M-Pesa or EcoCash");
  const amount = Number(amountMinor);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw badRequest("Enter a valid payment amount in minor units");
  }
  const msisdn = normalizeMsisdn(phone, config.countryCode);
  const existing = await paymentRequests.read();
  const id = paymentRequests.nextId(existing);
  const now = new Date().toISOString();
  const mode = isConfigured(config) ? "live" : "sandbox";
  const promptReference = reference || `HC-${String(id).padStart(5, "0")}`;

  const base = {
    id,
    provider,
    phone: msisdn,
    amountMinor: amount,
    currency: config.currency,
    reference: promptReference,
    description: description || "",
    status: "pending",
    mode,
    providerRef: null,
    saleId: null,
    initiatedBy: actor?.id ?? null,
    initiatedByType: actor?.type ?? null,
    message: "",
    failureReason: null,
    createdAt: now,
    updatedAt: now
  };

  let outcome;
  try {
    outcome = mode === "live"
      ? await (provider === "M-Pesa" ? requestMpesaPrompt : requestEcocashPrompt)(config, {
        msisdn, amountMinor: amount, reference: promptReference, description: base.description
      })
      : sandboxPrompt(base);
  } catch (error) {
    outcome = { providerRef: promptReference, status: "failed", message: error.message || "The provider request failed" };
  }

  const record = {
    ...base,
    providerRef: outcome.providerRef || promptReference,
    status: outcome.status,
    message: outcome.message,
    failureReason: outcome.status === "failed" ? outcome.message : null,
    updatedAt: new Date().toISOString()
  };
  return paymentRequests.insert(record);
}

export async function getPaymentRequest(id) {
  const record = await paymentRequests.findById(id);
  if (!record) throw notFound("Payment request not found");
  return record;
}

export async function confirmSandboxPayment(id) {
  const record = await getPaymentRequest(id);
  if (record.mode !== "sandbox") {
    throw badRequest("Live payments are confirmed by the provider callback, not manually");
  }
  if (record.status !== "pending") {
    throw badRequest(`This payment request is already ${record.status}`);
  }
  return paymentRequests.updateById(id, {
    status: "confirmed",
    message: `Sandbox: the customer approved the ${record.provider} prompt for ${record.currency} ${amountToMajor(record.amountMinor)}.`,
    updatedAt: new Date().toISOString()
  });
}

export async function cancelPaymentRequest(id) {
  const record = await getPaymentRequest(id);
  if (record.status !== "pending") {
    throw badRequest(`This payment request is already ${record.status}`);
  }
  return paymentRequests.updateById(id, {
    status: "cancelled",
    message: "The payment request was cancelled before the customer approved it.",
    updatedAt: new Date().toISOString()
  });
}

export async function linkPaymentRequestToSale(id, saleId) {
  const record = await paymentRequests.findById(id);
  if (!record) return null;
  return paymentRequests.updateById(id, { saleId: Number(saleId), updatedAt: new Date().toISOString() });
}

// Polls the provider for a live request so the cashier UI can show the outcome
// without waiting for a webhook.
export async function refreshPaymentRequest(id) {
  const record = await getPaymentRequest(id);
  if (record.mode !== "live" || record.status !== "pending") return record;
  const config = providerConfig[record.provider];
  try {
    const response = await fetch(
      `${config.baseUrl}/ipg/v1x/queryTransactionStatus/?input_QueryReference=${encodeURIComponent(record.providerRef)}&input_ServiceProviderCode=${encodeURIComponent(config.serviceProviderCode)}&input_ThirdPartyReference=${encodeURIComponent(record.reference)}`,
      { method: "GET", headers: { Authorization: `Bearer ${config.apiKey}` } }
    );
    const body = await readJsonResponse(response);
    const code = String(body.output_ResponseCode || "");
    if (!code || code.startsWith("INS-")) return record;
    return paymentRequests.updateById(id, {
      status: "confirmed",
      message: body.output_ResponseDesc || "The provider reported the payment as completed.",
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return paymentRequests.updateById(id, {
      message: `Status check failed: ${error.message}`,
      updatedAt: new Date().toISOString()
    });
  }
}

// Provider webhook. Match on whichever reference the gateway echoes back.
export async function applyProviderCallback(provider, payload = {}) {
  const candidates = [
    payload.output_TransactionID,
    payload.output_ConversationID,
    payload.output_ThirdPartyReference,
    payload.transactionId,
    payload.reference
  ].filter(Boolean).map(String);
  const records = await paymentRequests.read();
  const record = records.find(item =>
    item.provider === provider && candidates.some(value => item.providerRef === value || item.reference === value)
  );
  if (!record) throw notFound("No matching payment request for this callback");
  if (record.status !== "pending") return record;
  const code = String(payload.output_ResponseCode || payload.status || "").toUpperCase();
  const failed = code.startsWith("INS-") && code !== "INS-0" || code === "FAILED" || code === "REJECTED";
  return paymentRequests.updateById(record.id, {
    status: failed ? "failed" : "confirmed",
    message: payload.output_ResponseDesc || payload.message || "Provider callback received.",
    failureReason: failed ? (payload.output_ResponseDesc || "Provider reported a failure") : null,
    updatedAt: new Date().toISOString()
  });
}
