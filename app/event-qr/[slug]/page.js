"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function createQrPoster(eventName, checkInLink) {
  const qrData = await QRCode.toDataURL(checkInLink, { width: 900, margin: 2 });
  const qrImage = await loadImage(qrData);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1500;
  const context = canvas.getContext("2d");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.fillStyle = "#18202b";
  context.font = "700 42px Arial";
  context.fillText("WELCOME TO EVENT", 600, 105);
  context.fillStyle = "#d78e13";
  context.font = "bold 62px Arial";
  context.fillText(eventName.slice(0, 34), 600, 195);
  context.fillStyle = "#18202b";
  context.font = "32px Arial";
  context.fillText("Scan this QR code to mark your attendance", 600, 270);
  context.fillText("Enter your Employee Code after scanning", 600, 318);
  context.drawImage(qrImage, 150, 390, 900, 900);
  context.fillStyle = "#485564";
  context.font = "28px Arial";
  context.fillText("Please scan again after every 30 minutes", 600, 1375);
  context.fillText("to record your attendance time.", 600, 1418);
  return canvas.toDataURL("image/png");
}

export default function EventQrPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [event, setEvent] = useState(null);
  const [poster, setPoster] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    async function load() {
      try {
        const response = await fetch(`/api/events/public?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Event not found");
        setEvent(data.event);
        setPoster(await createQrPoster(data.event.name, `${window.location.origin}/check-in/${slug}`));
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [slug]);

  if (error) return <main className="page"><h1 className="title">QR unavailable</h1><p className="subtitle">{error}</p></main>;
  if (!event || !poster) return <main className="page"><p className="subtitle">Generating event QR...</p></main>;
  const fileName = `${event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-attendance-qr.png`;
  return <main className="page"><div className="eyebrow">Venue Check-in QR</div><h1 className="title">{event.name}</h1><p className="subtitle">Download and display this QR code at the venue.</p><div style={{ margin: "24px 0" }}><img src={poster} alt={`Attendance QR for ${event.name}`} style={{ width: "min(88vw, 460px)", height: "auto", display: "block", margin: "0 auto" }} /></div><a href={poster} download={fileName} className="btn" style={{ display: "block", width: 220, margin: "0 auto", textAlign: "center", textDecoration: "none" }}>Download QR Code</a></main>;
}
