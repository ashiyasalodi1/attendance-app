"use client";

import { useEffect, useRef, useState } from "react";

export default function ScanPage() {
  const [status, setStatus] = useState("idle"); // idle | scanning | success | already | error
  const [message, setMessage] = useState("");
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function start() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!isMounted) return;

      const qr = new Html5Qrcode("qr-reader");
      html5QrRef.current = qr;

      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          onScanSuccess,
          () => {}
        );
        setStatus("scanning");
      } catch (err) {
        setStatus("error");
        setMessage("Camera access failed. Check permissions.");
      }
    }

    async function onScanSuccess(decodedText) {
      if (html5QrRef.current) {
        await html5QrRef.current.pause(true);
      }
      try {
        const res = await fetch("/api/mark-attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: decodedText }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "QR not recognized");
        } else if (data.already) {
          setStatus("already");
          setMessage(`${data.name} was already marked present.`);
        } else {
          setStatus("success");
          setMessage(`${data.name} marked present.`);
        }
      } catch (err) {
        setStatus("error");
        setMessage("Network error. Try again.");
      }

      setTimeout(async () => {
        if (html5QrRef.current) {
          await html5QrRef.current.resume();
          setStatus("scanning");
          setMessage("");
        }
      }, 2500);
    }

    start();

    return () => {
      isMounted = false;
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <main className="page">
      <div className="eyebrow">Door Scanner</div>
      <h1 className="title">Scan to check in</h1>
      <p className="subtitle">Point the camera at each attendee's QR pass.</p>

      <div id="qr-reader" ref={scannerRef}></div>

      {message && (
        <span
          className={
            "status-pill " +
            (status === "success"
              ? "status-present"
              : status === "already"
              ? "status-registered"
              : "status-error")
          }
        >
          {message}
        </span>
      )}
    </main>
  );
}
