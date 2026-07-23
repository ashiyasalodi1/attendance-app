import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event_id");

  let query = supabase
    .from("attendees")
    .select("*")
    .order("created_at", { ascending: false });

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const attendeeIds = (data || []).map((attendee) => attendee.id);
  const { data: actions, error: actionsError } = attendeeIds.length
    ? await supabase
        .from("attendance_actions")
        .select("attendee_id, action, recorded_at")
        .in("attendee_id", attendeeIds)
        .order("recorded_at", { ascending: false })
    : { data: [], error: null };

  if (actionsError) {
    return NextResponse.json({ error: actionsError.message }, { status: 500 });
  }

  const latestCheckoutByAttendee = {};
  for (const action of actions || []) {
    if (action.action === "check_out" && !latestCheckoutByAttendee[action.attendee_id]) {
      latestCheckoutByAttendee[action.attendee_id] = action.recorded_at;
    }
  }

  const attendees = (data || []).map((attendee) => ({
    ...attendee,
    checked_out_at: latestCheckoutByAttendee[attendee.id] || null,
  }));

  return NextResponse.json(
    { attendees },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
