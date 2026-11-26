import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const links = [
  ["dashboard", "▦", "Dashboard"],
  ["transactions", "⇄", "Transactions"],
  ["income", "↗", "Income"],
  ["expenses", "↘", "Expenses"],
  ["customers", "☺", "Customers"],
  ["suppliers", "⌂", "Suppliers"],
  ["reports", "◫", "Reports"],
  ["budget", "◔", "Budget"]
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const canManageUsers = user?.role === "System Administrator";
  return (
    <aside className="sidebar">
      <div className="side-brand"><span className="logo-sm">✚</span> Health City FIS</div>
      <nav className="nav">
        {links.map(([path, icon, label]) => (
          <NavLink key={path} to={`/${path}`} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span>{icon}</span> {label}
          </NavLink>
        ))}
        {canManageUsers && <NavLink to="/users" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}><span>⚿</span> Users & Roles</NavLink>}
      </nav>
      <div className="side-foot">
        <div className="user-chip">{user.name}<br /><span>{user.role}</span></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
      </div>
    </aside>
  );
}
