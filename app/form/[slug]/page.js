"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

export default function EventFormPage() {
  const params = useParams();
  const eventSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const [event, setEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(
          `/api/events/public?slug=${encodeURIComponent(eventSlug)}`,
          { cache: "no-store" }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Event not found");
        }

        setEvent(data.event);
      } catch (err) {
        setError(err.message);
      } finally {
        setEventLoading(false);
      }
    }

    if (eventSlug) loadEvent();
  }, [eventSlug]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!/^[6-9]\d{9}$/.test(whatsapp)) {
      setError("Enter a valid 10-digit WhatsApp number.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          whatsapp,
          city,
          event_slug: eventSlug,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

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

  if (eventLoading) {
    return (
      <main className="page">
        <p className="subtitle">Loading event...</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="page">
        <div className="eyebrow">Event unavailable</div>
        <h1 className="title">This registration link is not valid</h1>
        <p className="subtitle">{error || "Please ask the organizer for the correct link."}</p>
      </main>
    );
  }

  if (result) {
    return (
      <main className="page">
        <div className="eyebrow">Pass Generated</div>
        <h1 className="title">You&apos;re registered</h1>
        <p className="subtitle">
          {event.name}. Save this pass and show the QR at the door.
        </p>

        <div className="badge">
          <div className="badge-name">{result.name}</div>
          <div className="badge-perf" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.qrDataUrl}
            alt="QR attendance pass"
            width={220}
            height={220}
          />
          <div className="badge-id">{result.id}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="eyebrow">Event Registration</div>
      <h1 className="title">{event.name}</h1>
      <p className="subtitle">Fill all details to get your QR attendance pass.</p>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="field">
          <label>Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@gmail.com"
            required
          />
        </div>

        <div className="field">
          <label>WhatsApp number</label>
          <input
            type="tel"
            inputMode="numeric"
            value={whatsapp}
            onChange={(e) =>
              setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="10-digit mobile number"
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            required
          />
        </div>

        <div className="field">
          <label>Division</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

        <button className="btn" disabled={loading}>
          {loading ? "Generating pass..." : "Get my QR pass"}
        </button>
      </form>
    </main>
  );
}
