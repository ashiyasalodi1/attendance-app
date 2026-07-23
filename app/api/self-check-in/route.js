import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MINIMUM_SCAN_GAP_MS = 30 * 60 * 1000;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function POST(request) {
  try {
    const { event_slug: eventSlug, employee_code: employeeCode } = await request.json();
    if (!eventSlug?.trim() || !employeeCode?.trim()) {
      return NextResponse.json({ error: "Employee code is required" }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabase
      .from("events").select("id").eq("slug", eventSlug.trim()).eq("is_active", true).single();
    if (eventError || !event) {
      return NextResponse.json({ error: "This event QR is no longer active" }, { status: 404 });
    }

    const { data: attendees, error: attendeeError } = await supabase
      .from("attendees").select("id, name, status").eq("event_id", event.id)
      .eq("employee_code", employeeCode.trim()).limit(1);
    if (attendeeError) return NextResponse.json({ error: attendeeError.message }, { status: 500 });
    const attendee = attendees?.[0];
    if (!attendee) {
      return NextResponse.json({ error: "You are not registered for this event. Please register first." }, { status: 404 });
    }

    const { data: previousScans, error: scanError } = await supabase
      .from("attendance_scans").select("checked_at").eq("attendee_id", attendee.id)
      .order("checked_at", { ascending: false }).limit(1);
    if (scanError) return NextResponse.json({ error: scanError.message }, { status: 500 });

    const previousScan = previousScans?.[0];
    if (previousScan) {
      const elapsed = Date.now() - new Date(previousScan.checked_at).getTime();
      if (elapsed < MINIMUM_SCAN_GAP_MS) {
        return NextResponse.json({
          error: `Your next attendance scan will be available in ${Math.ceil((MINIMUM_SCAN_GAP_MS - elapsed) / 60000)} minutes.`,
        retry_after_minutes: Math.ceil((MINIMUM_SCAN_GAP_MS - elapsed) / 60000),
        name: attendee.name,
      }, { status: 429 });
      }
    }

    const now = new Date().toISOString();
    const { error: insertError } = await supabase
      .from("attendance_scans").insert({ attendee_id: attendee.id, event_id: event.id, checked_at: now });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    if (attendee.status !== "present") {
      const { error: updateError } = await supabase
        .from("attendees").update({ status: "present", attended_at: now }).eq("id", attendee.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      name: attendee.name,
      first_scan: !previousScan,
      checked_at: now,
      message: previousScan ? "Attendance scan recorded again." : "First attendance scan recorded.",
    });
  } catch {
    return NextResponse.json({ error: "Invalid check-in request" }, { status: 400 });
  }
}
