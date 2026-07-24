"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function SelfCheckInPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [event, setEvent] = useState(null);
  const [employeeCode, setEmployeeCode] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
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
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  async function submit(action) {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch("/api/self-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_slug: slug, employee_code: employeeCode, whatsapp, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not record attendance.");
      setResult(data);
    } catch (err) {
      setError(err.message || "Could not record attendance.");
    } finally {
      setLoading(false);
    }
  }

  if (!event && !error) return <main className="page"><p className="subtitle">Loading event...</p></main>;
  if (!event) return <main className="page"><div className="eyebrow">Event unavailable</div><h1 className="title">This check-in QR is not valid</h1><p className="subtitle">{error}</p></main>;

  return <main className="page"><div className="eyebrow">Welcome to {event.name}</div><h1 className="title">Attendance</h1><p className="subtitle">Enter the Employee Code and WhatsApp number used during registration.</p><form className="card" onSubmit={(e) => e.preventDefault()}><div className="field"><label>Employee Code</label><input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[0-9]+" required autoFocus /></div><div className="field"><label>Registered WhatsApp Number</label><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required /></div>{error && <p className="form-error">{error}</p>}{result && <p className="subtitle"><strong>{result.name}</strong>: {result.action === "check_in" ? "Check-in" : "Check-out"} recorded successfully.</p>}<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn" type="button" disabled={loading} onClick={() => submit("check_in")}>{loading ? "Saving..." : "Check In"}</button><button className="btn" type="button" disabled={loading} onClick={() => submit("check_out")}>{loading ? "Saving..." : "Check Out"}</button></div></form></main>;
}
