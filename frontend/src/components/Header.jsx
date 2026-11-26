export default function Header({ title }) {
  return (
    <header className="topbar">
      <h2>{title}</h2>
      <div className="topbar-right">
        <span className="badge">Fictional demo data</span>
        <span>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
      </div>
    </header>
  );
}
