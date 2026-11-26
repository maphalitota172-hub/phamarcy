import { MongoRepository } from "../repositories/MongoRepository.js";

const sales = new MongoRepository("sales.json");
const customers = new MongoRepository("customers.json");
const products = new MongoRepository("products.json");
const payments = new MongoRepository("payments.json");
const stockMovements = new MongoRepository("stockMovements.json");
const auditLogs = new MongoRepository("auditLogs.json");
let saleQueue = Promise.resolve();

function normalizeItems(input, productRecords) {
  if (!Array.isArray(input) || input.length === 0) throw Object.assign(new Error("Add at least one product"), { status: 400 });
  const grouped = new Map();
  for (const item of input) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    if (!Number.isSafeInteger(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw Object.assign(new Error("Each sale item must have a valid product and positive whole-number quantity"), { status: 400 });
    }
    grouped.set(productId, (grouped.get(productId) || 0) + quantity);
  }
  return [...grouped].map(([productId, quantity]) => {
    const product = productRecords.find(record => Number(record.id) === productId && record.status !== "Inactive");
    if (!product) throw Object.assign(new Error(`Product ${productId} was not found or is inactive`), { status: 400 });
    if (!Number.isSafeInteger(Number(product.priceMinor)) || Number(product.priceMinor) < 0) {
      throw Object.assign(new Error(`Product ${product.name} has an invalid selling price`), { status: 400 });
    }
    if (!Number.isSafeInteger(Number(product.stock)) || Number(product.stock) < quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${product.name}`), { status: 409 });
    }
    return { product, productId, quantity, unitPriceMinor: Number(product.priceMinor) };
  });
}

export async function createSale({ items, customerId: requestedCustomerId, tender, actor, source, autoPay = false }) {
  let release;
  const previous = saleQueue;
  saleQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    const [saleRecords, productRecords, customerRecords, paymentRecords, movementRecords, auditRecords] = await Promise.all([
      sales.read(), products.read(), customers.read(), payments.read(), stockMovements.read(), auditLogs.read()
    ]);
    const cart = normalizeItems(items, productRecords);
    const customerId = requestedCustomerId === null || requestedCustomerId === undefined || requestedCustomerId === ""
      ? null
      : Number(requestedCustomerId);
    let customer = null;
    if (customerId !== null) {
      customer = customerRecords.find(record => record.id === customerId && !record.isWalkIn);
      if (!customer || customer.active === false || customer.status === "Inactive") {
        throw Object.assign(new Error("Choose an active registered customer or use Walk-in"), { status: 400 });
      }
    }
    const totalMinor = cart.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0);
    if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) {
      throw Object.assign(new Error("Sale total must be a positive valid amount"), { status: 400 });
    }
    if (!Array.isArray(tender) || tender.length === 0) {
      throw Object.assign(new Error("Add at least one payment"), { status: 400 });
    }
    const acceptedMethods = new Set(["Cash", "Card", "Mobile Money", "Other", "Credit Card", "E-wallet", "M-Pesa", "EcoCash"]);
    const normalizedPayments = tender.map(payment => {
      const method = String(payment.method || "");
      const amountMinor = autoPay && (payment.amountMinor === undefined || payment.amountMinor === null)
        ? totalMinor
        : Number(payment.amountMinor);
      if (!acceptedMethods.has(method) || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        throw Object.assign(new Error("Payments require a supported method and positive amount in minor units"), { status: 400 });
      }
      return payment.reference
        ? { method, amountMinor, reference: String(payment.reference) }
        : { method, amountMinor };
    });
    if (normalizedPayments.reduce((sum, payment) => sum + payment.amountMinor, 0) !== totalMinor) {
      throw Object.assign(new Error("Payment total must exactly match the sale total"), { status: 400 });
    }

    const id = sales.nextId(saleRecords);
    const now = new Date();
    const sale = {
      id,
      date: now.toISOString().slice(0, 10),
      createdAt: now.toISOString(),
      customerId: customer?.id ?? null,
      customer: customer?.name || "Walk-in",
      walkIn: !customer,
      cashier: actor.name,
      cashierUserId: actor.type === "Employee" ? actor.id : null,
      source,
      items: cart.map(({ productId, quantity, unitPriceMinor }) => ({ productId, quantity, unitPriceMinor })),
      subtotalMinor: totalMinor,
      totalMinor,
      financialCompleteness: "Complete",
      missingFinancialFields: [],
      payments: normalizedPayments,
      status: "Completed"
    };
    const updatedProducts = productRecords.map(product => {
      const sold = cart.find(item => item.productId === Number(product.id));
      return sold ? { ...product, stock: Number(product.stock) - sold.quantity } : product;
    });
    const nextPayments = [...paymentRecords];
    for (const payment of normalizedPayments) {
      nextPayments.push({
        id: payments.nextId(nextPayments),
        saleId: id,
        ...payment,
        date: now.toISOString(),
        recordedBy: actor.type === "Employee" ? actor.id : null,
        recordedByType: actor.type
      });
    }
    const nextMovements = [...movementRecords];
    for (const item of cart) {
      nextMovements.push({
        id: stockMovements.nextId(nextMovements),
        date: now.toISOString(),
        productId: item.productId,
        quantityChange: -item.quantity,
        reason: `Sale #${id}`,
        saleId: id,
        userId: actor.type === "Employee" ? actor.id : null,
        initiatedByCustomerId: actor.type === "Customer" ? actor.id : undefined
      });
    }
    const nextAudit = [...auditRecords, {
      id: auditLogs.nextId(auditRecords),
      userId: actor.type === "Employee" ? actor.id : undefined,
      username: actor.username,
      actorType: actor.type,
      action: "SALE_COMPLETED",
      recordType: "sale",
      recordId: id,
      timestamp: now.toISOString(),
      details: { totalMinor, customerId: sale.customerId, walkIn: sale.walkIn, source }
    }];
    await MongoRepository.writeAtomically([
      [products, updatedProducts],
      [sales, [...saleRecords, sale]],
      [payments, nextPayments],
      [stockMovements, nextMovements],
      [auditLogs, nextAudit]
    ]);
    return sale;
  } finally {
    release();
  }
}
