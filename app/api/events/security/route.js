import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

export async function PATCH(request) {
  try {
    const body = await request.json();
    const eventId = body.event_id;
    const latitude = Number(body.venue_latitude);
    const longitude = Number(body.venue_longitude);
    const radius = Number(body.venue_radius_meters);
    const times = [body.check_in_start_time, body.check_in_end_time, body.check_out_start_time, body.check_out_end_time];
    if (!eventId || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Enter a valid venue latitude and longitude." }, { status: 400 });
    }
    if (!Number.isInteger(radius) || radius < 25 || radius > 2000) {
      return NextResponse.json({ error: "Venue radius must be between 25 and 2000 meters." }, { status: 400 });
    }
    if (times.some((time) => !/^\d{2}:\d{2}$/.test(String(time || "")))) {
      return NextResponse.json({ error: "Set all Check-in and Check-out start/end times." }, { status: 400 });
    }
    const { data, error } = await supabase.from("events").update({
      venue_latitude: latitude,
      venue_longitude: longitude,
      venue_radius_meters: radius,
      check_in_start_time: body.check_in_start_time,
      check_in_end_time: body.check_in_end_time,
      check_out_start_time: body.check_out_start_time,
      check_out_end_time: body.check_out_end_time,
    }).eq("id", eventId).select().single();
    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save security settings." }, { status: 500 });
  }
}
