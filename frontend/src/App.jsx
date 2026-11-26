import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ResourcePage from "./pages/ResourcePage.jsx";
import Customers from "./pages/Customers.jsx";
import PosPage from "./pages/PosPage.jsx";
import CustomerPortal from "./pages/CustomerPortal.jsx";
import DashboardDetail from "./pages/DashboardDetail.jsx";

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div id="main-screen">
      <Sidebar />
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/details/:metric" element={<DashboardDetail />} />
        <Route path="/transactions" element={<PosPage />} />
        <Route path="/income" element={<ResourcePage resource="income" />} />
        <Route path="/expenses" element={<ResourcePage resource="expenses" />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/suppliers" element={<ResourcePage resource="suppliers" />} />
        <Route path="/reports" element={<Dashboard />} />
        <Route path="/budget" element={<ResourcePage resource="budgets" />} />
        <Route path="/users" element={<ResourcePage resource="users" />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/customer-portal/*" element={<CustomerPortal />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
