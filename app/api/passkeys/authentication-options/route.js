import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { makeAuthenticationOptions } from "../../../../lib/passkeys";

export const dynamic = "force-dynamic";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

export async function POST(request) {
  try {
    const { event_slug: eventSlug, employee_code: employeeCode, whatsapp } = await request.json();
    const phone = String(whatsapp || "").replace(/\D/g, "");
    if (!eventSlug || !employeeCode || !phone) return NextResponse.json({ error: "Employee Code and registered WhatsApp number are required." }, { status: 400 });
    const { data: event } = await supabase.from("events").select("id").eq("slug", eventSlug).eq("is_active", true).maybeSingle();
    if (!event) return NextResponse.json({ error: "Event QR is not valid." }, { status: 404 });
    const { data: attendee, error } = await supabase.from("attendees").select("id, name, employee_code, whatsapp").eq("event_id", event.id).eq("employee_code", String(employeeCode).trim()).maybeSingle();
    if (error) throw error;
    if (!attendee || String(attendee.whatsapp || "").replace(/\D/g, "") !== phone) return NextResponse.json({ error: "Employee Code or WhatsApp number does not match registration." }, { status: 403 });
    return NextResponse.json(await makeAuthenticationOptions({ supabase, attendee, request }));
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not start biometric verification." }, { status: 400 });
  }
}
