import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import { apiRequest } from "../services/api.js";
import { formatMoney } from "./Dashboard.jsx";

const details = {
  "total-revenue": {
    title: "Total Revenue",
    description: "Revenue is the sum of recorded totals for non-refunded sales. It is unavailable if any active sale has incomplete financial information.",
    resources: { sales: "/sales" },
    value: data => formatMoney(data.dashboard.totalRevenue),
    sections: data => [{
      title: "Sales behind this total",
      columns: ["Sale", "Date", "Customer", "Status", "Financial data", "Amount"],
      rows: data.sales.filter(sale => sale.status !== "Refunded").map(sale => {
        const complete = Number.isSafeInteger(sale.totalMinor) && sale.totalMinor >= 0 &&
          (sale.items || []).every(item => Number.isSafeInteger(item.unitPriceMinor) && item.unitPriceMinor >= 0);
        return [
          `#${sale.id}`,
          sale.date || "—",
          sale.customer || "—",
          sale.status || "—",
          sale.financialCompleteness || (complete ? "Complete" : "Incomplete"),
          complete ? formatMoney(sale.totalMinor / 100) : "Unavailable"
        ];
      }),
      empty: "No sales have been recorded."
    }]
  },
  "total-expenses": {
    title: "Total Expenses",
    description: "This total includes recorded expense amounts in every status except rejected expenses.",
    resources: { expenses: "/expenses" },
    value: data => formatMoney(data.dashboard.totalExpenses),
    sections: data => [{
      title: "Expenses behind this total",
      columns: ["Date", "Category", "Description", "Status", "Amount"],
      rows: data.expenses.filter(expense => expense.status !== "Rejected").map(expense => [
        expense.date || "—",
        expense.category || "—",
        expense.description || "—",
        expense.status || "—",
        Number.isSafeInteger(expense.amountMinor) && expense.amountMinor >= 0
          ? formatMoney(expense.amountMinor / 100)
          : "Unavailable"
      ]),
      empty: "No expenses have been recorded."
    }]
  },
  "net-position": {
    title: "Net Position",
    description: "Net position is total revenue minus total expenses. It is shown only when both totals can be calculated from complete recorded amounts.",
    resources: { sales: "/sales", expenses: "/expenses" },
    value: data => formatMoney(data.dashboard.netPosition),
    sections: data => [{
      title: "Sales included in revenue",
      columns: ["Sale", "Date", "Customer", "Status", "Amount"],
      rows: data.sales.filter(sale => sale.status !== "Refunded").map(sale => [
        `#${sale.id}`,
        sale.date || "—",
        sale.customer || "—",
        sale.status || "—",
        Number.isSafeInteger(sale.totalMinor) && sale.totalMinor >= 0
          ? formatMoney(sale.totalMinor / 100)
          : "Incomplete"
      ]),
      empty: "No sales have been recorded."
    }, {
      title: "Expenses included in the calculation",
      columns: ["Date", "Category", "Description", "Status", "Amount"],
      rows: data.expenses.filter(expense => expense.status !== "Rejected").map(expense => [
        expense.date || "—",
        expense.category || "—",
        expense.description || "—",
        expense.status || "—",
        Number.isSafeInteger(expense.amountMinor) && expense.amountMinor >= 0
          ? formatMoney(expense.amountMinor / 100)
          : "Unavailable"
      ]),
      empty: "No expenses have been recorded."
    }]
  },
  "supplier-liabilities": {
    title: "Supplier Liabilities",
    description: "The total of recorded outstanding balances across suppliers. The total is unavailable if balances are missing or incomplete.",
    resources: { suppliers: "/suppliers" },
    value: data => formatMoney(data.dashboard.supplierLiabilities),
    sections: data => [{
      title: "Supplier balances",
      columns: ["Supplier", "Contact", "Outstanding balance"],
      rows: data.suppliers.map(supplier => [
        supplier.name || "—",
        supplier.contact || supplier.phone || "—",
        Number.isSafeInteger(supplier.balanceMinor) && supplier.balanceMinor >= 0
          ? formatMoney(supplier.balanceMinor / 100)
          : "Unavailable"
      ]),
      empty: "No suppliers have been recorded."
    }]
  },
  "active-customers": {
    title: "Active Customers",
    description: "Counts registered, non-walk-in customer records that are not marked inactive.",
    resources: { customers: "/customers" },
    value: data => String(data.dashboard.activeCustomers),
    sections: data => [{
      title: "Customers included in this count",
      columns: ["Customer ID", "Name", "Phone", "Registered", "Status"],
      rows: data.customers
        .filter(customer => !customer.isWalkIn && customer.active !== false)
        .map(customer => [
          customer.customerId || "—",
          customer.name || "—",
          customer.phone || "—",
          customer.registeredAt ? new Date(customer.registeredAt).toLocaleDateString() : "—",
          customer.status || "Active"
        ]),
      empty: "No active customer records have been added."
    }]
  },
  "low-stock-items": {
    title: "Low-Stock Items",
    description: "Products are counted as low-stock when their current stock is at or below their reorder threshold.",
    resources: { products: "/products" },
    value: data => `${data.dashboard.lowStockProducts} of ${data.dashboard.totalProducts} products`,
    sections: data => [{
      title: "Products at or below their reorder level",
      columns: ["SKU", "Product", "Category", "In stock", "Reorder level"],
      rows: data.products
        .filter(product => Number(product.stock) <= Number(product.reorder))
        .map(product => [
          product.sku || "—",
          product.name || "—",
          product.category || "—",
          String(product.stock ?? "—"),
          String(product.reorder ?? "—")
        ]),
      empty: "No products are currently at or below their reorder level."
    }]
  }
};

export default function DashboardDetail() {
  const { metric } = useParams();
  const detail = details[metric];
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!detail) return undefined;
    let active = true;
    Promise.all([
      apiRequest("/dashboard"),
      ...Object.entries(detail.resources).map(async ([key, path]) => [key, (await apiRequest(path)).data])
    ]).then(([dashboardResult, ...resources]) => {
      if (active) setData({
        dashboard: dashboardResult.data,
        ...Object.fromEntries(resources)
      });
    }).catch(caught => {
      if (active) setError(caught.message);
    });
    return () => { active = false; };
  }, [detail]);

  if (!detail) return <Navigate to="/dashboard" replace />;
  const sections = data ? detail.sections(data) : [];

  return (
    <main className="content">
      <Header title={detail.title} />
      <Link className="back-link" to="/dashboard">← Back to dashboard</Link>
      {error && <div className="alert error">{error}</div>}
      {!data && !error && <div className="panel">Loading details…</div>}
      {data && <>
        <section className="panel detail-intro">
          <div className="k-label">Dashboard metric</div>
          <div className="detail-value">{detail.value(data)}</div>
          <p>{detail.description}</p>
        </section>
        {sections.map(section => (
          <section className="panel table-scroll" key={section.title}>
            <h3>{section.title}</h3>
            {section.rows.length ? <table>
              <thead><tr>{section.columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{section.rows.map((row, index) => (
                <tr key={`${section.title}-${index}`}>
                  {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                </tr>
              ))}</tbody>
            </table> : <p className="small">{section.empty}</p>}
          </section>
        ))}
      </>}
    </main>
  );
}
