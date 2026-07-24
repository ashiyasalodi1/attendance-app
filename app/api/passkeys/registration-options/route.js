import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { makeRegistrationOptions } from "../../../../lib/passkeys";

export const dynamic = "force-dynamic";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

export async function POST(request) {
  try {
    const body = await request.json();
    let attendeeId = body.attendee_id;
    if (!attendeeId && body.event_slug && body.employee_code && body.whatsapp) {
      const phone = String(body.whatsapp).replace(/\D/g, "");
      const { data: event } = await supabase.from("events").select("id").eq("slug", body.event_slug).eq("is_active", true).maybeSingle();
      if (!event) return NextResponse.json({ error: "Event QR is not valid." }, { status: 404 });
      const { data: found } = await supabase.from("attendees").select("id").eq("event_id", event.id).eq("employee_code", String(body.employee_code).trim()).eq("whatsapp", phone).maybeSingle();
      attendeeId = found?.id;
    }
    if (!attendeeId) return NextResponse.json({ error: "Registered attendee was not found." }, { status: 404 });
    const { data: attendee, error } = await supabase.from("attendees").select("id, name, employee_code").eq("id", attendeeId).maybeSingle();
    if (error) throw error;
    if (!attendee) return NextResponse.json({ error: "Registration was not found." }, { status: 404 });
    const options = await makeRegistrationOptions({ supabase, attendee, request });
    return NextResponse.json({ ...options, attendee_id: attendee.id });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not start biometric setup." }, { status: 400 });
  }
}
