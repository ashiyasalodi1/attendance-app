"use client";

import { useEffect, useRef, useState } from "react";

function eventSlugFromQr(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/check-in\/([^/]+)$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export default function ScanPage() {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [activeEvent, setActiveEvent] = useState(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function start() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mounted) return;
      const qr = new Html5Qrcode("qr-reader");
      html5QrRef.current = qr;
      try {
        await qr.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, onScanSuccess, () => {});
        setStatus("scanning");
      } catch {
        setStatus("error");
        setMessage("Camera access failed. Check permissions.");
      }
    }
    async function onScanSuccess(decodedText) {
      await html5QrRef.current?.pause(true);
      try {
        const eventSlug = eventSlugFromQr(decodedText);
        if (eventSlug) {
          const response = await fetch(`/api/events/public?slug=${encodeURIComponent(eventSlug)}`);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Event QR is not valid");
          setActiveEvent(data.event);
          setStatus("success");
          setMessage(`Event selected: ${data.event.name}. Now scan attendee QR passes.`);
        } else {
          const response = await fetch("/api/mark-attendance", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: decodedText, event_slug: activeEvent?.slug }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "QR not recognized");
          setStatus(data.already ? "already" : "success");
          setMessage(data.already ? `${data.name} was already present; a new owner scan was recorded.` : `${data.name} checked in.`);
        }
      } catch (error) {
        setStatus("error");
        setMessage(error.message || "QR not recognized");
      }
      setTimeout(async () => {
        await html5QrRef.current?.resume();
        if (mounted) { setStatus("scanning"); setMessage(""); }
      }, 3000);
    }
    start();
    return () => { mounted = false; html5QrRef.current?.stop().catch(() => {}); };
  }, [activeEvent?.slug]);

  return <main className="page"><div className="eyebrow">Owner Only</div><h1 className="title">Scan to check in</h1><p className="subtitle">Scan the event QR first to select an event, then scan attendee QR passes.</p>{activeEvent && <p className="subtitle"><strong>Selected event:</strong> {activeEvent.name}</p>}<div id="qr-reader" />{message && <span className={`status-pill ${status === "success" ? "status-present" : status === "already" ? "status-registered" : "status-error"}`} style={{ fontSize: 16 }}>{message}</span>}</main>;
}
