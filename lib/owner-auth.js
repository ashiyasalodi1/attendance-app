import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export function verifyOwnerPassword(password) {
  const expected = process.env.OWNER_DASHBOARD_PASSWORD || "";

  if (!expected || !password) return false;

  const expectedBuffer = Buffer.from(expected);
  const passwordBuffer = Buffer.from(password);

  if (expectedBuffer.length !== passwordBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, passwordBuffer);
}

export function createOwnerSession() {
  const secret = process.env.OWNER_SESSION_SECRET;

  if (!secret) {
    throw new Error("OWNER_SESSION_SECRET is missing");
  }

  const payload = `${Date.now()}.${randomBytes(24).toString("hex")}`;

  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}
