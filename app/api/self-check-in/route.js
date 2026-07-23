import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

export async function POST(request) {
  try {
    const { event_slug: eventSlug, employee_code: employeeCode, action } = await request.json();
    if (!eventSlug?.trim() || !employeeCode?.trim() || !["check_in", "check_out"].includes(action)) {
      return NextResponse.json({ error: "Employee code and attendance action are required" }, { status: 400 });
    }
    const { data: event } = await supabase.from("events").select("id").eq("slug", eventSlug.trim()).eq("is_active", true).maybeSingle();
    if (!event) return NextResponse.json({ error: "This event QR is no longer active" }, { status: 404 });
    const { data: attendees, error } = await supabase.from("attendees").select("id, name, status").eq("event_id", event.id).eq("employee_code", employeeCode.trim()).limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const attendee = attendees?.[0];
    if (!attendee) return NextResponse.json({ error: "You are not registered for this event. Please register first." }, { status: 404 });
    const now = new Date().toISOString();
    const { error: actionError } = await supabase.from("attendance_actions").insert({ attendee_id: attendee.id, event_id: event.id, action, source: "event_qr", recorded_at: now });
    if (actionError) return NextResponse.json({ error: actionError.message }, { status: 500 });
    if (action === "check_in" && attendee.status !== "present") {
      const { error: updateError } = await supabase.from("attendees").update({ status: "present", attended_at: now }).eq("id", attendee.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ name: attendee.name, action, recorded_at: now });
  } catch {
    return NextResponse.json({ error: "Invalid check-in request" }, { status: 400 });
  }
}
