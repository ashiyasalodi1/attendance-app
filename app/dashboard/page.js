"use client";

import { useEffect, useMemo, useState } from "react";

export default function DashboardPage() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendees, setAttendees] = useState([]);

  const [newEventName, setNewEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const selectedEvent = events.find(
    (event) => event.id === selectedEventId
  );

  async function loadEvents(selectFirst = false) {
    const res = await fetch(`/api/events?time=${Date.now()}`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Could not load events");
    }

    const loadedEvents = data.events || [];

    setEvents(loadedEvents);

    if (
      (selectFirst || !selectedEventId) &&
      loadedEvents.length > 0
    ) {
      setSelectedEventId((current) => {
        if (
          current &&
          loadedEvents.some((event) => event.id === current)
        ) {
          return current;
        }

        return loadedEvents[0].id;
      });
    }
  }

  async function loadAttendees(isFirstLoad = false) {
    if (!selectedEventId) {
      setAttendees([]);
      setInitialLoading(false);
      return;
    }

    if (isFirstLoad) {
      setInitialLoading(true);
    }

    try {
      const res = await fetch(
        `/api/attendees?event_id=${encodeURIComponent(
          selectedEventId
        )}&time=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Could not load attendees"
        );
      }

      setAttendees(data.attendees || []);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isFirstLoad) {
        setInitialLoading(false);
      }
    }
  }

  useEffect(() => {
    loadEvents(true)
      .catch((err) => setError(err.message))
      .finally(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;

    setSearchQuery("");
    setStatusFilter("all");

    loadAttendees(true);

    const interval = setInterval(async () => {
      await loadAttendees(false);

      try {
        await loadEvents(false);
      } catch (err) {
        console.error(err);
      }
    }, 5000);

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newEventName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Could not create event"
        );
      }

      setEvents((current) => [
        data.event,
        ...current.filter(
          (event) => event.id !== data.event.id
        ),
      ]);

      setSelectedEventId(data.event.id);
      setNewEventName("");
      setShowCreateModal(false);

      setNotice(
        `"${data.event.name}" created successfully.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingEvent(false);
    }
  }

  async function copyEventLink(event) {
    if (!event) return;

    const link = `${window.location.origin}/form/${event.slug}`;

    try {
      await navigator.clipboard.writeText(link);

      setNotice(
        `${event.name} registration link copied.`
      );

      setTimeout(() => {
        setNotice("");
      }, 3000);
    } catch {
      setError(
        "Could not copy the registration link."
      );
    }
  }

  function openRegistrationForm(event) {
    if (!event) return;

    window.open(
      `/form/${event.slug}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function selectEvent(eventId) {
    setSelectedEventId(eventId);

    setTimeout(() => {
      document
        .getElementById("event-details")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  }

  async function deleteAttendee(attendee) {
    const confirmed = window.confirm(
      `Delete ${attendee.name}'s registration permanently?`
    );

    if (!confirmed) return;

    setDeletingId(attendee.id);
    setError("");

    try {
      const res = await fetch(
        `/api/attendees/${attendee.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Could not delete attendee"
        );
      }

      if (selected?.id === attendee.id) {
        setSelected(null);
      }

      await loadAttendees(false);
      await loadEvents(false);

      setNotice(
        `${attendee.name}'s registration deleted.`
      );

      setTimeout(() => {
        setNotice("");
      }, 3000);
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
      `&event_id=${encodeURIComponent(
        selectedEventId
      )}`;
  }

  const presentCount = attendees.filter(
    (attendee) => attendee.status === "present"
  ).length;

  const absentCount =
    attendees.length - presentCount;

  const registrationLink = selectedEvent
    ? `${
        typeof window !== "undefined"
          ? window.location.origin
          : ""
      }/form/${selectedEvent.slug}`
    : "";

  const filteredAttendees = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLowerCase();

    return attendees.filter((attendee) => {
      const attendeeStatus =
        attendee.status === "present"
          ? "present"
          : "absent";

      const matchesStatus =
        statusFilter === "all" ||
        attendeeStatus === statusFilter;

      const searchableText = [
        attendee.name,
        attendee.email,
        attendee.phone,
        attendee.whatsapp,
        attendee.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        searchableText.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [
    attendees,
    searchQuery,
    statusFilter,
  ]);

  return (
    <main className="dashboard-page">
      {/* HEADER */}

      <header className="dashboard-header">
        <div className="dashboard-brand">
          ATTENDANCE HUB
        </div>

        <button
          className="create-event-button"
          onClick={() =>
            setShowCreateModal(true)
          }
        >
          <span className="button-plus">+</span>
          Create Event
        </button>
      </header>

      <div className="dashboard-container">
        {/* PAGE TITLE */}

        <section className="dashboard-intro">
          <h1>Event Management</h1>

          <p>
            Manage registrations, check-ins and
            reports
          </p>
        </section>

        {/* NOTICES */}

        {notice && (
          <div className="dashboard-notice success-notice">
            {notice}
          </div>
        )}

        {error && (
          <div className="dashboard-notice error-notice">
            {error}
          </div>
        )}

        {/* EVENTS */}

        {events.length === 0 &&
        !initialLoading ? (
          <div className="empty-events">
            <h2>No events yet</h2>

            <p>
              Create your first event to generate a
              registration link.
            </p>

            <button
              className="create-event-button"
              onClick={() =>
                setShowCreateModal(true)
              }
            >
              + Create Event
            </button>
          </div>
        ) : (
          <section className="events-grid">
            {events.map((event) => {
              const eventLink =
                typeof window !== "undefined"
                  ? `${window.location.origin}/form/${event.slug}`
                  : `/form/${event.slug}`;

              const isActive =
                selectedEventId === event.id;

              return (
                <article
                  key={event.id}
                  className={`event-card ${
                    isActive
                      ? "event-card-selected"
                      : ""
                  }`}
                  onClick={() =>
                    selectEvent(event.id)
                  }
                >
                  <div className="event-card-top">
                    <h2>{event.name}</h2>

                    <span className="active-badge">
                      <span className="active-dot" />
                      Active
                    </span>
                  </div>

                  <label className="event-label">
                    Registration Link
                  </label>

                  <div className="event-link-row">
                    <div className="event-link">
                      {eventLink}
                    </div>

                    <button
                      className="copy-link-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyEventLink(event);
                      }}
                    >
                      ⧉ Copy Link
                    </button>
                  </div>

                  <button
                    className="open-form-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRegistrationForm(event);
                    }}
                  >
                    Open Form ↗
                  </button>

                  <div className="event-stats">
                    <div className="event-stat">
                      <div className="stat-icon registered-icon">
                        ◎
                      </div>

                      <div>
                        <strong>
                          {event.registered_count ||
                            0}
                        </strong>
                        <span>Registered</span>
                      </div>
                    </div>

                    <div className="event-stat">
                      <div className="stat-icon present-icon">
                        ✓
                      </div>

                      <div>
                        <strong>
                          {event.present_count || 0}
                        </strong>
                        <span>Present</span>
                      </div>
                    </div>

                    <div className="event-stat">
                      <div className="stat-icon absent-icon">
                        ×
                      </div>

                      <div>
                        <strong>
                          {event.absent_count || 0}
                        </strong>
                        <span>Absent</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* SELECTED EVENT DETAILS */}

        {selectedEvent && (
          <section
            className="event-details-panel"
            id="event-details"
          >
            <div className="event-details-header">
              <div>
                <h2>{selectedEvent.name}</h2>
              </div>

              <div className="report-buttons">
                <button
                  className="report-button present-report"
                  onClick={() =>
                    downloadReport("present")
                  }
                >
                  ↓ Download Present
                </button>

                <button
                  className="report-button absent-report"
                  onClick={() =>
                    downloadReport("absent")
                  }
                >
                  ↓ Download Absent
                </button>
              </div>
            </div>

            {/* REGISTRATION LINK */}

            <div className="details-link-section">
              <span>Registration Link</span>

              <div className="details-link-box">
                <input
                  value={registrationLink}
                  readOnly
                />

                <button
                  onClick={() =>
                    copyEventLink(selectedEvent)
                  }
                >
                  ⧉
                </button>
              </div>
            </div>

            {/* SUMMARY + SEARCH */}

            <div className="event-summary-row">
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="summary-icon registered-icon">
                    ◎
                  </div>

                  <div>
                    <strong>
                      {attendees.length}
                    </strong>
                    <span>Registered</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon present-icon">
                    ✓
                  </div>

                  <div>
                    <strong>
                      {presentCount}
                    </strong>
                    <span>Present</span>
                  </div>
                </div>

                <div className="summary-card">
                  <div className="summary-icon absent-icon">
                    ×
                  </div>

                  <div>
                    <strong>
                      {absentCount}
                    </strong>
                    <span>Absent</span>
                  </div>
                </div>
              </div>

              <div className="table-controls">
                <div className="search-box">
                  <span>⌕</span>

                  <input
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(
                        e.target.value
                      )
                    }
                    placeholder="Search by name, city or WhatsApp..."
                  />
                </div>

                <select
                  className="status-filter"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value
                    )
                  }
                >
                  <option value="all">
                    All
                  </option>

                  <option value="present">
                    Present
                  </option>

                  <option value="absent">
                    Absent
                  </option>
                </select>
              </div>
            </div>

            {/* ATTENDEES TABLE */}

            <div className="attendees-table-wrapper">
              {initialLoading ? (
                <div className="table-empty">
                  Loading attendees...
                </div>
              ) : attendees.length === 0 ? (
                <div className="table-empty">
                  No one has registered for this
                  event yet.
                </div>
              ) : filteredAttendees.length ===
                0 ? (
                <div className="table-empty">
                  No attendees match your search.
                </div>
              ) : (
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>WhatsApp</th>
                      <th>City</th>
                      <th>Status</th>
                      <th>Check-in time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAttendees.map(
                      (attendee) => (
                        <tr key={attendee.id}>
                          <td>
                            <div className="attendee-name">
                              <div className="attendee-avatar">
                                {attendee.name
                                  ?.split(" ")
                                  .map(
                                    (word) =>
                                      word[0]
                                  )
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>

                              <span>
                                {attendee.name}
                              </span>
                            </div>
                          </td>

                          <td>
                            {attendee.whatsapp ||
                              "—"}
                          </td>

                          <td>
                            {attendee.city ||
                              "—"}
                          </td>

                          <td>
                            <span
                              className={`dashboard-status ${
                                attendee.status ===
                                "present"
                                  ? "dashboard-present"
                                  : "dashboard-absent"
                              }`}
                            >
                              <span />
                              {attendee.status ===
                              "present"
                                ? "Present"
                                : "Absent"}
                            </span>
                          </td>

                          <td>
                            {attendee.attended_at
                              ? new Date(
                                  attendee.attended_at
                                ).toLocaleString()
                              : "—"}
                          </td>

                          <td>
                            <div className="table-actions">
                              <button
                                className="table-view-button"
                                onClick={() =>
                                  setSelected(
                                    attendee
                                  )
                                }
                              >
                                ◉ View
                              </button>

                              <button
                                className="table-delete-button"
                                onClick={() =>
                                  deleteAttendee(
                                    attendee
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  attendee.id
                                }
                              >
                                {deletingId ===
                                attendee.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </div>

      {/* CREATE EVENT MODAL */}

      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShowCreateModal(false)
          }
        >
          <div
            className="create-event-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="modal-heading-row">
              <div>
                <div className="eyebrow">
                  New Event
                </div>

                <h2>Create Event</h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowCreateModal(false)
                }
              >
                ×
              </button>
            </div>

            <form onSubmit={createEvent}>
              <div className="dashboard-field">
                <label>Event Name</label>

                <input
                  autoFocus
                  value={newEventName}
                  onChange={(e) =>
                    setNewEventName(
                      e.target.value
                    )
                  }
                  placeholder="Example: Tosi Birthday Party"
                  required
                />
              </div>

              <button
                className="modal-create-button"
                disabled={creatingEvent}
              >
                {creatingEvent
                  ? "Creating Event..."
                  : "Create Event"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ATTENDEE MODAL */}

      {selected && (
        <div
          className="modal-overlay"
          onClick={() => setSelected(null)}
        >
          <div
            className="modal-card"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="modal-heading-row">
              <div>
                <div className="eyebrow">
                  Attendee
                </div>

                <h2>{selected.name}</h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setSelected(null)
                }
              >
                ×
              </button>
            </div>

            <div className="modal-row">
              <span className="modal-label">
                Email
              </span>

              <span>
                {selected.email || "—"}
              </span>
            </div>

            <div className="modal-row">
              <span className="modal-label">
                Phone
              </span>

              <span>
                {selected.phone || "—"}
              </span>
            </div>

            <div className="modal-row">
              <span className="modal-label">
                WhatsApp
              </span>

              <span>
                {selected.whatsapp || "—"}
              </span>
            </div>

            <div className="modal-row">
              <span className="modal-label">
                City
              </span>

              <span>
                {selected.city || "—"}
              </span>
            </div>

            <div className="modal-row">
              <span className="modal-label">
                Registered
              </span>

              <span>
                {selected.created_at
                  ? new Date(
                      selected.created_at
                    ).toLocaleString()
                  : "—"}
              </span>
            </div>

            <div className="modal-row">
              <span className="modal-label">
                Check-in
              </span>

              <span>
                {selected.attended_at
                  ? new Date(
                      selected.attended_at
                    ).toLocaleString()
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
