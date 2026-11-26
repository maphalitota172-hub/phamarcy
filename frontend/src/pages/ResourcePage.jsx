import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import { apiRequest } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const titles = {
  transactions: "Sales Transactions",
  income: "Income Management",
  expenses: "Expense Management",
  customers: "Customer Management",
  suppliers: "Supplier Management",
  reports: "Financial Reports",
  budget: "Budget Management",
  users: "User & Role Management"
};

function formatValue(key, value) {
  if (key === "passwordHash" || key === "password") return "";
  if (value === null || value === undefined) return "—";
  if (key.includes("Minor") && Number.isFinite(Number(value))) return `M ${Number(value / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ResourcePage({ resource }) {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  async function loadRecords() {
    setError("");
    try {
      const result = await apiRequest(`/${resource}`, { method: "GET" });
      setRecords(result.data || []);
    } catch (caught) {
      setError(caught.message);
    }
  }

  useEffect(() => {
    loadRecords();
  }, [resource]);

  async function approveAccount(id) {
    setError("");
    setNotice("");
    try {
      await apiRequest(`/users/${id}/activate`, { method: "PATCH" });
      setNotice("Account approved.");
      await loadRecords();
    } catch (caught) {
      setError(caught.message);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter(record =>
      Object.entries(record).some(([key, value]) =>
        key !== "passwordHash" && key !== "password" &&
        String(formatValue(key, value)).toLowerCase().includes(query)
      )
    );
  }, [records, search]);

  const columns = useMemo(() => {
    if (!records.length) return [];
    const hidden = new Set(["passwordHash", "password"]);
    return Object.keys(records[0]).filter(key => !hidden.has(key)).slice(0, 7);
  }, [records]);

  return (
    <main className="content">
      <Header title={titles[resource] || "Module"} />
      {notice && <div className="alert info">{notice}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="toolbar">
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${titles[resource]?.toLowerCase() || "records"}…`} />
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        {filtered.length ? (
          <table>
            <thead>
              <tr>
                {columns.map(column => <th key={column}>{column.replace(/Minor$/, "").replace(/([A-Z])/g, " $1")}</th>)}
                {resource === "users" && user?.role === "System Administrator" && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(record => (
                <tr key={record.id}>
                  {columns.map(column => <td key={column}>{formatValue(column, record[column])}</td>)}
                  {resource === "users" && user?.role === "System Administrator" && (
                    <td>{!record.active && <button className="btn btn-primary btn-sm" onClick={() => approveAccount(record.id)}>Approve</button>}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="small">{records.length ? "No matching records." : `No ${titles[resource]?.toLowerCase() || "records"} available yet.`}</p>}
      </div>
    </main>
  );
}
