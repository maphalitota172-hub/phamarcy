import { Link } from "react-router-dom";

export default function KpiCard({ label, value, sub, tone }) {
  return (
    <Link className="kpi kpi-link" to={`/dashboard/details/${label.toLowerCase().replaceAll(" ", "-")}`} aria-label={`View details for ${label}`}>
      <div className="k-label">{label}</div>
      <div className={`k-value ${tone || ""}`}>{value}</div>
      {sub && <div className="k-sub">{sub}</div>}
      <div className="kpi-link-hint">View details →</div>
    </Link>
  );
}
