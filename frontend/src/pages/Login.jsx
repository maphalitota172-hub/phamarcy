import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../services/api.js";

export default function Login() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (registering) {
        const result = await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify(form)
        });
        setNotice(result.message);
        setRegistering(false);
        setForm({ name: "", username: "", password: "" });
      } else {
        await login(form.username, form.password);
      }
    }
    catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="logo">✚</div>
          <h1>Health City Pharmacy</h1>
          <p>Financial Information System</p>
        </div>
        {notice && <div className="alert info">{notice}</div>}
        {error && <div className="alert error">{error}</div>}
        {registering && <>
          <label htmlFor="name">Full name</label>
          <input id="name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} autoComplete="name" required minLength={2} maxLength={80} />
        </>}
        <label htmlFor="username">Username</label>
        <input id="username" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} autoComplete="username" required minLength={3} maxLength={30} />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 10 : 1} maxLength={128} />
        <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Please wait…" : registering ? "Create Account" : "Sign In"}</button>
        <button type="button" className="btn btn-ghost btn-block" disabled={loading} onClick={() => { setRegistering(!registering); setError(""); setNotice(""); setForm({ name: "", username: "", password: "" }); }}>
          {registering ? "Back to sign in" : "Create a new account"}
        </button>
        <p className="demo-note">{registering ? "New accounts receive the Cashier role and require administrator approval before sign-in." : "Use your provisioned employee account. Customer accounts have a separate sign-in."}</p>
        <p className="demo-note"><Link to="/customer-portal">Customer sign in or register</Link></p>
      </form>
    </main>
  );
}
