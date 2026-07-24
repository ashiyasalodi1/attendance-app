import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const SCAN_GAP_MS = 30 * 60 * 1000;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

async function scanSummary(attendeeId) {
  const { data: scans, error } = await supabase.from("attendance_scans")
    .select("checked_at").eq("attendee_id", attendeeId).order("checked_at", { ascending: true });
  if (error) throw error;
  const times = (scans || []).map((scan) => scan.checked_at);
  return { count: times.length, first_scan: times[0] || null, last_scan: times.at(-1) || null, history: times };
}

export async function POST(request) {
  try {
    const { event_slug: eventSlug, employee_code: employeeCode, action } = await request.json();
    if (!eventSlug?.trim() || !employeeCode?.trim() || !["check_in", "check_out", "confirm"].includes(action)) {
      return NextResponse.json({ error: "Employee code and attendance action are required" }, { status: 400 });
    }
    const { data: event } = await supabase.from("events").select("id").eq("slug", eventSlug.trim()).eq("is_active", true).maybeSingle();
    if (!event) return NextResponse.json({ error: "This event QR is no longer active" }, { status: 404 });
    const { data: attendees, error } = await supabase.from("attendees").select("id, name, status").eq("event_id", event.id).eq("employee_code", employeeCode.trim()).limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const attendee = attendees?.[0];
    if (!attendee) return NextResponse.json({ error: "You are not registered for this event. Please register first." }, { status: 404 });

    const summaryBefore = await scanSummary(attendee.id);
    const lastScan = summaryBefore.last_scan ? new Date(summaryBefore.last_scan).getTime() : 0;
    const waitMs = SCAN_GAP_MS - (Date.now() - lastScan);
    if ((action === "check_in" || action === "confirm") && lastScan && waitMs > 0) {
      return NextResponse.json({
        error: `Next confirmation scan is available in ${Math.ceil(waitMs / 60000)} minutes.`,
        retry_after_minutes: Math.ceil(waitMs / 60000),
        name: attendee.name,
        summary: summaryBefore,
      }, { status: 429 });
    }

    const now = new Date().toISOString();
    if (action === "check_in" || action === "check_out") {
      const { error: actionError } = await supabase.from("attendance_actions").insert({
        attendee_id: attendee.id, event_id: event.id, action, source: "event_qr", recorded_at: now,
      });
      if (actionError) return NextResponse.json({ error: actionError.message }, { status: 500 });
    }
    if (action === "check_in" || action === "confirm") {
      const { error: scanError } = await supabase.from("attendance_scans").insert({ attendee_id: attendee.id, event_id: event.id, checked_at: now });
      if (scanError) return NextResponse.json({ error: scanError.message }, { status: 500 });
    }
    if (action === "check_in" && attendee.status !== "present") {
      const { error: updateError } = await supabase.from("attendees").update({ status: "present", attended_at: now }).eq("id", attendee.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ name: attendee.name, action, recorded_at: now, summary: await scanSummary(attendee.id) });
  } catch {
    return NextResponse.json({ error: "Invalid check-in request" }, { status: 400 });
  }
}
