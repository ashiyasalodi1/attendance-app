"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function ScanSummary({ summary }) {
  if (!summary) return null;
  return <div className="card" style={{ marginTop: 18 }}><div className="field"><strong>Total confirmation scans: {summary.count}</strong></div><p className="subtitle">First scan: {formatTime(summary.first_scan)} · Last scan: {formatTime(summary.last_scan)}</p>{summary.history?.length > 0 && <p className="subtitle">Scan history: {summary.history.map(formatTime).join(", ")}</p>}</div>;
}

export default function SelfCheckInPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [event, setEvent] = useState(null);
  const [employeeCode, setEmployeeCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/events/public?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Event not found");
      setEvent(data.event);
    }).catch((err) => setError(err.message));
  }, [slug]);

  async function submit(action) {
    setError(""); setResult(null); setLoading(true);
    try {
      const response = await fetch("/api/self-check-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_slug: slug, employee_code: employeeCode, action }) });
      const data = await response.json();
      setSummary(data.summary || null);
      if (!response.ok) throw new Error(data.error || "Could not record attendance");
      setResult(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  if (!event && !error) return <main className="page"><p className="subtitle">Loading event...</p></main>;
  if (!event) return <main className="page"><div className="eyebrow">Event unavailable</div><h1 className="title">This check-in QR is not valid</h1><p className="subtitle">{error}</p></main>;
  return <main className="page"><div className="eyebrow">Welcome to {event.name}</div><h1 className="title">Attendance</h1><p className="subtitle">Enter your registered Employee Code. Confirm Presence becomes available every 30 minutes.</p><form className="card" onSubmit={(e) => e.preventDefault()}><div className="field"><label>Employee code</label><input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required autoFocus /></div>{error && <p className="form-error">{error}</p>}{result && <p className="subtitle">{result.action === "check_in" ? "Check-in recorded." : result.action === "check_out" ? "Check-out recorded." : "Presence confirmed."}</p>}<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn" type="button" disabled={loading} onClick={() => submit("check_in")}>Check in</button><button className="btn" type="button" disabled={loading} onClick={() => submit("confirm")}>Confirm presence</button><button className="btn" type="button" disabled={loading} onClick={() => submit("check_out")}>Check out</button></div></form><ScanSummary summary={summary} /></main>;
}
