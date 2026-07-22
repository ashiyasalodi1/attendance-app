"use client";

import { useState } from "react";
import QRCode from "qrcode";

export default function FormPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, whatsapp, city, event_name: eventName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      const qrDataUrl = await QRCode.toDataURL(data.attendee.id, {
        width: 240,
        margin: 1,
        color: { dark: "#12141c", light: "#f2f0ea" },
      });

      setResult({
        name: data.attendee.name,
        id: data.attendee.id,
        qrDataUrl,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <main className="page">
        <div className="eyebrow">Pass Generated</div>
        <h1 className="title">You're registered</h1>
        <p className="subtitle">
          Save this pass or screenshot it. Show the QR at the door to mark
          your attendance.
        </p>
        <div className="badge">
          <div className="badge-name">{result.name}</div>
          <div className="badge-perf" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.qrDataUrl} alt="QR attendance pass" width={220} height={220} />
          <div className="badge-id">{result.id}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="eyebrow">Step 1 of 2</div>
      <h1 className="title">Register</h1>
      <p className="subtitle">Fill this once to get your QR attendance pass.</p>
      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="field">
          <label>WhatsApp number</label>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
        </div>
        <div className="field">
          <label>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div className="field">
          <label>Event / meeting name</label>
          <input value={eventName} onChange={(e) => setEventName(e.target.value)} required />
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
        <button className="btn" disabled={loading}>
          {loading ? "Generating pass..." : "Get my QR pass"}
        </button>
      </form>
    </main>
  );
}
