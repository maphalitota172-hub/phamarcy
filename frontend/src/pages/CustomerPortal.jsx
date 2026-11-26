import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { customerApiRequest } from "../services/api.js";
import { formatMoney } from "./Dashboard.jsx";

const blankForm = { name: "", phone: "", email: "", address: "", password: "" };

export default function CustomerPortal() {
  const [customer, setCustomer] = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("M-Pesa");
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPortal() {
    const [profile, history, catalog] = await Promise.all([
      customerApiRequest("/customer-portal/me"),
      customerApiRequest("/customer-portal/purchases"),
      customerApiRequest("/customer-portal/products")
    ]);
    setCustomer(profile.data);
    setPurchases(history.data);
    setProducts(catalog.data);
  }

  useEffect(() => {
    if (localStorage.getItem("customer_token")) {
      loadPortal().catch(caught => {
        localStorage.removeItem("customer_token");
        setError(caught.message);
      });
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = registering ? "/customer-auth/register" : "/customer-auth/login";
      const payload = registering ? form : { phone: form.phone, password: form.password };
      const result = await customerApiRequest(path, { method: "POST", body: JSON.stringify(payload) });
      localStorage.setItem("customer_token", result.token);
      setCustomer(result.customer);
      await loadPortal();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("customer_token");
    setCustomer(null);
    setPurchases(null);
    setProducts([]);
    setCart([]);
    setForm(blankForm);
  }

  const totalMinor = cart.reduce((total, item) => total + item.product.priceMinor * item.quantity, 0);

  function addToCart(product) {
    setCart(current => {
      const existing = current.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return current;
        return current.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId, quantity) {
    const parsed = Number(quantity);
    const product = products.find(record => record.id === productId);
    if (!product || parsed <= 0) {
      setCart(current => current.filter(item => item.product.id !== productId));
      return;
    }
    if (!Number.isSafeInteger(parsed) || parsed > product.stock) return;
    setCart(current => current.map(item => item.product.id === productId ? { ...item, quantity: parsed } : item));
  }

  async function checkout() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const result = await customerApiRequest("/customer-portal/checkout", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
          paymentMethod
        })
      });
      setCart([]);
      setNotice(`Order #${result.data.id} recorded as paid by ${paymentMethod}.`);
      await loadPortal();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  if (customer && purchases) {
    return (
      <main className="customer-portal">
        <header className="portal-header">
          <div className="portal-brand"><span className="logo-sm">✚</span> Health City Pharmacy</div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </header>
        <section className="portal-content">
          <div className="portal-welcome">
            <div><p className="small">Customer account</p><h1>Welcome, {customer.name}</h1><p>{customer.customerId} · {customer.phone}</p></div>
            <span className="pill green">Active</span>
          </div>
          <div className="kpi-grid">
            <div className="kpi"><div className="k-label">Completed purchases</div><div className="k-value">{purchases.totalPurchases}</div></div>
            <div className="kpi"><div className="k-label">Total paid</div><div className="k-value">{formatMoney(purchases.totalSpendingMinor === null ? null : purchases.totalSpendingMinor / 100)}</div></div>
          </div>
          {error && <div className="alert error">{error}</div>}
          {notice && <div className="alert info">{notice}</div>}
          <section className="panel table-scroll">
            <div className="toolbar"><h2>Pharmacy products</h2><span className="small">{products.length} in-stock products</span></div>
            {products.length ? <table>
              <thead><tr><th>Product</th><th>Category</th><th>SKU</th><th>Price</th><th>Available</th><th></th></tr></thead>
              <tbody>{products.map(product => <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.category || "—"}</td>
                <td>{product.sku}</td>
                <td>{formatMoney(product.priceMinor / 100)}</td>
                <td>{product.stock}</td>
                <td><button className="btn btn-primary btn-sm" disabled={loading || cart.find(item => item.product.id === product.id)?.quantity >= product.stock} onClick={() => addToCart(product)}>Add to order</button></td>
              </tr>)}</tbody>
            </table> : <p className="small">There are currently no in-stock products available.</p>}
          </section>
          <section className="panel">
            <h2>Your order</h2>
            {cart.length ? <>
              <div className="table-scroll"><table>
                <thead><tr><th>Product</th><th>Unit price</th><th>Quantity</th><th>Line total</th><th></th></tr></thead>
                <tbody>{cart.map(item => <tr key={item.product.id}>
                  <td>{item.product.name}</td>
                  <td>{formatMoney(item.product.priceMinor / 100)}</td>
                  <td><input aria-label={`Quantity for ${item.product.name}`} type="number" min="1" max={item.product.stock} value={item.quantity} disabled={loading} onChange={event => changeQuantity(item.product.id, event.target.value)} /></td>
                  <td>{formatMoney(item.product.priceMinor * item.quantity / 100)}</td>
                  <td><button className="btn btn-ghost btn-sm" disabled={loading} onClick={() => changeQuantity(item.product.id, 0)}>Remove</button></td>
                </tr>)}</tbody>
              </table></div>
              <div className="customer-checkout">
                <div>
                  <label htmlFor="customer-payment-method">Payment method</label>
                  <select id="customer-payment-method" value={paymentMethod} disabled={loading} onChange={event => setPaymentMethod(event.target.value)}>
                    <option>M-Pesa</option><option>EcoCash</option><option>E-wallet</option><option>Credit Card</option>
                  </select>
                </div>
                <strong>Total: {formatMoney(totalMinor / 100)}</strong>
                <button className="btn btn-primary" disabled={loading || !cart.length} onClick={checkout}>{loading ? "Processing payment…" : "Pay"}</button>
              </div>
              <p className="small payment-disclaimer">Prototype checkout: the selected method is recorded as paid in the transaction history; no external payment is charged.</p>
            </> : <p className="small">Add pharmacy products to your order to continue.</p>}
          </section>
          <section className="panel table-scroll">
            <h2>Purchase history</h2>
            {purchases.purchases.length ? <table>
              <thead><tr><th>Transaction</th><th>Date</th><th>Items</th><th>Total</th><th>Payments</th><th>Status</th></tr></thead>
              <tbody>{purchases.purchases.map(purchase => <tr key={purchase.id}>
                <td>#{purchase.id}</td>
                <td>{purchase.date ? new Date(purchase.date).toLocaleDateString() : "—"}</td>
                <td>{purchase.items.map(item => `${item.quantity} × ${item.productName}`).join(", ")}</td>
                <td>{formatMoney(purchase.totalMinor === null ? null : purchase.totalMinor / 100)}</td>
                <td>{purchase.payments.map(payment => `${payment.method}: ${payment.amountMinor === null ? "—" : formatMoney(payment.amountMinor / 100)}`).join(", ") || "—"}</td>
                <td><span className={`pill ${purchase.status === "Completed" ? "green" : "red"}`}>{purchase.status}</span></td>
              </tr>)}</tbody>
            </table> : <p className="small">Purchases made using your registered phone number will appear here.</p>}
          </section>
          <p className="small">For purchases at the pharmacy, staff can find your customer profile using your phone number or customer ID. Walk-in purchasing is also available.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="logo">✚</div>
          <h1>Health City Pharmacy</h1>
          <p>Customer {registering ? "Registration" : "Sign In"}</p>
        </div>
        {error && <div className="alert error">{error}</div>}
        {registering && <>
          <label htmlFor="portal-name">Full name</label>
          <input id="portal-name" autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
        </>}
        <label htmlFor="portal-phone">Phone number</label>
        <input id="portal-phone" autoComplete="tel" type="tel" required value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} />
        {registering && <>
          <label htmlFor="portal-email">Email (optional)</label>
          <input id="portal-email" autoComplete="email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          <label htmlFor="portal-address">Address (optional)</label>
          <input id="portal-address" autoComplete="street-address" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} />
        </>}
        <label htmlFor="portal-password">Password</label>
        <input id="portal-password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 10 : 1} maxLength={128} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
        <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Please wait…" : registering ? "Register and Sign In" : "Customer Sign In"}</button>
        <button type="button" className="btn btn-ghost btn-block" disabled={loading} onClick={() => { setRegistering(!registering); setError(""); setForm(blankForm); }}>
          {registering ? "I already have an account" : "Create a customer account"}
        </button>
        <p className="demo-note">Customer accounts are active immediately. They are separate from employee system accounts and do not require administrator approval.</p>
        <p className="demo-note"><Link to="/login">Employee sign in</Link></p>
      </form>
    </main>
  );
}
