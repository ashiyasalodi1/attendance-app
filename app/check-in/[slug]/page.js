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
    fetch(`/api/events/public?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Event not found");
      setEvent(data.event);
    }).catch((err) => setError(err.message));
  }, [slug]);

  async function submit(event) {
    event.preventDefault(); setError(""); setResult(null);
    if (!/^[6-9]\d{9}$/.test(whatsapp)) return setError("Enter the same 10-digit WhatsApp number used for registration.");
    setLoading(true);
    try {
      const response = await fetch("/api/self-check-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_slug: slug, employee_code: employeeCode, whatsapp }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check in");
      setResult(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  if (!event && !error) return <main className="page"><p className="subtitle">Loading event...</p></main>;
  if (!event) return <main className="page"><div className="eyebrow">Event unavailable</div><h1 className="title">This check-in QR is not valid</h1><p className="subtitle">{error}</p></main>;
  if (result) return <main className="page"><div className="eyebrow">Check-in complete</div><h1 className="title">Welcome, {result.name}</h1><p className="subtitle">{result.already ? "Your attendance was already recorded." : "Your attendance has been recorded successfully."}</p></main>;
  return <main className="page"><div className="eyebrow">Event Self Check-in</div><h1 className="title">{event.name}</h1><p className="subtitle">Enter the same details you used during registration.</p><form className="card" onSubmit={submit}><div className="field"><label>Employee code</label><input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required /></div><div className="field"><label>WhatsApp number</label><input type="tel" inputMode="numeric" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))} pattern="[6-9][0-9]{9}" required /></div>{error && <p className="form-error">{error}</p>}<button className="btn" disabled={loading}>{loading ? "Checking in..." : "Mark my attendance"}</button></form></main>;
}
