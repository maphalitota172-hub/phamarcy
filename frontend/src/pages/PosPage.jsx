import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../services/api.js";
import { formatMoney } from "./Dashboard.jsx";

const cashierRoles = ["System Administrator", "Finance Manager", "Cashier"];

function saleTotalMinor(sale) {
  if (sale.totalMinor !== null && sale.totalMinor !== undefined &&
    Number.isSafeInteger(Number(sale.totalMinor)) && Number(sale.totalMinor) >= 0) {
    return Number(sale.totalMinor);
  }
  return null;
}

function moneyToMinor(value) {
  const match = String(value).match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return 0;
  return Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
}

export default function PosPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentLines, setPaymentLines] = useState([{ method: "Cash", amountMinor: null }]);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPosData() {
    const [productResult, customerResult, salesResult] = await Promise.all([
      apiRequest("/products"), apiRequest("/customers"), apiRequest("/sales")
    ]);
    setProducts(productResult.data || []);
    setCustomers((customerResult.data || []).filter(customer => customer.active && !customer.isWalkIn));
    setSales([...(salesResult.data || [])].reverse());
  }

  useEffect(() => {
    loadPosData().catch(caught => setError(caught.message));
  }, []);

  const matchingProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return [];
    return products.filter(product =>
      `${product.name} ${product.sku}`.toLowerCase().includes(query) &&
      product.status !== "Inactive"
    ).slice(0, 8);
  }, [products, productSearch]);

  const matchingCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return [];
    return customers.filter(customer =>
      `${customer.customerId} ${customer.name} ${customer.phone}`.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [customers, customerSearch]);

  const totalMinor = cart.reduce((total, item) => total + item.product.priceMinor * item.quantity, 0);
  const paymentsTotalMinor = paymentLines.reduce((total, payment) =>
    total + (payment.amountMinor === null ? totalMinor : payment.amountMinor), 0);

  function addProduct(product) {
    setCart(current => {
      const existing = current.find(item => item.product.id === product.id);
      if (existing) return current.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { product, quantity: 1 }];
    });
    setProductSearch("");
  }

  function changeQuantity(productId, quantity) {
    const parsed = Number(quantity);
    if (parsed <= 0) setCart(current => current.filter(item => item.product.id !== productId));
    else setCart(current => current.map(item => item.product.id === productId ? { ...item, quantity: parsed } : item));
  }

  async function registerCustomer(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const result = await apiRequest("/customers", { method: "POST", body: JSON.stringify(newCustomer) });
      const customer = result.data;
      setCustomers(current => [...current, customer]);
      setCustomerId(String(customer.id));
      setCustomerSearch(`${customer.name} (${customer.customerId})`);
      setShowCustomerForm(false);
      setNewCustomer({ name: "", phone: "", email: "", address: "" });
      setNotice(`${customer.customerId} registered and selected for this sale.`);
    } catch (caught) { setError(caught.message); }
  }

  async function completeSale() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const result = await apiRequest("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId: customerId || null,
          items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity })),
          payments: paymentLines.map(payment => ({
            method: payment.method,
            amountMinor: payment.amountMinor === null ? totalMinor : payment.amountMinor
          }))
        })
      });
      setLastReceipt(result.data);
      setNotice(`Sale #${result.data.id} completed. Stock and payment records were updated.`);
      setCart([]);
      setCustomerId("");
      setCustomerSearch("");
      setPaymentLines([{ method: "Cash", amountMinor: null }]);
      await loadPosData();
    } catch (caught) {
      setError(caught.message);
    } finally { setLoading(false); }
  }

  return (
    <main className="content">
      <Header title="Sales Transactions" />
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert info">{notice}</div>}
      {!cashierRoles.includes(user?.role) && <div className="alert error">Your role can view transactions but cannot complete sales.</div>}

      <section className="panel">
        <div className="toolbar"><h3>Point of Sale</h3><span className="small">Registered customer is optional — choose Walk-in to continue without a profile.</span></div>
        <div className="form-grid">
          <div className="field-with-results">
            <label htmlFor="pos-product-search">Find product by name or SKU</label>
            <input id="pos-product-search" value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Search product…" />
            {!!matchingProducts.length && <div className="suggestions">{matchingProducts.map(product => <button type="button" key={product.id} onClick={() => addProduct(product)}>
              {product.name} · {product.sku} · {formatMoney(product.priceMinor / 100)} · stock {product.stock}
            </button>)}</div>}
            {!!productSearch.trim() && !matchingProducts.length && <p className="small">No products match that search.</p>}
            {!products.length && <p className="small">No products are available in inventory yet.</p>}
          </div>
          <div className="field-with-results">
            <label htmlFor="pos-customer-search">Customer</label>
            <input id="pos-customer-search" value={customerSearch} onChange={event => { setCustomerSearch(event.target.value); setCustomerId(""); }} placeholder="Search name, phone or customer ID…" />
            {!!matchingCustomers.length && <div className="suggestions">{matchingCustomers.map(customer => <button type="button" key={customer.id} onClick={() => {
              setCustomerId(String(customer.id)); setCustomerSearch(`${customer.name} (${customer.customerId})`);
            }}>{customer.name} · {customer.phone} · {customer.customerId}</button>)}</div>}
            {customerId && <button className="text-button" type="button" onClick={() => { setCustomerId(""); setCustomerSearch(""); }}>Use Walk-in instead</button>}
            {!customerId && <button className="text-button" type="button" onClick={() => { setCustomerSearch("Walk-in"); }}>Walk-in sale</button>}
            {cashierRoles.includes(user?.role) && <button className="text-button" type="button" onClick={() => setShowCustomerForm(!showCustomerForm)}>+ Register customer here</button>}
          </div>
        </div>

        {showCustomerForm && <form className="inline-register" onSubmit={registerCustomer}>
          <h3>Quick customer registration</h3>
          <div className="form-grid">
            <div><label htmlFor="quick-name">Full name *</label><input id="quick-name" required minLength={2} value={newCustomer.name} onChange={event => setNewCustomer({ ...newCustomer, name: event.target.value })} /></div>
            <div><label htmlFor="quick-phone">Phone *</label><input id="quick-phone" required type="tel" value={newCustomer.phone} onChange={event => setNewCustomer({ ...newCustomer, phone: event.target.value })} /></div>
            <div><label htmlFor="quick-email">Email (optional)</label><input id="quick-email" type="email" value={newCustomer.email} onChange={event => setNewCustomer({ ...newCustomer, email: event.target.value })} /></div>
            <div><label htmlFor="quick-address">Address (optional)</label><input id="quick-address" value={newCustomer.address} onChange={event => setNewCustomer({ ...newCustomer, address: event.target.value })} /></div>
          </div>
          <div className="form-actions"><button className="btn btn-primary">Register and select</button><button type="button" className="btn btn-ghost" onClick={() => setShowCustomerForm(false)}>Cancel</button></div>
        </form>}

        <div className="table-scroll"><table>
          <thead><tr><th>Product</th><th>SKU</th><th>Unit price</th><th>Quantity</th><th>Line total</th><th></th></tr></thead>
          <tbody>{cart.map(item => <tr key={item.product.id}>
            <td>{item.product.name}</td><td>{item.product.sku}</td><td>{formatMoney(item.product.priceMinor / 100)}</td>
            <td><input aria-label={`Quantity for ${item.product.name}`} type="number" min="1" max={item.product.stock} value={item.quantity} onChange={event => changeQuantity(item.product.id, event.target.value)} /></td>
            <td>{formatMoney(item.product.priceMinor * item.quantity / 100)}</td>
            <td><button className="btn btn-ghost btn-sm" onClick={() => changeQuantity(item.product.id, 0)}>Remove</button></td>
          </tr>)}</tbody>
        </table></div>
        <div className="payment-lines">
          <div className="toolbar"><h3>Payment</h3><button type="button" className="btn btn-ghost btn-sm" onClick={() => {
            setPaymentLines(current => current.map(payment => payment.amountMinor === null ? { ...payment, amountMinor: totalMinor } : payment).concat({ method: "Card", amountMinor: 0 }));
          }}>+ Split payment</button></div>
          {paymentLines.map((payment, index) => <div className="payment-row" key={index}>
            <div><label htmlFor={`payment-method-${index}`}>Method {index + 1}</label><select id={`payment-method-${index}`} value={payment.method} onChange={event => setPaymentLines(current => current.map((line, position) => position === index ? { ...line, method: event.target.value } : line))}>
              <option>Cash</option><option>Credit Card</option><option>E-wallet</option><option>M-Pesa</option><option>EcoCash</option><option>Other</option>
            </select></div>
            <div><label htmlFor={`payment-amount-${index}`}>Amount (M)</label><input id={`payment-amount-${index}`} type="number" min="0" step="0.01" value={((payment.amountMinor === null ? totalMinor : payment.amountMinor) / 100).toFixed(2)} onChange={event => setPaymentLines(current => current.map((line, position) => position === index ? { ...line, amountMinor: moneyToMinor(event.target.value) } : line))} /></div>
            {paymentLines.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => setPaymentLines(current => current.filter((_, position) => position !== index))}>Remove</button>}
          </div>)}
          <p className={`small ${paymentsTotalMinor === totalMinor ? "up" : "down"}`}>Payment total: {formatMoney(paymentsTotalMinor / 100)} / {formatMoney(totalMinor / 100)}{paymentsTotalMinor === totalMinor ? " — matches sale total" : " — must match sale total"}</p>
        </div>
        <div className="pos-checkout">
          <strong>Total: {formatMoney(totalMinor / 100)}</strong>
          <button className="btn btn-primary" disabled={loading || !cart.length || paymentsTotalMinor !== totalMinor || !cashierRoles.includes(user?.role)} onClick={completeSale}>{loading ? "Completing…" : "Complete Sale"}</button>
        </div>
      </section>

      {lastReceipt && <section className="panel receipt-panel">
        <div className="toolbar receipt-actions">
          <h3>Receipt #{lastReceipt.id}</h3>
          <div className="action-cell">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>Print receipt</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLastReceipt(null)}>Dismiss</button>
          </div>
        </div>
        <p><strong>Health City Pharmacy</strong></p>
        <p className="small">{lastReceipt.createdAt ? new Date(lastReceipt.createdAt).toLocaleString() : lastReceipt.date}</p>
        <p className="small">Customer: {lastReceipt.customer || "Walk-in"} · Cashier: {lastReceipt.cashier || user?.name || "—"}</p>
        <div className="table-scroll"><table>
          <thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead>
          <tbody>{lastReceipt.items.map((item, index) => {
            const product = products.find(record => Number(record.id) === Number(item.productId));
            return <tr key={`${item.productId}-${index}`}>
              <td>{product?.name || "Product record unavailable"}</td>
              <td>{item.quantity}</td>
              <td>{formatMoney(item.unitPriceMinor / 100)}</td>
              <td>{formatMoney(item.unitPriceMinor * item.quantity / 100)}</td>
            </tr>;
          })}</tbody>
        </table></div>
        <p className="receipt-total"><strong>Total: {formatMoney(lastReceipt.totalMinor / 100)}</strong></p>
        <p className="small">Paid by: {lastReceipt.payments.map(payment =>
          `${payment.method} ${formatMoney(payment.amountMinor / 100)}`
        ).join(", ")}</p>
      </section>}

      <section className="panel table-scroll">
        <h3>Recent transactions</h3>
        <table><thead><tr><th>Sale</th><th>Date</th><th>Customer</th><th>Products</th><th>Total</th><th>Paid by</th><th>Status</th></tr></thead>
          <tbody>{sales.map(sale => {
            const totalMinor = saleTotalMinor(sale);
            return <tr key={sale.id}>
              <td>#{sale.id}</td><td>{sale.date}</td><td>{sale.customer || (sale.walkIn ? "Walk-in" : "—")}</td>
              <td>{(sale.items || []).map((item, index) => {
                const product = products.find(record => Number(record.id) === Number(item.productId));
                return `${item.quantity} × ${product?.name || `Product #${item.productId}`}`;
              }).join(", ") || "—"}</td>
              <td>{totalMinor === null ? "—" : formatMoney(totalMinor / 100)}</td>
              <td>{(sale.payments || []).map(payment => `${payment.method}: ${formatMoney(payment.amountMinor / 100)}`).join(", ") || "—"}</td>
              <td>
                <span className={`pill ${sale.status === "Completed" ? "green" : "red"}`}>{sale.status}</span>
                {sale.financialCompleteness === "Incomplete" && <span className="pill red">Incomplete history</span>}
              </td>
            </tr>;
          })}</tbody>
        </table>
        {!sales.length && <p className="small">No sales have been recorded.</p>}
      </section>
    </main>
  );
}
