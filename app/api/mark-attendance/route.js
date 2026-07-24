import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { recordDailyAttendance } from "../../../lib/daily-attendance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function POST(req) {
  try {
    const { id, event_slug: eventSlug } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing QR id" }, { status: 400 });

    const { data: attendee, error: attendeeError } = await supabase
      .from("attendees")
      .select("id, name, event_id")
      .eq("id", id)
      .maybeSingle();
    if (attendeeError) throw attendeeError;
    if (!attendee) return NextResponse.json({ error: "QR not recognized" }, { status: 404 });

    if (eventSlug) {
      const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("slug", eventSlug)
        .eq("is_active", true)
        .maybeSingle();
      if (!event || event.id !== attendee.event_id) {
        return NextResponse.json({ error: "This attendee is not registered for the selected event" }, { status: 400 });
      }
    }

    const result = await recordDailyAttendance({ supabase, attendee, source: "owner_qr" });
    if (result.error) {
      return NextResponse.json(
        { error: result.error, already: Boolean(result.alreadyMarked) },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      already: false,
      name: attendee.name,
      attendance_date: result.attendanceDate,
      attended_at: result.record.checked_in_at,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Invalid QR request" }, { status: 500 });
  }
}
