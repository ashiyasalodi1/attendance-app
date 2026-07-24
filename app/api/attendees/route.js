import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

function attendanceTimes(actions) {
  const checkIns = actions.filter((action) => action.action === "check_in");
  const checkOuts = actions.filter((action) => action.action === "check_out");

  return {
    first_check_in_at: checkIns[0]?.recorded_at || null,
    first_check_out_at: checkOuts[0]?.recorded_at || null,
    second_check_in_at: checkIns[1]?.recorded_at || null,
    second_check_out_at: checkOuts[1]?.recorded_at || null,
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event_id");

  let query = supabase.from("attendees").select("*").order("created_at", { ascending: false });
  if (eventId) query = query.eq("event_id", eventId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const attendeeIds = (data || []).map((attendee) => attendee.id);
  const { data: actions, error: actionsError } = attendeeIds.length
    ? await supabase
        .from("attendance_actions")
        .select("attendee_id, action, recorded_at")
        .in("attendee_id", attendeeIds)
        .order("recorded_at", { ascending: true })
    : { data: [], error: null };
  if (actionsError) return NextResponse.json({ error: actionsError.message }, { status: 500 });

  const actionsByAttendee = (actions || []).reduce((all, action) => {
    if (!all[action.attendee_id]) all[action.attendee_id] = [];
    all[action.attendee_id].push(action);
    return all;
  }, {});

  const attendees = (data || []).map((attendee) => {
    const times = attendanceTimes(actionsByAttendee[attendee.id] || []);
    return {
      ...attendee,
      // attended_at is retained as a fallback for attendance recorded before attendance_actions existed.
      first_check_in_at: times.first_check_in_at || attendee.attended_at || null,
      first_check_out_at: times.first_check_out_at,
      second_check_in_at: times.second_check_in_at,
      second_check_out_at: times.second_check_out_at,
    };
  });

  return NextResponse.json(
    { attendees },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}
