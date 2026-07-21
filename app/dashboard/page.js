"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/attendees");
    const data = await res.json();
    setAttendees(data.attendees || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const presentCount = attendees.filter((a) => a.status === "present").length;

  return (
    <main className="page">
      <div className="eyebrow">Owner View</div>
      <h1 className="title">Attendance Dashboard</h1>
      <p className="subtitle">
        {presentCount} of {attendees.length} registered attendees have checked in.
      </p>

      <div className="card" style={{ maxWidth: 700, overflowX: "auto" }}>
        {loading ? (
          <p style={{ color: "#9aa0b4" }}>Loading...</p>
        ) : attendees.length === 0 ? (
          <p style={{ color: "#9aa0b4" }}>No one has registered yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Event</th>
                <th>Status</th>
                <th>Check-in time</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.event_name || "—"}</td>
                  <td>
                    <span
                      className={
                        "status-pill " +
                        (a.status === "present" ? "status-present" : "status-registered")
                      }
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {a.attended_at ? new Date(a.attended_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
