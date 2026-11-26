/* Health City Pharmacy — FIS Prototype (frontend demo)
   All records below are FICTIONAL demonstration data.
   Simulated: login/MFA, RBAC, dashboard, transactions, income, expenses,
   customers, suppliers, reports, budget, user management. */

"use strict";

/* ---------- Demo dataset ---------- */
const DB = {
  users: [
    { id: 1, name: "Neo Mokoena",  username: "admin",   role: "System Administrator", active: true },
    { id: 2, name: "Mpho Thabo",   username: "finance", role: "Finance Manager",      active: true },
    { id: 3, name: "Lineo Khitsane",username: "acct",    role: "Accountant",           active: true },
    { id: 4, name: "Sello Molefe",  username: "cashier", role: "Cashier",              active: true },
    { id: 5, name: "Reabetsoe Kena",username: "auditor", role: "Auditor (read-only)",  active: true },
  ],
  customers: [
    { id: 1, name: "Mamosaane R.", phone: "+266 5661 2345", points: 340 },
    { id: 2, name: "Thabo L.",     phone: "+266 5888 1122", points: 120 },
    { id: 3, name: "Kefuoe N.",    phone: "+266 5900 7788", points: 55  },
    { id: 4, name: "Puleng D.",    phone: "+266 5722 3344", points: 410 },
    { id: 5, name: "Walk-in",      phone: "—",               points: 0   },
  ],
  suppliers: [
    { id: 1, name: "Mediplus Wholesale", contact: "T. Mofokeng", phone: "+266 2231 4455", terms: "30 days",  balance: 18400 },
    { id: 2, name: "PharmaSource Lesotho",contact: "L. Maseko", phone: "+266 2232 8899", terms: "14 days",  balance: 9600  },
    { id: 3, name: "CosmoCare Distributors", contact: "P. Ntlhabi", phone: "+266 5665 0011", terms: "Cash on delivery", balance: 3200 },
  ],
  products: [
    { id: 1, sku: "MED-001", name: "Amoxicillin 500mg (21)",  cat: "Antibiotics",     cost: 42,  price: 68,  stock: 145, reorder: 50 },
    { id: 2, sku: "MED-002", name: "Metformin 500mg (30)",    cat: "Chronic / NCD",   cost: 30,  price: 52,  stock: 220, reorder: 80 },
    { id: 3, sku: "MED-003", name: "Salbutamol Inhaler",      cat: "Respiratory",     cost: 95,  price: 150, stock: 38,  reorder: 20 },
    { id: 4, sku: "MED-004", name: "ORS Sachets (box 10)",     cat: "GIT / Fluids",    cost: 18,  price: 30,  stock: 90,  reorder: 40 },
    { id: 5, sku: "COS-011", name: "Sunscreen SPF50 (100ml)", cat: "Cosmetics",       cost: 55,  price: 95,  stock: 60,  reorder: 25 },
    { id: 6, sku: "SUP-020", name: "Vitamin D3 1000IU (60)",  cat: "Supplements",     cost: 38,  price: 65,  stock: 12,  reorder: 30 },
    { id: 7, sku: "MED-007", name: "Insulin Glargine (pen)", cat: "Chronic / NCD",   cost: 210, price: 320, stock: 18,  reorder: 15 },
    { id: 8, sku: "MED-008", name: "Antihistamine 10mg (20)", cat: "Allergy",         cost: 25,  price: 45,  stock: 130, reorder: 50 },
  ],
  sales: [
    { id: 101, date: "2026-11-18", customer: "Mamosaane R.", cashier: "Sello Molefe", items: [[1,2],[4,1]], payments: [{m:"Card",a:196}], status:"Completed" },
    { id: 102, date: "2026-11-18", customer: "Walk-in",       cashier: "Sello Molefe", items: [[5,1],[8,2]], payments: [{m:"Cash",a:185}], status:"Completed" },
    { id: 103, date: "2026-11-19", customer: "Puleng D.",     cashier: "Neo Mokoena",  items: [[2,3],[7,1]], payments: [{m:"Mobile Money",a:1160}], status:"Completed" },
    { id: 104, date: "2026-11-19", customer: "Thabo L.",      cashier: "Sello Molefe", items: [[6,2]],       payments: [{m:"Card",a:130}],  status:"Refunded" },
  ],
  expenses: [
    { id: 1, date: "2026-11-03", category: "Salaries",      desc: "November payroll (10 staff)",      amount: 68000, approvedBy:"Mpho Thabo" },
    { id: 2, date: "2026-11-05", category: "Rent",          desc: "Shop rent — Maseru CBD",          amount: 15000, approvedBy:"Mpho Thabo" },
    { id: 3, date: "2026-11-08", category: "Utilities",     desc: "Electricity + water",              amount: 3200,  approvedBy:"Mpho Thabo" },
    { id: 4, date: "2026-11-10", category: "Stock purchase",desc: "PO-2291 Mediplus Wholesale",       amount: 18400, approvedBy:"Mpho Thabo" },
    { id: 5, date: "2026-11-12", category: "Transport",     desc: "Supplier deliveries (month)",     amount: 2400,  approvedBy:"Mpho Thabo" },
    { id: 6, date: "2026-11-15", category: "Sundries",      desc: "Packaging & stationery",          amount: 1150,  approvedBy:"Lineo Khitsane" },
  ],
  budgets: [
    { category: "Salaries",       budget: 68000, actual: 68000 },
    { category: "Rent",           budget: 15000, actual: 15000 },
    { category: "Utilities",      budget: 3500,  actual: 3200  },
    { category: "Stock purchase", budget: 20000, actual: 18400 },
    { category: "Transport",      budget: 3000,  actual: 2400  },
    { category: "Sundries",       budget: 1500,  actual: 1150  },
  ],
  monthly: [ // illustrative trailing 6 months (demo)
    { m:"Jun", rev:172000, exp:141000 }, { m:"Jul", rev:181000, exp:148000 },
    { m:"Aug", rev:176000, exp:152000 }, { m:"Sep", rev:194000, exp:157000 },
    { m:"Oct", rev:201000, exp:163000 }, { m:"Nov", rev:208000, exp:166000 },
  ],
};

/* ---------- State ---------- */
let currentUser = null;
const $ = s => document.querySelector(s);
const fmt = n => "M " + Number(n).toLocaleString("en-US");
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const productName = id => (DB.products.find(p=>p.id===id)||{}).name || "?";

/* ---------- Auth ---------- */
$("#mfa-toggle").addEventListener("change", e => $("#mfa-box").classList.toggle("hidden", !e.target.checked));
$("#login-form").addEventListener("submit", e => {
  e.preventDefault();
  const un = $("#login-user").value.trim();
  const pw = $("#login-pass").value;
  const mfa = $("#mfa-code").value.trim();
  if (pw !== "demo1234") { alert("Invalid password. Hint: demo1234"); return; }
  const u = DB.users.find(x => x.username === un);
  if (!u) { alert("Unknown user. Try: admin, finance, acct, cashier, auditor"); return; }
  if ($("#mfa-toggle").checked && !/^\d{6}$/.test(mfa)) { alert("Enter the 6-digit MFA code"); return; }
  login(u);
});
function login(u){
  currentUser = u;
  document.querySelectorAll(".admin-only").forEach(el => {
    el.classList.toggle("hidden", u.role !== "System Administrator" && u.role !== "Finance Manager");
  });
  $("#current-user").textContent = `${u.name} — ${u.role}`;
  $("#login-screen").classList.add("hidden");
  $("#main-screen").classList.remove("hidden");
  navigate("dashboard");
}
$("#logout").addEventListener("click", () => location.reload());

/* ---------- Navigation ---------- */
document.querySelectorAll("#nav .nav-item").forEach(a =>
  a.addEventListener("click", e => { e.preventDefault(); navigate(a.dataset.view); }));
const TITLES = { dashboard:"Dashboard", transactions:"Sales Transactions", income:"Income Management",
  expenses:"Expense Management", customers:"Customer Management", suppliers:"Supplier Management",
  reports:"Financial Reports", budget:"Budget Management", users:"User Management" };
function navigate(v){
  document.querySelectorAll("#nav .nav-item").forEach(a => a.classList.toggle("active", a.dataset.view===v));
  $("#page-title").textContent = TITLES[v] || v;
  $("#today").textContent = new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  ({ dashboard: vDashboard, transactions: vTransactions, income: vIncome, expenses: vExpenses,
     customers: vCustomers, suppliers: vSuppliers, reports: vReports, budget: vBudget,
     users: vUsers })[v]();
}

/* ---------- Shared bits ---------- */
function kpi(label, value, sub="", cls=""){ return `<div class="kpi"><div class="k-label">${label}</div><div class="k-value ${cls}">${value}</div><div class="k-sub">${sub}</div></div>`; }
function barChart(rows, valKey, colorCls=""){
  const max = Math.max(...rows.map(r=>r[valKey]),1);
  return rows.map(r=>`<div class="bar-row"><div class="bar-label">${r.m||r.category||r.name}</div>
    <div class="bar-track"><div class="bar-fill ${colorCls}" style="width:${Math.round(r[valKey]/max*100)}%"></div></div>
    <div class="bar-val">${fmt(r[valKey])}</div></div>`).join("");
}
function totalRev(){ return DB.sales.filter(s=>s.status!=="Refunded").reduce((t,s)=>t+s.items.reduce((a,[pid,q])=>a+DB.products.find(p=>p.id===pid).price*q,0),0); }
function totalExp(){ return DB.expenses.reduce((t,e)=>t+e.amount,0); }

/* ---------- Dashboard ---------- */
function vDashboard(){
  const rev = totalRev()+DB.monthly.at(-1).rev*0; // month-to-date demo
  const exp = totalExp();
  const mtdRev = DB.monthly.at(-1).rev, mtdExp = DB.monthly.at(-1).exp;
  const ar = DB.suppliers.reduce((t,s)=>t+s.balance,0);
  const lowStock = DB.products.filter(p=>p.stock<=p.reorder).length;
  $("#view").innerHTML = `
    <div class="alert info">Prototype view — figures are fictional demonstration data consistent with the report's financial model assumptions.</div>
    <div class="kpi-grid">
      ${kpi("Revenue (Nov MTD)", fmt(mtdRev), "+3.5% vs Oct", "up")}
      ${kpi("Expenses (Nov MTD)", fmt(mtdExp), "incl. salaries & stock", "")}
      ${kpi("Net Position", fmt(mtdRev-mtdExp), "profit before tax", "up")}
      ${kpi("Cash Balance", fmt(145300), "M-Pesa + bank + till", "")}
      ${kpi("Supplier Liabilities", fmt(ar), "amount owed to suppliers", "down")}
      ${kpi("Low-Stock Items", lowStock, "at/below reorder level", lowStock>0?"down":"")}
    </div>
    <div class="two-col">
      <div class="panel"><h3>Revenue vs Expenses — last 6 months</h3>
        <div class="bar-row"><div class="bar-label">Revenue</div><div class="bar-track">${DB.monthly.map(m=>`<div class="bar-fill" style="width:${Math.round(m.rev/208000*100)}%;height:14px;display:inline-block"></div>`).join("")}</div></div>
        ${DB.monthly.map(m=>`<div class="bar-row"><div class="bar-label">${m.m} rev</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(m.rev/208000*100)}%"></div></div><div class="bar-val">${fmt(m.rev)}</div></div>`).join("")}
        ${DB.monthly.map(m=>`<div class="bar-row"><div class="bar-label">${m.m} exp</div><div class="bar-track"><div class="bar-fill exp" style="width:${Math.round(m.exp/208000*100)}%"></div></div><div class="bar-val">${fmt(m.exp)}</div></div>`).join("")}
      </div>
      <div>
        <div class="panel"><h3>VAT position (15%)</h3>
          <p class="small">Output VAT collected (Nov): <b>${fmt(Math.round(mtdRev/1.15*0.15))}</b></p>
          <p class="small">Input VAT claimable: <b>${fmt(Math.round(mtdExp/1.15*0.15))}</b></p>
          <p class="small" style="margin-top:8px">VAT return due <b>20 Dec 2026</b> (RSL). FIS auto-computes from sales &amp; expense records.</p>
        </div>
        <div class="panel"><h3>Alerts</h3>
          <p class="small">⚠ ${lowStock} product(s) below reorder level — generate purchase order.</p>
          <p class="small">⚠ Sale #104 was refunded — pharmacist review recommended.</p>
          <p class="small">✓ All backups verified (last: today 02:00).</p>
        </div>
      </div>
    </div>`;
}

/* ---------- Transactions ---------- */
function saleTotal(s){ return s.items.reduce((t,[pid,q])=>{const p=DB.products.find(p=>p.id===pid);return t+p.price*q;},0); }
function vTransactions(){
  const rows = [...DB.sales].reverse().map(s=>`
    <tr><td class="mono">#${s.id}</td><td>${s.date}</td><td>${esc(s.customer)}</td><td>${esc(s.cashier)}</td>
    <td class="num">${s.items.map(([pid,q])=>q+"× "+esc(productName(pid).slice(0,22))).join("<br>")}</td>
    <td class="num">${fmt(saleTotal(s))}</td>
    <td>${s.payments.map(p=>p.m).join("+")}</td>
    <td><span class="pill ${s.status==='Completed'?'green':'red'}">${s.status}</span></td>
    <td><button class="btn btn-ghost btn-sm" onclick="viewSale(${s.id})">View</button></td></tr>`).join("");
  $("#view").innerHTML = `
    <div class="toolbar"><input type="search" placeholder="Search sale #, customer, cashier…" oninput="filterTx(this.value)">
      <button class="btn btn-primary" onclick="newSale()">+ New Sale</button></div>
    <div class="panel" style="overflow-x:auto"><table id="tx-table"><thead><tr>
      <th>Sale</th><th>Date</th><th>Customer</th><th>Cashier</th><th>Items</th><th class="num">Total</th><th>Payment</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}
function filterTx(q){ q=q.toLowerCase();
  document.querySelectorAll("#tx-table tbody tr").forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(q)?"":"none"); }
function viewSale(id){
  const s = DB.sales.find(x=>x.id===id);
  const lines = s.items.map(([pid,q])=>{const p=DB.products.find(p=>p.id===pid);
    return `<tr><td>${esc(p.name)}</td><td class="num">${q}</td><td class="num">${fmt(p.price)}</td><td class="num">${fmt(p.price*q)}</td></tr>`;}).join("");
  alert(`Sale #${s.id} — ${s.date}\nCustomer: ${s.customer} | Cashier: ${s.cashier}\nStatus: ${s.status}\n\n`+
    s.items.map(([pid,q])=>`  ${q} × ${productName(pid)}`).join("\n")+`\n\nTotal: ${fmt(saleTotal(s))}\nPayments: ${s.payments.map(p=>`${p.m} ${fmt(p.a)}`).join(", ")}`);
}
function newSale(){
  alert("New-sale screen (simulated): scan items → apply loyalty → split payment (Cash / Card / Mobile Money) → pharmacist authorisation for controlled medicines → post to sales & stock_movements tables. In the full system this writes to the same tables shown in the ERD.");
}

/* ---------- Income ---------- */
function vIncome(){
  const byMethod = { Cash:0, Card:0, "Mobile Money":0 };
  DB.sales.forEach(s=>{ if(s.status==="Refunded")return;
    const t=saleTotal(s); s.payments.forEach(p=>byMethod[p.m]=(byMethod[p.m]||0)+p.a); });
  const rows = Object.entries(byMethod).map(([m,a])=>({m,amount:a}));
  $("#view").innerHTML = `
    <div class="kpi-grid">
      ${kpi("Total Recorded Income", fmt(totalRev()+1585), "all posted sales", "up")}
      ${kpi("Card Receipts", fmt(byMethod.Card), "settled T+1", "")}
      ${kpi("Cash Receipts", fmt(byMethod.Cash), "banked daily", "")}
      ${kpi("Mobile Money", fmt(byMethod["Mobile Money"]), "M-Pesa / Orange", "")}
    </div>
    <div class="panel"><h3>Income by channel</h3>${barChart(rows,"amount")}</div>
    <div class="panel"><h3>Recent income events</h3><table><thead><tr><th>Date</th><th>Source</th><th>Reference</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>
      <tr><td>2026-11-19</td><td>POS sales</td><td class="mono">BATCH-1119</td><td class="num pos">${fmt(1290)}</td><td><span class="pill green">Posted</span></td></tr>
      <tr><td>2026-11-18</td><td>POS sales</td><td class="mono">BATCH-1118</td><td class="num pos">${fmt(1585)}</td><td><span class="pill green">Posted</span></td></tr>
      <tr><td>2026-11-15</td><td>Supplier rebate</td><td class="mono">REB-0042</td><td class="num pos">${fmt(850)}</td><td><span class="pill amber">Pending receipt</span></td></tr>
      <tr><td>2026-11-12</td><td>POS sales</td><td class="mono">BATCH-1112</td><td class="num pos">${fmt(1740)}</td><td><span class="pill green">Posted</span></td></tr>
    </tbody></table></div>`;
}

/* ---------- Expenses ---------- */
function vExpenses(){
  const rows = [...DB.expenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`
    <tr><td>${e.date}</td><td>${esc(e.category)}</td><td>${esc(e.desc)}</td>
    <td class="num">${fmt(e.amount)}</td><td>${esc(e.approvedBy)}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="alert('Receipt ${e.receipt_ref||'—'} — scanned image attached in full system.')">Receipt</button></td></tr>`).join("");
  $("#view").innerHTML = `
    <div class="toolbar"><input type="search" placeholder="Search expenses…"><button class="btn btn-primary">+ Record Expense</button></div>
    <div class="kpi-grid">
      ${kpi("Total Expenses (Nov)", fmt(totalExp()), "6 records", "")}
      ${kpi("Largest Item", fmt(68000), "Salaries", "")}
      ${kpi("Awaiting Approval", "M 0", "all approved", "up")}
      ${kpi("Receipts Attached", "6/6", "100%", "up")}
    </div>
    <div class="panel" style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="num">Amount</th><th>Approved by</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------- Customers ---------- */
function vCustomers(){
  const rows = DB.customers.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td class="num">${c.points}</td>
    <td class="num">${DB.sales.filter(s=>s.customer===c.name&&!s.status.includes("Refund")).length} sales</td>
    <td><span class="pill blue">Active</span></td><td><button class="btn btn-ghost btn-sm">Edit</button></td></tr>`).join("");
  $("#view").innerHTML = `<div class="toolbar"><input type="search" placeholder="Search customers…"><button class="btn btn-primary">+ Add Customer</button></div>
    <div class="panel" style="overflow-x:auto"><table><thead><tr><th>Name</th><th>Phone</th><th class="num">Loyalty pts</th><th class="num">Purchases</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------- Suppliers ---------- */
function vSuppliers(){
  const rows = DB.suppliers.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.contact)}</td><td>${esc(s.phone)}</td>
    <td>${esc(s.terms)}</td><td class="num">${fmt(s.balance)}</td>
    <td><span class="pill ${s.balance>15000?'amber':'green'}">${s.balance>15000?'Watch':'OK'}</span></td>
    <td><button class="btn btn-ghost btn-sm">Pay</button></td></tr>`).join("");
  $("#view").innerHTML = `<div class="toolbar"><button class="btn btn-primary">+ Add Supplier</button></div>
    <div class="kpi-grid">${kpi("Total Payables", fmt(DB.suppliers.reduce((t,s)=>t+s.balance,0)), "open supplier balances", "down")}
      ${kpi("Overdue Risk", fmt(18400), "Mediplus — terms 30d", "down")}${kpi("Active Suppliers", "3", "", "up")}</div>
    <div class="panel" style="overflow-x:auto"><table><thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>Terms</th><th class="num">Balance</th><th>Flag</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/* ---------- Reports ---------- */
function vReports(){
  $("#view").innerHTML = `
    <div class="grid-2">
      <div class="panel"><h3>Profit &amp; Loss — November 2026 (summary)</h3>
        <table><tbody>
        <tr><td>Gross sales (excl. refunds)</td><td class="num pos">${fmt(mtdRevSafe())}</td></tr>
        <tr><td>Cost of goods sold (est.)</td><td class="num">(${fmt(Math.round(mtdRevSafe()*0.62))})</td></tr>
        <tr><td><b>Gross profit</b></td><td class="num"><b>${fmt(Math.round(mtdRevSafe()*0.38))}</b></td></tr>
        <tr><td>Operating expenses</td><td class="num">(${fmt(mtdExpSafe())})</td></tr>
        <tr><td><b>Net profit (est.)</b></td><td class="num pos"><b>${fmt(Math.round(mtdRevSafe()*0.38)-mtdExpSafe())}</b></td></tr>
        </tbody></table></div>
      <div class="panel"><h3>Top products by revenue (demo)</h3>
        ${[...DB.products].sort((a,b)=>b.price*b.stock-a.price*a.stock).slice(0,5)
          .map(p=>`<div class="bar-row"><div class="bar-label">${esc(p.name.slice(0,24))}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(p.price*p.stock/40000*100)}%"></div></div>
          <div class="bar-val">${fmt(p.price*p.stock)}</div></div>`).join("")}</div>
    </div>
    <div class="panel"><h3>Export centre</h3>
      <p class="small">Generate: VAT201-style sales summary · P&amp;L · aged payables · stock valuation · audit trail extract.
      Exports respect the logged-in role (cashiers cannot export financial reports).</p>
      <div class="form-actions"><button class="btn btn-primary btn-sm">Export P&amp;L (PDF)</button>
      <button class="btn btn-ghost btn-sm">Export VAT summary (CSV)</button>
      <button class="btn btn-ghost btn-sm">Export audit log (CSV)</button></div></div>`;
}
const mtdRevSafe = ()=>DB.monthly.at(-1).rev;
const mtdExpSafe = ()=>DB.monthly.at(-1).exp;

/* ---------- Budget ---------- */
function vBudget(){
  const rows = DB.budgets.map(b=>{const pct=Math.round(b.actual/b.budget*100);
    return `<tr><td>${esc(b.category)}</td><td class="num">${fmt(b.budget)}</td><td class="num">${fmt(b.actual)}</td>
    <td><div class="bar-track" style="width:160px;display:inline-block;vertical-align:middle"><div class="bar-fill ${pct>100?'exp':''}" style="width:${Math.min(pct,100)}%"></div></div>
    <span class="small"> ${pct}%</span></td>
    <td class="num ${b.actual>b.budget?'neg':'pos'}">${fmt(b.actual-b.budget)}</td></tr>`;}).join("");
  $("#view").innerHTML = `<div class="panel"><h3>Budget vs Actual — November 2026</h3>
    <table><thead><tr><th>Category</th><th class="num">Budget</th><th class="num">Actual</th><th>Utilisation</th><th class="num">Variance</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="panel"><h3>Cash-flow forecast (next 30 days)</h3>
      ${barChart([{m:"Week 1",rev:52000,exp:41000},{m:"Week 2",rev:48000,exp:52000},{m:"Week 3",rev:56000,exp:38000},{m:"Week 4",rev:51000,exp:44000}],"rev")}
      <p class="small" style="margin-top:10px">Projected closing cash ≈ <b>${fmt(145300+ (52000-41000)+(48000-52000)+(56000-38000)+(51000-44000))}</b> — sufficient to meet supplier payments.</p></div>`;
}

/* ---------- Users ---------- */
function vUsers(){
  if(currentUser.role!=="System Administrator"&&currentUser.role!=="Finance Manager"){
    $("#view").innerHTML=`<div class="alert">Access denied — this module requires System Administrator or Finance Manager role (RBAC / least privilege).</div>`;return;
  }
  const rows = DB.users.map(u=>`<tr><td>${esc(u.name)}</td><td class="mono">${esc(u.username)}</td><td>${esc(u.role)}</td>
    <td><span class="pill ${u.active?'green':'red'}">${u.active?'Active':'Disabled'}</span></td>
    <td><button class="btn btn-ghost btn-sm">Edit roles</button> <button class="btn btn-ghost btn-sm">Reset password</button></td></tr>`).join("");
  $("#view").innerHTML = `<div class="panel"><h3>Role-based access control</h3>
    <table><thead><tr><th>User</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="panel"><h3>Permission matrix (summary)</h3>
      <table><thead><tr><th>Capability</th><th>Admin</th><th>Finance Mgr</th><th>Accountant</th><th>Cashier</th><th>Auditor</th></tr></thead><tbody>
      <tr><td>View dashboard/reports</td><td>✔</td><td>✔</td><td>✔</td><td>Limited</td><td>✔</td></tr>
      <tr><td>Record sales/expenses</td><td>✔</td><td>✔</td><td>—</td><td>✔ sales only</td><td>—</td></tr>
      <tr><td>Approve refunds &gt; M500</td><td>✔</td><td>✔</td><td>—</td><td>—</td><td>—</td></tr>
      <tr><td>Manage budgets</td><td>✔</td><td>✔</td><td>—</td><td>—</td><td>—</td></tr>
      <tr><td>Manage users/roles</td><td>✔</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
      <tr><td>Delete records</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
      </tbody></table>
      <p class="small" style="margin-top:8px">Principle: least privilege + separation of duties — no user may both create and delete financial records; all deletions are soft-deletes in audit_logs.</p></div>`;
}

/* ---------- Boot ---------- */
$("#today").textContent = new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
