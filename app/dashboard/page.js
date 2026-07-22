"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [newEventName, setNewEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  async function loadEvents() {
    const res = await fetch("/api/events", { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Could not load events");

    setEvents(data.events || []);

    if (!selectedEventId && data.events?.length) {
      setSelectedEventId(data.events[0].id);
    }
  }

  async function loadAttendees(isFirstLoad = false) {
    if (!selectedEventId) {
      setAttendees([]);
      setInitialLoading(false);
      return;
    }

    if (isFirstLoad) setInitialLoading(true);

    try {
      const res = await fetch(
        `/api/attendees?event_id=${encodeURIComponent(selectedEventId)}&time=${Date.now()}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Could not load attendees");

      setAttendees(data.attendees || []);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isFirstLoad) setInitialLoading(false);
    }
  }

  useEffect(() => {
    loadEvents()
      .catch((err) => setError(err.message))
      .finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;

    loadAttendees(true);
    const interval = setInterval(() => loadAttendees(false), 5000);

    return () => clearInterval(interval);
  }, [selectedEventId]);

  async function createEvent(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!newEventName.trim()) {
      setError("Enter an event name.");
      return;
    }

    setCreatingEvent(true);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEventName }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Could not create event");

      setEvents((current) => [data.event, ...current]);
      setSelectedEventId(data.event.id);
      setNewEventName("");
      setNotice("Event created. Copy and share the registration link below.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingEvent(false);
    }
  }

  async function copyLink() {
    if (!selectedEvent) return;

    const link = `${window.location.origin}/form/${selectedEvent.slug}`;

    try {
      await navigator.clipboard.writeText(link);
      setNotice("Registration link copied.");
    } catch {
      setError("Could not copy the link. Please copy it from the address bar.");
    }
  }

  async function deleteAttendee(attendee) {
    if (!window.confirm(`Delete ${attendee.name}'s registration permanently?`)) {
      return;
    }

    setDeletingId(attendee.id);

    try {
      const res = await fetch(`/api/attendees/${attendee.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Could not delete attendee");

      if (selected?.id === attendee.id) setSelected(null);

      await loadAttendees(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function downloadReport(status) {
    if (!selectedEventId) return;

    window.location.href =
      `/api/attendees/export?status=${status}` +
      `&event_id=${encodeURIComponent(selectedEventId)}`;
  }

  const presentCount = attendees.filter((a) => a.status === "present").length;
  const registrationLink = selectedEvent
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/form/${selectedEvent.slug}`
    : "";

  return (
    <main className="page">
      <div className="eyebrow">Owner View</div>
      <h1 className="title">Attendance Dashboard</h1>

      <form className="card" onSubmit={createEvent} style={{ maxWidth: 700, marginBottom: 20 }}>
        <div className="field">
          <label>Create new event</label>
          <input
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            placeholder="Example: Tosi Birthday Party"
            required
          />
        </div>

        <button className="btn" disabled={creatingEvent}>
          {creatingEvent ? "Creating event..." : "Create event"}
        </button>
      </form>

      {events.length > 0 && (
        <div className="card" style={{ maxWidth: 700, marginBottom: 20 }}>
          <div className="field">
            <label>Select event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Registration link</label>
            <input value={registrationLink} readOnly />
          </div>

          <button className="view-btn" onClick={copyLink} type="button">
            Copy registration link
          </button>
        </div>
      )}

      {notice && <p style={{ color: "#4ade80", fontSize: 13 }}>{notice}</p>}
      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      {selectedEvent && (
        <>
          <p className="subtitle">
            {presentCount} of {attendees.length} registered attendees have checked in for{" "}
            {selectedEvent.name}.
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

          <div className="card" style={{ maxWidth: 800, overflowX: "auto" }}>
            {initialLoading ? (
              <p style={{ color: "#9aa0b4" }}>Loading...</p>
            ) : attendees.length === 0 ? (
              <p style={{ color: "#9aa0b4" }}>No one has registered for this event yet.</p>
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
        </>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">Attendee</div>
            <h2 className="title" style={{ fontSize: 22 }}>
              {selected.name}
            </h2>

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
