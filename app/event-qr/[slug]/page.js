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

    async function loadEventQr() {
      try {
        const response = await fetch(
          `/api/events/public?slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Event not found");
        }

        const checkInLink = `${window.location.origin}/check-in/${slug}`;

        const qrImage = await QRCode.toDataURL(checkInLink, {
          width: 700,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });

        setEvent(data.event);
        setQr(qrImage);
      } catch (err) {
        setError(err.message);
      }
    }

    loadEventQr();
  }, [slug]);

  if (error) {
    return (
      <main className="page">
        <h1 className="title">QR unavailable</h1>
        <p className="subtitle">{error}</p>
      </main>
    );
  }

  if (!event || !qr) {
    return (
      <main className="page">
        <p className="subtitle">Generating event QR...</p>
      </main>
    );
  }

  const fileName = `${event.name
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()}-attendance-qr.png`;

  return (
    <main className="page">
      <div className="eyebrow">Venue Check-in QR</div>

      <h1 className="title">{event.name}</h1>

      <p className="subtitle">
        Scan this QR to mark your attendance.
      </p>

      <div style={{ margin: "26px 0 22px" }}>
        <img
          src={qr}
          alt={`Attendance QR for ${event.name}`}
          style={{
            width: "min(78vw, 360px)",
            height: "auto",
            display: "block",
            margin: "0 auto",
            background: "transparent",
            border: "none",
            borderRadius: 0,
            padding: 0,
          }}
        />
      </div>

      <a
        href={qr}
        download={fileName}
        className="btn"
        style={{
          display: "block",
          width: "220px",
          margin: "0 auto",
          textAlign: "center",
          textDecoration: "none",
        }}
      >
        Download QR Code
      </a>
    </main>
  );
}
