import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../services/api.js";
import { formatMoney } from "./Dashboard.jsx";

const emptyForm = { name: "", phone: "", email: "", address: "", status: "Active", notes: "" };

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const canWrite = user && user.role !== "Auditor";
  const canChangeStatus = ["System Administrator", "Finance Manager"].includes(user?.role);

  async function loadCustomers(query = search) {
    const result = await apiRequest(`/customers?search=${encodeURIComponent(query)}`);
    setCustomers(result.data);
  }

  useEffect(() => {
    loadCustomers("").catch(caught => setError(caught.message));
  }, []);

  async function submitCustomer(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (editing) {
        await apiRequest(`/customers/${editing.id}`, { method: "PUT", body: JSON.stringify(form) });
        setNotice("Customer information updated.");
      } else {
        const result = await apiRequest("/customers", { method: "POST", body: JSON.stringify(form) });
        setNotice(`${result.data.customerId} registered successfully.`);
      }
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
      await loadCustomers();
      if (selected) setSelected(null);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(customer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
      status: customer.status || (customer.active ? "Active" : "Inactive"),
      notes: customer.notes || ""
    });
    setShowForm(true);
    setHistory(null);
  }

  async function showHistory(customer) {
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/customers/${customer.id}/purchases`);
      setHistory(result.data);
      setSelected(customer);
      setShowForm(false);
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function changeStatus(customer) {
    setError("");
    setNotice("");
    const status = customer.active ? "Inactive" : "Active";
    try {
      await apiRequest(`/customers/${customer.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(`Customer status changed to ${status}.`);
      await loadCustomers();
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function searchCustomers(value) {
    setSearch(value);
    try { await loadCustomers(value); }
    catch (caught) { setError(caught.message); }
  }

  return (
    <main className="content">
      <Header title="Customer Management" />
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert info">{notice}</div>}

      <div className="toolbar">
        <input type="search" value={search} onChange={event => searchCustomers(event.target.value)} placeholder="Search name, phone or customer ID…" />
        {canWrite && <button className="btn btn-primary" onClick={() => {
          setForm(emptyForm); setEditing(null); setShowForm(!showForm); setHistory(null);
        }}>{showForm ? "Cancel" : "+ Register Customer"}</button>}
      </div>

      {showForm && <form className="panel" onSubmit={submitCustomer}>
        <h3>{editing ? "Edit customer" : "Register pharmacy customer"}</h3>
        <div className="form-grid">
          <div><label htmlFor="customer-name">Full name *</label><input id="customer-name" required minLength={2} maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div>
          <div><label htmlFor="customer-phone">Phone number *</label><input id="customer-phone" required type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></div>
          <div><label htmlFor="customer-email">Email (optional)</label><input id="customer-email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></div>
          {!editing && <div><label htmlFor="customer-status">Status</label><select id="customer-status" value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></div>}
          <div><label htmlFor="customer-address">Physical address (optional)</label><input id="customer-address" maxLength={300} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></div>
          <div><label htmlFor="customer-notes">Notes (optional)</label><input id="customer-notes" maxLength={1000} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></div>
        </div>
        <p className="small">Customer ID and registration date are assigned automatically. This creates a customer record, not an employee login.</p>
        <div className="form-actions"><button className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : editing ? "Save Changes" : "Register Customer"}</button></div>
      </form>}

      {history && selected && <section className="panel">
        <div className="toolbar">
          <h3>Customer Profile — {selected.name}</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => { setHistory(null); setSelected(null); }}>Close Profile</button>
        </div>
        <div className="kpi-grid">
          <div className="kpi"><div className="k-label">Customer ID</div><div className="k-value">{selected.customerId}</div></div>
          <div className="kpi"><div className="k-label">Phone</div><div className="k-value">{selected.phone}</div></div>
          <div className="kpi"><div className="k-label">Purchases</div><div className="k-value">{history.totalPurchases}</div></div>
          <div className="kpi"><div className="k-label">Total Spending</div><div className="k-value">{formatMoney(history.totalSpendingMinor === null ? null : history.totalSpendingMinor / 100)}</div></div>
        </div>
        <p className="small">{selected.email || "No email"} · {selected.address || "No address"} · Registered {selected.registeredAt ? new Date(selected.registeredAt).toLocaleDateString() : "date not recorded"}</p>
        <h3 className="section-title">Purchase and refund history</h3>
        {history.purchases.length ? <div className="table-scroll"><table>
          <thead><tr><th>Transaction</th><th>Date</th><th>Products / quantities</th><th>Total</th><th>Paid</th><th>Payment method</th><th>Status</th></tr></thead>
          <tbody>{history.purchases.map(purchase => <tr key={purchase.id}>
            <td>#{purchase.id}</td>
            <td>{new Date(purchase.date).toLocaleDateString()}</td>
            <td>{purchase.items.map(item => `${item.quantity} × ${item.productName}`).join(", ")}</td>
            <td>{formatMoney(purchase.totalMinor === null ? null : purchase.totalMinor / 100)}</td>
            <td>{formatMoney(purchase.totalPaidMinor === null ? null : purchase.totalPaidMinor / 100)}</td>
            <td>{purchase.payments.map(payment => payment.method).join(", ") || "—"}</td>
            <td><span className={`pill ${purchase.status === "Completed" ? "green" : "red"}`}>{purchase.status}</span></td>
          </tr>)}</tbody>
        </table></div> : <p className="small">No transactions are linked to this customer yet.</p>}
      </section>}

      <section className="panel table-scroll">
        <table>
          <thead><tr><th>Customer ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Date Registered</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{customers.map(customer => <tr key={customer.id}>
            <td>{customer.customerId}</td><td>{customer.name}</td><td>{customer.phone}</td><td>{customer.email || "—"}</td>
            <td>{customer.registeredAt ? new Date(customer.registeredAt).toLocaleDateString() : "—"}</td>
            <td><span className={`pill ${customer.active ? "green" : "red"}`}>{customer.status || (customer.active ? "Active" : "Inactive")}</span></td>
            <td className="action-cell">
              <button className="btn btn-ghost btn-sm" onClick={() => showHistory(customer)}>Profile</button>
              {canWrite && <button className="btn btn-ghost btn-sm" onClick={() => startEdit(customer)}>Edit</button>}
              {canChangeStatus && <button className="btn btn-ghost btn-sm" onClick={() => changeStatus(customer)}>{customer.active ? "Deactivate" : "Activate"}</button>}
            </td>
          </tr>)}</tbody>
        </table>
        {!customers.length && <p className="small">No customers found.</p>}
      </section>
    </main>
  );
}
