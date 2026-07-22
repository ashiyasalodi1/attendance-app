"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

export default function EventQrPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [event, setEvent] = useState(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!slug) return;
    async function load() {
      try {
        const response = await fetch(`/api/events/public?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Event not found");
        setEvent(data.event);
        setQr(await QRCode.toDataURL(`${window.location.origin}/check-in/${slug}`, { width: 720, margin: 2 }));
      } catch (err) { setError(err.message); }
    }
    load();
  }, [slug]);
  if (error) return <main className="page"><h1 className="title">QR unavailable</h1><p className="subtitle">{error}</p></main>;
  if (!event || !qr) return <main className="page"><p className="subtitle">Generating event QR...</p></main>;
  const checkInLink = `${typeof window === "undefined" ? "" : window.location.origin}/check-in/${slug}`;
  return <main className="page"><div className="eyebrow">Venue Check-in QR</div><h1 className="title">{event.name}</h1><p className="subtitle">Scan this QR to mark your attendance.</p><div className="badge"><img src={qr} alt={`Check-in QR for ${event.name}`} width={360} height={360}/><p className="badge-id">{checkInLink}</p></div><button className="btn" type="button" onClick={() => window.print()}>Print QR</button></main>;
}
