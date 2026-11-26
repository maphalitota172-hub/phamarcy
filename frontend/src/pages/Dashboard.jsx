import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import KpiCard from "../components/KpiCard.jsx";
import { apiRequest } from "../services/api.js";

export function formatMoney(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `M ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest("/dashboard").then(result => setData(result.data)).catch(caught => setError(caught.message));
  }, []);
  return (
    <main className="content">
      <Header title="Dashboard" />
      {error && <div className="alert error">{error}</div>}
      {!data && !error && <div className="panel">Loading dashboard…</div>}
      {data && <>
        <div className="alert info">Financial totals use recorded amounts only. Incomplete historical sales are excluded; their missing amounts are not estimated.</div>
        <div className="kpi-grid">
          <KpiCard label="Total Revenue" value={formatMoney(data.totalRevenue)} sub={data.incompleteSalesCount ? `Unavailable: ${data.incompleteSalesCount} incomplete sales` : "Recorded completed sales"} tone="up" />
          <KpiCard label="Total Expenses" value={formatMoney(data.totalExpenses)} sub="Recorded expense amounts" />
          <KpiCard label="Net Position" value={formatMoney(data.netPosition)} sub="Available when revenue and expenses are complete" tone={data.netPosition === null ? "" : data.netPosition >= 0 ? "up" : "down"} />
          <KpiCard label="Supplier Liabilities" value={formatMoney(data.supplierLiabilities)} sub="Recorded supplier balances" tone="down" />
          <KpiCard label="Active Customers" value={data.activeCustomers} sub="Registered customer records" />
          <KpiCard label="Low-Stock Items" value={data.lowStockProducts} sub={data.totalProducts ? `of ${data.totalProducts} products` : "No products recorded"} tone={data.lowStockProducts ? "down" : ""} />
        </div>
        <div className="panel">
          <h3>Recent transactions</h3>
          {data.recentSales.length ? (
            <table>
              <thead><tr><th>Sale</th><th>Date</th><th>Customer</th><th>Status</th><th>Financial data</th></tr></thead>
              <tbody>{data.recentSales.map(sale => (
                <tr key={sale.id}>
                  <td>#{sale.id}</td><td>{sale.date}</td><td>{sale.customer || "—"}</td>
                  <td><span className={`pill ${sale.status === "Completed" ? "green" : "red"}`}>{sale.status}</span></td>
                  <td><span className={`pill ${sale.financialCompleteness === "Incomplete" ? "red" : "green"}`}>{sale.financialCompleteness || "Complete"}</span></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="small">No sales have been recorded.</p>}
        </div>
      </>}
    </main>
  );
}
