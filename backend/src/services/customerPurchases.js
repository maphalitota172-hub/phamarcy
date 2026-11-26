import { MongoRepository } from "../repositories/MongoRepository.js";

const sales = new MongoRepository("sales.json");
const products = new MongoRepository("products.json");

export async function getCustomerPurchaseHistory(customer) {
  const [saleRecords, productRecords] = await Promise.all([sales.read(), products.read()]);
  const productMap = new Map(productRecords.map(product => [String(product.id), product]));
  const purchases = saleRecords
    .filter(sale => sale.customerId !== null && sale.customerId !== undefined &&
      String(sale.customerId) === String(customer.id))
    .map(sale => {
      const items = (sale.items || []).map(item => {
        const productId = item.productId ?? item[0];
        const quantity = Number(item.quantity ?? item[1] ?? 0);
        const product = productMap.get(String(productId));
        const unitPriceMinor = item.unitPriceMinor !== null && item.unitPriceMinor !== undefined &&
          Number.isSafeInteger(Number(item.unitPriceMinor)) && Number(item.unitPriceMinor) >= 0
          ? Number(item.unitPriceMinor)
          : null;
        return {
          productId,
          productName: product?.name || "Product record unavailable",
          quantity,
          unitPriceMinor,
          lineTotalMinor: unitPriceMinor === null ? null : unitPriceMinor * quantity
        };
      });
      const totalMinor = sale.totalMinor !== null && sale.totalMinor !== undefined &&
        Number.isSafeInteger(Number(sale.totalMinor)) && Number(sale.totalMinor) >= 0
        ? Number(sale.totalMinor)
        : null;
      const payments = (sale.payments || []).map(payment => ({
        method: payment.method || payment.m,
        amountMinor: payment.amountMinor !== null && payment.amountMinor !== undefined &&
          Number.isSafeInteger(Number(payment.amountMinor)) && Number(payment.amountMinor) >= 0
          ? Number(payment.amountMinor)
          : null
      }));
      const paymentAmountsComplete = payments.length > 0 && payments.every(payment => payment.amountMinor !== null);
      return {
        id: sale.id,
        date: sale.date || sale.createdAt,
        status: sale.status,
        items,
        payments,
        totalMinor,
        financialCompleteness: sale.financialCompleteness || (totalMinor === null || items.some(item => item.lineTotalMinor === null)
          ? "Incomplete"
          : "Complete"),
        missingFinancialFields: sale.missingFinancialFields || [],
        totalPaidMinor: paymentAmountsComplete
          ? payments.reduce((sum, payment) => sum + payment.amountMinor, 0)
          : null
      };
    });
  const completed = purchases.filter(purchase => purchase.status === "Completed");
  const spendingComplete = completed.length > 0 && completed.every(purchase => purchase.totalPaidMinor !== null);
  return {
    customer,
    purchases,
    totalPurchases: completed.length,
    totalSpendingMinor: spendingComplete
      ? completed.reduce((sum, purchase) => sum + purchase.totalPaidMinor, 0)
      : null
  };
}
