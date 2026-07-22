"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [attendees, setAttendees] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  async function load(isFirstLoad) {
    if (isFirstLoad) setInitialLoading(true);

    try {
      const res = await fetch(`/api/attendees?time=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not load attendees");
      }

      setAttendees(data.attendees || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      if (isFirstLoad) setInitialLoading(false);
    }
  }

  useEffect(() => {
    load(true);

    const interval = setInterval(() => load(false), 5000);

    return () => clearInterval(interval);
  }, []);

  async function deleteAttendee(attendee) {
    const confirmed = window.confirm(
      `Delete ${attendee.name}'s registration permanently?`
    );

    if (!confirmed) return;

    setDeletingId(attendee.id);
    setError("");

    try {
      const res = await fetch(`/api/attendees/${attendee.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not delete attendee");
      }

      if (selected?.id === attendee.id) {
        setSelected(null);
      }

      await load(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function downloadReport(status) {
    window.location.href = `/api/attendees/export?status=${status}`;
  }

  const presentCount = attendees.filter((a) => a.status === "present").length;

  return (
    <main className="page">
      <div className="eyebrow">Owner View</div>
      <h1 className="title">Attendance Dashboard</h1>
      <p className="subtitle">
        {presentCount} of {attendees.length} registered attendees have checked in.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <button className="view-btn" onClick={() => downloadReport("present")}>
          Download Present
        </button>

        <button className="view-btn" onClick={() => downloadReport("absent")}>
          Download Absent
        </button>
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      <div className="card" style={{ maxWidth: 800, overflowX: "auto" }}>
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
                <th>Actions</th>
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
                        (a.status === "present"
                          ? "status-present"
                          : "status-absent")
                      }
                    >
                      {a.status === "present" ? "present" : "absent"}
                    </span>
                  </td>

                  <td className="mono" style={{ fontSize: 12 }}>
                    {a.attended_at
                      ? new Date(a.attended_at).toLocaleString()
                      : "—"}
                  </td>

                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="view-btn" onClick={() => setSelected(a)}>
                        View
                      </button>

                      <button
                        className="view-btn"
                        onClick={() => deleteAttendee(a)}
                        disabled={deletingId === a.id}
                        style={{ color: "#f87171" }}
                      >
                        {deletingId === a.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
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
            <h2 className="title" style={{ fontSize: 22 }}>
              {selected.name}
            </h2>

            <div className="modal-row">
              <span className="modal-label">Status</span>
              <span
                className={
                  "status-pill " +
                  (selected.status === "present"
                    ? "status-present"
                    : "status-absent")
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
              <span className="modal-label">WhatsApp</span>
              <span>{selected.whatsapp || "—"}</span>
            </div>

            <div className="modal-row">
              <span className="modal-label">City</span>
              <span>{selected.city || "—"}</span>
            </div>

            <div className="modal-row">
              <span className="modal-label">Registered at</span>
              <span className="mono" style={{ fontSize: 12 }}>
                {selected.created_at
                  ? new Date(selected.created_at).toLocaleString()
                  : "—"}
              </span>
            </div>

            <div className="modal-row">
              <span className="modal-label">Checked in at</span>
              <span className="mono" style={{ fontSize: 12 }}>
                {selected.attended_at
                  ? new Date(selected.attended_at).toLocaleString()
                  : "—"}
              </span>
            </div>

            <button
              className="btn"
              style={{ marginTop: 20 }}
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
