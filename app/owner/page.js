export default function OwnerPage() {
  return (
    <main className="page">
      <div className="eyebrow">Owner Area</div>
      <h1 className="title">Attendance controls</h1>
      <p className="subtitle">
        Use the scanner at the door or view the current attendance dashboard.
      </p>

      <div className="nav-links">
        <a href="/scan">Scan at door</a>
        <a href="/dashboard">Owner dashboard</a>
      </div>
    </main>
  );
}
