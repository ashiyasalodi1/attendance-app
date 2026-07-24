import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAndSaveRegistration } from "../../../../lib/passkeys";

export const dynamic = "force-dynamic";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

export async function POST(request) {
  try {
    const { attendee_id: attendeeId, response } = await request.json();
    if (!attendeeId || !response) return NextResponse.json({ error: "Biometric response is required." }, { status: 400 });
    await verifyAndSaveRegistration({ supabase, attendeeId, response, request });
    return NextResponse.json({ verified: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not verify biometric setup." }, { status: 400 });
  }
}
