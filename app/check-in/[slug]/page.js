"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This phone/browser does not support location. Ask the owner for manual attendance."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error("Location permission is required. Please allow precise location and try again.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export default function SelfCheckInPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [event, setEvent] = useState(null);
  const [employeeCode, setEmployeeCode] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/events/public?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Event not found");
        setEvent(data.event);
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  async function submit(action) {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const location = await getLocation();
      const optionResponse = await fetch("/api/passkeys/authentication-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_slug: slug, employee_code: employeeCode, whatsapp }),
      });
      const options = await optionResponse.json();
      if (!optionResponse.ok) {
        if ((options.error || "").includes("no registered Face ID")) setNeedsSetup(true);
        throw new Error(options.error || "Could not start biometric verification.");
      }

      const { startAuthentication } = await import("@simplewebauthn/browser");
      const passkeyResponse = await startAuthentication({ optionsJSON: options });

      const response = await fetch("/api/self-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_slug: slug,
          employee_code: employeeCode,
          whatsapp,
          action,
          latitude: location.latitude,
          longitude: location.longitude,
          passkey_response: passkeyResponse,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not record attendance.");
      setResult(data);
    } catch (err) {
      setError(err.message || "Attendance verification was cancelled.");
    } finally {
      setLoading(false);
    }
  }

  async function setupExistingDevice() {
    setError("");
    setLoading(true);
    try {
      const optionResponse = await fetch("/api/passkeys/registration-options", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_slug: slug, employee_code: employeeCode, whatsapp }),
      });
      const options = await optionResponse.json();
      if (!optionResponse.ok) throw new Error(options.error || "Could not start device setup.");
      const { attendee_id: existingAttendeeId, ...optionsJSON } = options;
      const { startRegistration } = await import("@simplewebauthn/browser");
      const passkeyResponse = await startRegistration({ optionsJSON });
      const verifyResponse = await fetch("/api/passkeys/registration-verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendee_id: existingAttendeeId, response: passkeyResponse }),
      });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok || !verified.verified) throw new Error(verified.error || "Device setup did not complete.");
      setNeedsSetup(false);
      setResult({ name: "Device secured", action: "setup" });
    } catch (err) {
      setError(err.message || "Could not set up Face ID/Fingerprint.");
    } finally {
      setLoading(false);
    }
  }

  if (!event && !error) return <main className="page"><p className="subtitle">Loading event...</p></main>;
  if (!event) return <main className="page"><div className="eyebrow">Event unavailable</div><h1 className="title">This check-in QR is not valid</h1><p className="subtitle">{error}</p></main>;

  return <main className="page">
    <div className="eyebrow">Welcome to {event.name}</div>
    <h1 className="title">Secure attendance</h1>
    <p className="subtitle">Enter your registered details, allow venue location, then confirm with this phone&apos;s Face ID or Fingerprint.</p>
    <form className="card" onSubmit={(e) => e.preventDefault()}>
      <div className="field"><label>Employee Code</label><input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" pattern="[0-9]+" required autoFocus /></div>
      <div className="field"><label>Registered WhatsApp Number</label><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={10} required /></div>
      {error && <p className="form-error">{error}</p>}
      {result && <p className="subtitle"><strong>{result.name}</strong>{result.action === "setup" ? ": Face ID/Fingerprint is ready. Now choose Check In or Check Out." : `: ${result.action === "check_in" ? "Check-in" : "Check-out"} recorded successfully.`}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" type="button" disabled={loading} onClick={() => submit("check_in")}>{loading ? "Verifying..." : "Check In"}</button>
        <button className="btn" type="button" disabled={loading} onClick={() => submit("check_out")}>{loading ? "Verifying..." : "Check Out"}</button>
        {needsSetup && <button className="view-btn" type="button" disabled={loading} onClick={setupExistingDevice}>{loading ? "Setting up..." : "Set up Face ID / Fingerprint"}</button>}
      </div>
    </form>
  </main>;
}
