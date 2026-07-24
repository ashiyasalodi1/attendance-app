import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function passkeyConfig(request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const fallbackOrigin = forwardedHost
    ? `${forwardedProtocol || "https"}://${host}`
    : new URL(request.url).origin;
  const origin = (process.env.WEBAUTHN_ORIGIN || fallbackOrigin).replace(/\/$/, "");
  const rpID = process.env.WEBAUTHN_RP_ID || new URL(origin).hostname;
  return { rpID, origin, rpName: "Dawat E Islami Attendance" };
}

export async function saveChallenge(supabase, attendeeId, ceremony, challenge) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const { error } = await supabase.from("webauthn_challenges").upsert({
    attendee_id: attendeeId,
    ceremony,
    challenge,
    expires_at: expiresAt,
  }, { onConflict: "attendee_id,ceremony" });
  if (error) throw error;
}

export async function consumeChallenge(supabase, attendeeId, ceremony) {
  const { data, error } = await supabase
    .from("webauthn_challenges")
    .select("id, challenge, expires_at")
    .eq("attendee_id", attendeeId)
    .eq("ceremony", ceremony)
    .maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at) < new Date()) {
    throw new Error("Biometric verification expired. Please try again.");
  }
  await supabase.from("webauthn_challenges").delete().eq("id", data.id);
  return data.challenge;
}

export async function makeRegistrationOptions({ supabase, attendee, request }) {
  const { data: existing, error } = await supabase
    .from("attendee_passkeys")
    .select("credential_id, transports")
    .eq("attendee_id", attendee.id);
  if (error) throw error;

  const config = passkeyConfig(request);
  const options = await generateRegistrationOptions({
    ...config,
    userName: `${attendee.name} (${attendee.employee_code})`,
    userID: new TextEncoder().encode(attendee.id),
    attestationType: "none",
    excludeCredentials: (existing || []).map((passkey) => ({
      id: passkey.credential_id,
      transports: passkey.transports || undefined,
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
    supportedAlgorithmIDs: [-7, -257],
  });

  await saveChallenge(supabase, attendee.id, "registration", options.challenge);
  return options;
}

export async function verifyAndSaveRegistration({ supabase, attendeeId, response, request }) {
  const challenge = await consumeChallenge(supabase, attendeeId, "registration");
  const config = passkeyConfig(request);
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Face ID/Fingerprint verification was not completed.");
  }

  const credential = verification.registrationInfo.credential;
  const { error } = await supabase.from("attendee_passkeys").upsert({
    credential_id: credential.id,
    attendee_id: attendeeId,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports || [],
  }, { onConflict: "credential_id" });
  if (error) throw error;
  return true;
}

export async function makeAuthenticationOptions({ supabase, attendee, request }) {
  const { data: passkeys, error } = await supabase
    .from("attendee_passkeys")
    .select("credential_id, transports")
    .eq("attendee_id", attendee.id);
  if (error) throw error;
  if (!passkeys?.length) throw new Error("This device has no registered Face ID/Fingerprint passkey. Ask the owner for manual attendance.");

  const config = passkeyConfig(request);
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: "required",
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credential_id,
      transports: passkey.transports || undefined,
    })),
  });
  await saveChallenge(supabase, attendee.id, "authentication", options.challenge);
  return options;
}

export async function verifyAuthentication({ supabase, attendeeId, response, request }) {
  const challenge = await consumeChallenge(supabase, attendeeId, "authentication");
  const { data: passkey, error } = await supabase
    .from("attendee_passkeys")
    .select("credential_id, public_key, counter, transports")
    .eq("credential_id", response.id)
    .eq("attendee_id", attendeeId)
    .maybeSingle();
  if (error) throw error;
  if (!passkey) throw new Error("This biometric credential is not registered for this attendee.");

  const config = passkeyConfig(request);
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID,
    credential: {
      id: passkey.credential_id,
      publicKey: Buffer.from(passkey.public_key, "base64url"),
      counter: Number(passkey.counter),
      transports: passkey.transports || undefined,
    },
    requireUserVerification: true,
  });
  if (!verification.verified) throw new Error("Face ID/Fingerprint verification failed.");

  const { error: updateError } = await supabase
    .from("attendee_passkeys")
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq("credential_id", passkey.credential_id);
  if (updateError) throw updateError;
  return true;
}
