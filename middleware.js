import { NextResponse } from "next/server";

const SESSION_MAX_AGE = 12 * 60 * 60 * 1000;

function toBase64Url(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return toBase64Url(signature);
}

async function hasValidOwnerSession(token) {
  const secret = process.env.OWNER_SESSION_SECRET;

  if (!token || !secret) return false;

  const lastDot = token.lastIndexOf(".");

  if (lastDot === -1) return false;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const createdAt = Number(payload.split(".")[0]);

  if (!createdAt || Date.now() - createdAt > SESSION_MAX_AGE) {
    return false;
  }

  const expectedSignature = await sign(payload, secret);

  return signature === expectedSignature;
}

export async function middleware(request) {
  const token = request.cookies.get("owner_session")?.value;
  const allowed = await hasValidOwnerSession(token);

  if (allowed) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Owner login required" },
      { status: 401 }
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/owner-login";

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/owner/:path*",
    "/dashboard/:path*",
    "/scan/:path*",
    "/api/attendees/:path*",
    "/api/mark-attendance/:path*",
  ],
};
