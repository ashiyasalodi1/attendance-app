"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function SelfCheckInPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [event, setEvent] = useState(null);
  const [employeeCode, setEmployeeCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/events/public?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Event not found");
        setEvent(data.event);
      }).catch((err) => setError(err.message));
  }, [slug]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch("/api/self-check-in", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_slug: slug, employee_code: employeeCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not record attendance");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!event && !error) return <main className="page"><p className="subtitle">Loading event...</p></main>;
  if (!event) return <main className="page"><div className="eyebrow">Event unavailable</div><h1 className="title">This check-in QR is not valid</h1><p className="subtitle">{error}</p></main>;
  if (result) return <main className="page"><div className="eyebrow">Attendance recorded</div><h1 className="title">Welcome, {result.name}</h1><p className="subtitle">{result.message}</p><p className="subtitle">You may scan again after 30 minutes.</p></main>;
  return <main className="page"><div className="eyebrow">Welcome to {event.name}</div><h1 className="title">Mark your attendance</h1><p className="subtitle">Enter the employee code used when you registered for this event.</p><form className="card" onSubmit={submit}><div className="field"><label>Employee code</label><input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required autoFocus /></div>{error && <p className="form-error">{error}</p>}<button className="btn" disabled={loading}>{loading ? "Saving..." : "Save attendance"}</button></form></main>;
}
