export default function Home() {
  return (
    <main className="page">
      <div className="eyebrow">Attendance System</div>
      <h1 className="title">Meeting Check-In</h1>
      <p className="subtitle">
        Register here to receive your QR pass. Show your QR pass at the door
        to mark your arrival.
      </p>

      <div className="nav-links">
        <a href="/form">Register</a>
      </div>
    </main>
  );
}
