import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { recordDailyAttendance } from "../../../../lib/daily-attendance";

export const dynamic = "force-dynamic";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

export async function POST(request) {
  try {
    const { attendee_id: attendeeId, action, note } = await request.json();
    if (!attendeeId || !["check_in", "check_out"].includes(action)) {
      return NextResponse.json({ error: "Attendee and action are required" }, { status: 400 });
    }
    const { data: attendee, error: attendeeError } = await supabase.from("attendees")
      .select("id, name, event_id, status").eq("id", attendeeId).single();
    if (attendeeError || !attendee) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });

    // Manual check-in is the owner fallback for a lost/dead phone. It always
    // creates the new daily record, even if the public window is closed.
    if (action === "check_in") {
      const dailyResult = await recordDailyAttendance({
        supabase, attendee, source: "manual", note: note?.trim() || "Owner manual attendance", allowClosed: true,
      });
      if (dailyResult.error) {
        return NextResponse.json({ error: dailyResult.error, already: Boolean(dailyResult.alreadyMarked) }, { status: dailyResult.status || 500 });
      }
    }
    const now = new Date().toISOString();
    const { error: actionError } = await supabase.from("attendance_actions").insert({
      attendee_id: attendee.id, event_id: attendee.event_id, action, source: "manual",
      note: note?.trim() || "Owner manual attendance", recorded_at: now,
    });
    if (actionError) return NextResponse.json({ error: actionError.message }, { status: 500 });
    if (action === "check_in" && attendee.status !== "present") {
      const { error: updateError } = await supabase.from("attendees")
        .update({ status: "present", attended_at: now }).eq("id", attendee.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, name: attendee.name, action, recorded_at: now });
  } catch {
    return NextResponse.json({ error: "Invalid manual attendance request" }, { status: 400 });
  }
}
