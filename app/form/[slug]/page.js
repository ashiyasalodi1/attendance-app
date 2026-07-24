"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
);

export default function EventFormPage() {
  const params = useParams();
  const eventSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [event, setEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [division, setDivision] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [pendingPasskey, setPendingPasskey] = useState(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  useEffect(() => {
    if (!eventSlug) return;
    async function loadEvent() {
      try {
        const res = await fetch(`/api/events/public?slug=${encodeURIComponent(eventSlug)}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Event not found");
        setEvent(data.event);
      } catch (err) {
        setError(err.message);
      } finally {
        setEventLoading(false);
      }
    }
    loadEvent();
  }, [eventSlug]);

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    setPhotoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("Image must be under 2MB.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!/^[6-9]\d{9}$/.test(whatsapp)) {
      setError("Enter a valid 10-digit WhatsApp number.");
      return;
    }
    setLoading(true);
    try {
      let photoUrl = "";
      if (photoFile) {
        const extension = photoFile.name.split(".").pop() || "jpg";
        const fileName = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("attendee-photos").upload(fileName, photoFile);
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
        photoUrl = supabase.storage.from("attendee-photos").getPublicUrl(fileName).data.publicUrl;
      }
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, employee_code: employeeCode, whatsapp, division, photo_url: photoUrl, event_slug: eventSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      await setupPasskey(data.attendee, photoUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function setupPasskey(attendee, savedPhotoUrl) {
    setError("");
    setPasskeyLoading(true);
    try {
      const optionsResponse = await fetch("/api/passkeys/registration-options", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendee_id: attendee.id }),
      });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(options.error || "Could not start Face ID/Fingerprint setup.");
      const optionsJSON = { ...options };
      delete optionsJSON.attendee_id;
      const { startRegistration } = await import("@simplewebauthn/browser");
      const passkeyResponse = await startRegistration({ optionsJSON });
      const verifyResponse = await fetch("/api/passkeys/registration-verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendee_id: attendee.id, response: passkeyResponse }),
      });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok || !verified.verified) throw new Error(verified.error || "Face ID/Fingerprint setup was not completed.");
      const qrDataUrl = await QRCode.toDataURL(attendee.id, { width: 240, margin: 1, color: { dark: "#12141c", light: "#f2f0ea" } });
      setResult({ name: attendee.name, id: attendee.id, qrDataUrl, photoUrl: savedPhotoUrl });
      setPendingPasskey(null);
    } catch (err) {
      setPendingPasskey({ attendee, photoUrl: savedPhotoUrl });
      setError(`Registration is saved, but Face ID/Fingerprint setup is required: ${err.message}`);
    } finally {
      setPasskeyLoading(false);
    }
  }

  if (eventLoading) return <main className="page"><p className="subtitle">Loading event...</p></main>;
  if (!event) return <main className="page"><div className="eyebrow">Event unavailable</div><h1 className="title">This registration link is not valid</h1><p className="subtitle">{error || "Please ask the organizer for the correct link."}</p></main>;
  if (result) return <main className="page"><div className="eyebrow">Pass Generated</div><h1 className="title">You&apos;re registered</h1><p className="subtitle">Face ID/Fingerprint is secured on this device. Save this pass and show the QR at the door.</p><div className="badge">{result.photoUrl && <img src={result.photoUrl} alt={result.name} width={150} height={150} style={{ borderRadius: "50%", objectFit: "cover" }} />}<div className="badge-name">{result.name}</div><img src={result.qrDataUrl} alt="QR attendance pass" width={220} height={220}/><div className="badge-id">{result.id}</div></div></main>;

  if (pendingPasskey) return <main className="page"><div className="eyebrow">One secure step left</div><h1 className="title">Set up Face ID / Fingerprint</h1><p className="subtitle">Your registration is saved. Finish device verification now so only you can self check in or check out.</p>{error && <p className="form-error">{error}</p>}<button className="btn" disabled={passkeyLoading} onClick={() => setupPasskey(pendingPasskey.attendee, pendingPasskey.photoUrl)}>{passkeyLoading ? "Opening biometric..." : "Set up Face ID / Fingerprint"}</button></main>;

  return <main className="page"><div className="eyebrow">Event Registration</div><h1 className="title">{event.name}</h1><p className="subtitle">Fill all details to get your QR attendance pass.</p><form className="card" onSubmit={handleSubmit}>
    <div className="field"><label>Full name</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
    <div className="field"><label>Employee code</label><input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[0-9]+" required /></div>
    <div className="field"><label>WhatsApp number</label><input type="tel" inputMode="numeric" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" pattern="[6-9][0-9]{9}" required /></div>
    <div className="field"><label>Division</label><input value={division} onChange={(e) => setDivision(e.target.value)} required /></div>
    <div className="field"><label>Your photo (max 2MB)</label><input type="file" accept="image/*" onChange={handlePhotoChange} required />{photoPreview && <img src={photoPreview} alt="Preview" width={100} height={100} style={{ borderRadius: "50%", objectFit: "cover", marginTop: 10 }} />}{photoError && <p className="form-error">{photoError}</p>}</div>
    {error && <p className="form-error">{error}</p>}<button className="btn" disabled={loading}>{loading ? "Generating pass..." : "Get my QR pass"}</button>
  </form></main>;
}
