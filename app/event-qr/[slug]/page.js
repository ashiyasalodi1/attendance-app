"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

export default function EventQrPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const [qr, setQr] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;

    async function generateQr() {
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
          width: 900,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });

        setQr(qrImage);
      } catch (err) {
        setError(err.message);
      }
    }

    generateQr();
  }, [slug]);

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial", color: "#111" }}>
        QR unavailable: {error}
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
      }}
    >
      {qr && (
        <img
          src={qr}
          alt="Event attendance QR code"
          style={{
            width: "min(82vw, 650px)",
            height: "auto",
            display: "block",
          }}
        />
      )}
    </main>
  );
}
