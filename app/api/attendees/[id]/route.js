import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

function indiaDate(value) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function groupHistory(actions) {
  const grouped = {};
  for (const action of actions || []) {
    const date = indiaDate(action.recorded_at);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(action);
  }
  return Object.entries(grouped).map(([date, dayActions]) => {
    const checkIns = dayActions.filter((action) => action.action === "check_in");
    const checkOuts = dayActions.filter((action) => action.action === "check_out");
    return {
      date,
      first_check_in_at: checkIns[0]?.recorded_at || null,
      first_check_out_at: checkOuts[0]?.recorded_at || null,
      second_check_in_at: checkIns[1]?.recorded_at || null,
      second_check_out_at: checkOuts[1]?.recorded_at || null,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export async function GET(req, { params }) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "Attendee id is required" }, { status: 400 });

  const { data: attendee, error: attendeeError } = await supabase.from("attendees").select("*").eq("id", id).maybeSingle();
  if (attendeeError) return NextResponse.json({ error: attendeeError.message }, { status: 500 });
  if (!attendee) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });

  const { data: actions, error: actionsError } = await supabase.from("attendance_actions").select("action, recorded_at").eq("attendee_id", id).order("recorded_at", { ascending: true });
  if (actionsError) return NextResponse.json({ error: actionsError.message }, { status: 500 });

  return NextResponse.json({ attendee, history: groupHistory(actions) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req, { params }) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "Attendee id is required" }, { status: 400 });

  const { error } = await supabase.from("attendees").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
