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
  const [eventSearch, setEventSearch] = useState("");
  const [deletingEventId, setDeletingEventId] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editEventName, setEditEventName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const selectedEvent = events.find(
    (event) => event.id === selectedEventId
  );

  async function loadEvents(selectFirst = false) {
    const res = await fetch(
      `/api/events?time=${Date.now()}`,
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || "Could not load events"
      );
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
          loadedEvents.some(
            (event) => event.id === current
          )
        ) {
          return current;
        }

        return loadedEvents[0].id;
      });
    }
  }

  async function loadAttendees(
    isFirstLoad = false
  ) {
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
          data.error ||
            "Could not load attendees"
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
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

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

    return () => {
      clearInterval(interval);
    };
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
          data.error ||
            "Could not create event"
        );
      }

      setEvents((current) => [
        data.event,
        ...current.filter(
          (event) =>
            event.id !== data.event.id
        ),
      ]);

      setSelectedEventId(data.event.id);
      setNewEventName("");
      setShowCreateModal(false);

      setNotice(
        `"${data.event.name}" created successfully.`
      );

      setTimeout(() => {
        setNotice("");
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingEvent(false);
    }
  }

  async function copyEventLink(event) {
    if (!event) {
      return;
    }

    const link =
      `${window.location.origin}` +
      `/form/${event.slug}`;

    try {
      await navigator.clipboard.writeText(
        link
      );

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
    if (!event) {
      return;
    }

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

    if (!confirmed) {
      return;
    }

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
          data.error ||
            "Could not delete attendee"
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

  function openEditModal(event) {
    if (!event) {
      return;
    }

    setEditingEvent(event);
    setEditEventName(event.name);
    setShowEditModal(true);
  }

  async function updateEvent(e) {
    e.preventDefault();

    if (!editingEvent) {
      return;
    }

    setError("");
    setNotice("");

    if (!editEventName.trim()) {
      setError("Enter an event name.");
      return;
    }

    setSavingEdit(true);

    try {
      const res = await fetch("/api/events", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_id: editingEvent.id,
          name: editEventName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Could not update event"
        );
      }

      setEvents((current) =>
        current.map((event) =>
          event.id === data.event.id
            ? {
                ...event,
                ...data.event,
              }
            : event
        )
      );

      setShowEditModal(false);
      setEditingEvent(null);
      setEditEventName("");

      setNotice(
        `"${data.event.name}" updated successfully.`
      );

      setTimeout(() => {
        setNotice("");
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteEvent(event) {
    if (!event) {
      return;
    }

    const firstConfirm = window.confirm(
      `Delete "${event.name}"?\n\nThis will permanently delete this event and all registrations connected to it.`
    );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm = window.confirm(
      `Final confirmation:\n\n"${event.name}" and all of its attendee data will be permanently deleted. The registration link will also stop working.\n\nContinue?`
    );

    if (!secondConfirm) {
      return;
    }

    setDeletingEventId(event.id);
    setError("");
    setNotice("");

    try {
      const res = await fetch("/api/events", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_id: event.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Could not delete event"
        );
      }

      const remainingEvents =
        events.filter(
          (currentEvent) =>
            currentEvent.id !== event.id
        );

      setEvents(remainingEvents);

      if (selectedEventId === event.id) {
        if (remainingEvents.length > 0) {
          setSelectedEventId(
            remainingEvents[0].id
          );
        } else {
          setSelectedEventId("");
          setAttendees([]);
        }
      }

      setNotice(
        `"${event.name}" deleted successfully.`
      );

      setTimeout(() => {
        setNotice("");
      }, 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingEventId(null);
    }
  }

  function downloadReport(status) {
    if (!selectedEventId) {
      return;
    }

    window.location.href =
      `/api/attendees/export?status=${status}` +
      `&event_id=${encodeURIComponent(
        selectedEventId
      )}`;
  }

  const presentCount = attendees.filter(
    (attendee) =>
      attendee.status === "present"
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

  const filteredEvents = useMemo(() => {
    const query = eventSearch
      .trim()
      .toLowerCase();

    if (!query) {
      return events;
    }

    return events.filter((event) =>
      event.name
        ?.toLowerCase()
        .includes(query)
    );
  }, [events, eventSearch]);

  const filteredAttendees = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLowerCase();

    return attendees.filter(
      (attendee) => {
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

        return (
          matchesStatus && matchesSearch
        );
      }
    );
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
          Dawat E Islami Attendnce
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

  <section
    className="dashboard-intro"
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 20,
      flexWrap: "wrap",
    }}
  >
    <div>
      <h1>Event Management</h1>

      <p>
        Manage registrations, check-ins and reports
      </p>
    </div>

    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        width: "100%",
        maxWidth: 500,
      }}
    >
      <input
        type="search"
        value={eventSearch}
        onChange={(e) =>
          setEventSearch(e.target.value)
        }
        placeholder="Search events..."
        style={{
          flex: 1,
          height: 44,
          background: "#09131f",
          border: "1px solid #334255",
          borderRadius: 8,
          color: "#ffffff",
          padding: "0 15px",
          outline: "none",
        }}
      />

      <button
        type="button"
        className="scan-door-button"
        onClick={() => {
          window.location.href = "/scan";
        }}
      >
        Scan at Door
      </button>
    </div>
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
        ) : filteredEvents.length === 0 ? (
          <div className="empty-events">
            <h2>No matching events</h2>

            <p>
              No events match your current search.
            </p>
          </div>
        ) : (
          <section className="events-grid">
            {filteredEvents.map((event) => {
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
                      type="button"
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
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRegistrationForm(event);
                    }}
                  >
                    Open Form ↗
                  </button>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 10,
                      marginBottom: 14,
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(event);
                      }}
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        background: "transparent",
                        border: "1px solid #334255",
                        borderRadius: 7,
                        color: "#e8a33d",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Edit Event
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEvent(event);
                      }}
                      disabled={
                        deletingEventId === event.id
                      }
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        background:
                          "rgba(255, 93, 93, 0.06)",
                        border:
                          "1px solid rgba(255, 93, 93, 0.45)",
                        borderRadius: 7,
                        color: "#ff7777",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor:
                          deletingEventId === event.id
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          deletingEventId === event.id
                            ? 0.6
                            : 1,
                      }}
                    >
                      {deletingEventId === event.id
                        ? "Deleting..."
                        : "Delete Event"}
                    </button>
                  </div>

                  <div className="event-stats">
                    <div className="event-stat">
                      <div className="stat-icon registered-icon">
                        ◎
                      </div>

                      <div>
                        <strong>
                          {event.registered_count || 0}
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
                  type="button"
                  onClick={() =>
                    downloadReport("present")
                  }
                >
                  ↓ Download Present
                </button>

                <button
                  className="report-button absent-report"
                  type="button"
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
                  type="button"
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
                            <div className="attendee-name-cell">
                              {attendee.photo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={
                                    attendee.photo_url
                                  }
                                  alt={
                                    attendee.name
                                  }
                                  className="attendee-avatar"
                                />
                              ) : (
                                <div className="attendee-avatar-placeholder">
                                  {attendee.name
                                    ?.charAt(0)
                                    ?.toUpperCase() ||
                                    "?"}
                                </div>
                              )}

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
                            {attendee.city || "—"}
                          </td>

                          <td>
                            <span
                              className={`dashboard-status ${
                                attendee.status ===
                                "present"
                                  ? "dashboard-status-present"
                                  : "dashboard-status-absent"
                              }`}
                            >
                              {attendee.status ===
                              "present"
                                ? "Present"
                                : "Absent"}
                            </span>
                          </td>

                          <td>
                            <span className="checkin-time">
                              {attendee.attended_at
                                ? new Date(
                                    attendee.attended_at
                                  ).toLocaleString()
                                : "—"}
                            </span>
                          </td>

                          <td>
                            <div className="table-actions">
                              <button
                                className="table-view-button"
                                type="button"
                                onClick={() =>
                                  setSelected(
                                    attendee
                                  )
                                }
                              >
                                View
                              </button>

                              <button
                                className="table-delete-button"
                                type="button"
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
          onClick={() => {
            if (!creatingEvent) {
              setShowCreateModal(false);
            }
          }}
        >
          <div
            className="modal-card"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="eyebrow">
              New Event
            </div>

            <h2
              className="title"
              style={{
                fontSize: 24,
                marginBottom: 8,
              }}
            >
              Create Event
            </h2>

            <p
              style={{
                color: "#9aa0b4",
                fontSize: 13,
                lineHeight: 1.6,
                marginTop: 0,
                marginBottom: 20,
              }}
            >
              Create a new event and generate
              its unique registration link.
            </p>

            <form onSubmit={createEvent}>
              <div className="field">
                <label>Event name</label>

                <input
                  value={newEventName}
                  onChange={(e) =>
                    setNewEventName(
                      e.target.value
                    )
                  }
                  placeholder="Example: Ahmedabad Meeting"
                  autoFocus
                  required
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 20,
                }}
              >
                <button
                  type="button"
                  className="view-btn"
                  style={{
                    flex: 1,
                    padding: 12,
                  }}
                  onClick={() => {
                    if (!creatingEvent) {
                      setShowCreateModal(
                        false
                      );
                      setNewEventName("");
                    }
                  }}
                  disabled={creatingEvent}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn"
                  style={{
                    flex: 1,
                  }}
                  disabled={creatingEvent}
                >
                  {creatingEvent
                    ? "Creating..."
                    : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EVENT MODAL */}

      {showEditModal &&
        editingEvent && (
          <div
            className="modal-overlay"
            onClick={() => {
              if (!savingEdit) {
                setShowEditModal(false);
                setEditingEvent(null);
                setEditEventName("");
              }
            }}
          >
            <div
              className="modal-card"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="eyebrow">
                Edit Event
              </div>

              <h2
                className="title"
                style={{
                  fontSize: 24,
                  marginBottom: 8,
                }}
              >
                Rename Event
              </h2>

              <p
                style={{
                  color: "#9aa0b4",
                  fontSize: 13,
                  lineHeight: 1.6,
                  marginTop: 0,
                  marginBottom: 20,
                }}
              >
                Update the event name. The
                existing registration link will
                remain unchanged.
              </p>

              <form onSubmit={updateEvent}>
                <div className="field">
                  <label>Event name</label>

                  <input
                    value={editEventName}
                    onChange={(e) =>
                      setEditEventName(
                        e.target.value
                      )
                    }
                    placeholder="Enter event name"
                    autoFocus
                    required
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 20,
                  }}
                >
                  <button
                    type="button"
                    className="view-btn"
                    style={{
                      flex: 1,
                      padding: 12,
                    }}
                    onClick={() => {
                      if (!savingEdit) {
                        setShowEditModal(false);
                        setEditingEvent(null);
                        setEditEventName("");
                      }
                    }}
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn"
                    style={{
                      flex: 1,
                    }}
                    disabled={savingEdit}
                  >
                    {savingEdit
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* ATTENDEE DETAILS MODAL */}

      {selected && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelected(null)
          }
        >
          <div
            className="modal-card"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="eyebrow">
              Attendee
            </div>

            {selected.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.photo_url}
                alt={selected.name}
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: "50%",
                  objectFit: "cover",
                  display: "block",
                  margin: "10px auto 20px",
                  border:
                    "3px solid var(--amber)",
                }}
              />
            )}

            <h2
              className="title"
              style={{
                fontSize: 22,
              }}
            >
              {selected.name}
            </h2>

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
                Division
              </span>

              <span>
                {selected.city || "—"}
              </span>
            </div>

            <div className="modal-row">
              <span className="modal-label">
                Status
              </span>

              <span
                className={
                  selected.status === "present"
                    ? "status-present"
                    : "status-absent"
                }
              >
                {selected.status === "present"
                  ? "Present"
                  : "Absent"}
              </span>
            </div>

            <div className="modal-row">
              <span className="modal-label">
                Registered at
              </span>

              <span
                className="mono"
                style={{
                  fontSize: 12,
                }}
              >
                {selected.created_at
                  ? new Date(
                      selected.created_at
                    ).toLocaleString()
                  : "—"}
              </span>
            </div>

            <div className="modal-row">
              <span className="modal-label">
                Checked in at
              </span>

              <span
                className="mono"
                style={{
                  fontSize: 12,
                }}
              >
                {selected.attended_at
                  ? new Date(
                      selected.attended_at
                    ).toLocaleString()
                  : "—"}
              </span>
            </div>

            <button
              className="btn"
              type="button"
              style={{
                marginTop: 20,
              }}
              onClick={() =>
                setSelected(null)
              }
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
