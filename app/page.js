export default function Home() {
  return (
    <main className="page">
      <div className="eyebrow">Attendance System</div>
      <h1 className="title">Meeting Check-In</h1>
      <p className="subtitle">
        Share the registration link with attendees. Each person gets a QR
        pass. Scan it at the door to log arrival time.
      </p>
      <div className="nav-links">
        <a href="/form">Register (share this)</a>
        <a href="/scan">Scan at door</a>
        <a href="/dashboard">Owner dashboard</a>
      </div>
    </main>
  );
}
