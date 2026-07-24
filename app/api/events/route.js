import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

function makeSlug(name) {
  return `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event"}-${randomBytes(3).toString("hex")}`;
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function scheduleFrom(body) {
  const schedule = {
    event_start_date: body.event_start_date || null,
    event_end_date: body.event_end_date || null,
    check_in_start_time: body.check_in_start_time || null,
    check_in_end_time: body.check_in_end_time || null,
    check_out_start_time: body.check_out_start_time || null,
    check_out_end_time: body.check_out_end_time || null,
    check_in_2_start_time: body.check_in_2_start_time || null,
    check_in_2_end_time: body.check_in_2_end_time || null,
    check_out_2_start_time: body.check_out_2_start_time || null,
    check_out_2_end_time: body.check_out_2_end_time || null,
  };
  const times = Object.entries(schedule).filter(([key]) => key.includes("_time"));
  if (!schedule.event_start_date || !schedule.event_end_date || schedule.event_start_date > schedule.event_end_date) throw new Error("Choose a valid event Start Date and End Date.");
  if (times.some(([, value]) => !validTime(value))) throw new Error("Set all four Check-in/Check-out time windows.");
  const pairs = [[schedule.check_in_start_time, schedule.check_in_end_time], [schedule.check_out_start_time, schedule.check_out_end_time], [schedule.check_in_2_start_time, schedule.check_in_2_end_time], [schedule.check_out_2_start_time, schedule.check_out_2_end_time]];
  if (pairs.some(([start, end]) => start >= end)) throw new Error("Each attendance window must have an end time after its start time.");
  return schedule;
}

export async function GET() {
  try {
    const { data: events, error: eventsError } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    if (eventsError) throw eventsError;
    const { data: attendees, error: attendeesError } = await supabase.from("attendees").select("id, event_id, status");
    if (attendeesError) throw attendeesError;
    return NextResponse.json({ events: (events || []).map((event) => {
      const eventAttendees = (attendees || []).filter((attendee) => attendee.event_id === event.id);
      const presentCount = eventAttendees.filter((attendee) => attendee.status === "present").length;
      return { ...event, registered_count: eventAttendees.length, present_count: presentCount, absent_count: eventAttendees.length - presentCount };
    }) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not load events" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "Event name is required" }, { status: 400 });
    const schedule = scheduleFrom(body);
    const { data, error } = await supabase.from("events").insert([{ name, slug: makeSlug(name), ...schedule }]).select().single();
    if (error) throw error;
    return NextResponse.json({ event: { ...data, registered_count: 0, present_count: 0, absent_count: 0 } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Invalid event request" }, { status: 400 });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const name = body.name?.trim();
    if (!body.event_id) return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Event name is required" }, { status: 400 });
    const schedule = scheduleFrom(body);
    const { data, error } = await supabase.from("events").update({ name, ...schedule }).eq("id", body.event_id).select().single();
    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update event" }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const { event_id } = await req.json();
    if (!event_id) return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    const { data: event, error: findError } = await supabase.from("events").select("id, name").eq("id", event_id).maybeSingle();
    if (findError) throw findError;
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const { error: attendeeError } = await supabase.from("attendees").delete().eq("event_id", event_id);
    if (attendeeError) throw attendeeError;
    const { error: deleteError } = await supabase.from("events").delete().eq("id", event_id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true, message: `${event.name} deleted successfully` });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not delete event" }, { status: 500 });
  }
}
