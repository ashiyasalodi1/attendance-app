"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [attendees, setAttendees] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  async function load(isFirstLoad) {
    if (isFirstLoad) setInitialLoading(true);
    const res = await fetch("/api/attendees");
    const data = await res.json();
    setAttendees(data.attendees || []);
    if (isFirstLoad) setInitialLoading(false);
  }

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), 10000);
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
        {initialLoading ? (
          <p style={{ color: "#9aa0b4" }}>Loading...</p>
        ) : attendees.length === 0 ? (
          <p style={{ color: "#9aa0b4" }}>No one has registered yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Check-in time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>
                    <span
                      className={
                        "status-pill " +
                        (a.status === "present" ? "status-present" : "status-absent")
                      }
                    >
                      {a.status === "present" ? "present" : "absent"}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {a.attended_at ? new Date(a.attended_at).toLocaleString() : "—"}
                  </td>
                  <td>
                    <button className="view-btn" onClick={() => setSelected(a)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">Attendee</div>
            <h2 className="title" style={{ fontSize: 22 }}>{selected.name}</h2>
            <div className="modal-row">
              <span className="modal-label">Status</span>
              <span
                className={
                  "status-pill " +
                  (selected.status === "present" ? "status-present" : "status-absent")
                }
              >
                {selected.status === "present" ? "present" : "absent"}
              </span>
            </div>
            <div className="modal-row">
              <span className="modal-label">Email</span>
              <span>{selected.email || "—"}</span>
            </div>
            <div className="modal-row">
              <span className="modal-label">Phone</span>
              <span>{selected.phone || "—"}</span>
            </div>
            <div className="modal-row">
              <span className="modal-label">WhatsApp</span>
              <span>{selected.whatsapp || "—"}</span>
            </div>
            <div className="modal-row">
              <span className="modal-label">City</span>
              <span>{selected.city || "—"}</span>
            </div>
            <div className="modal-row">
              <span className="modal-label">Event</span>
              <span>{selected.event_name || "—"}</span>
            </div>
            <div className="modal-row">
              <span className="modal-label">Registered at</span>
              <span className="mono" style={{ fontSize: 12 }}>
                {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}
              </span>
            </div>
            <div className="modal-row">
              <span className="modal-label">Checked in at</span>
              <span className="mono" style={{ fontSize: 12 }}>
                {selected.attended_at ? new Date(selected.attended_at).toLocaleString() : "—"}
              </span>
            </div>
            <button className="btn" style={{ marginTop: 20 }} onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
