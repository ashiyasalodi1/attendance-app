"use client";

import { useState } from "react";

export default function OwnerLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/owner-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      window.location.href = "/owner";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="eyebrow">Private Area</div>
      <h1 className="title">Owner login</h1>
      <p className="subtitle">Enter the owner password to manage attendance.</p>

      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
        <div className="field">
          <label>Owner password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

        <button className="btn" disabled={loading}>
          {loading ? "Logging in..." : "Open owner panel"}
        </button>
      </form>
    </main>
  );
}
