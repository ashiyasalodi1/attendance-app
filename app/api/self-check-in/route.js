import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAuthentication } from "../../../lib/passkeys";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

function indiaDateStart() {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${date}T00:00:00+05:30`).toISOString();
}

function indiaTime() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function isInsideWindow(now, start, end) {
  if (!start || !end) return false;
  const startTime = String(start).slice(0, 5);
  const endTime = String(end).slice(0, 5);
  if (startTime <= endTime) return now >= startTime && now <= endTime;
  return now >= startTime || now <= endTime;
}

function metersBetween(lat1, lng1, lat2, lng2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const a = Math.sin(toRadians(lat2 - lat1) / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(toRadians(lng2 - lng1) / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const eventSlug = body.event_slug?.trim();
    const employeeCode = body.employee_code?.trim();
    const whatsapp = String(body.whatsapp || "").replace(/\D/g, "");
    const action = body.action;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!eventSlug || !employeeCode || !whatsapp || !["check_in", "check_out"].includes(action)) {
      return NextResponse.json({ error: "Employee Code, WhatsApp number and attendance action are required." }, { status: 400 });
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Venue location permission is required to record attendance." }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, venue_latitude, venue_longitude, venue_radius_meters, check_in_start_time, check_in_end_time, check_out_start_time, check_out_end_time")
      .eq("slug", eventSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return NextResponse.json({ error: "This event QR is no longer active." }, { status: 404 });

    if (event.venue_latitude === null || event.venue_longitude === null || !event.check_in_start_time || !event.check_in_end_time || !event.check_out_start_time || !event.check_out_end_time) {
      return NextResponse.json({ error: "The owner has not finished venue and time settings for this event." }, { status: 403 });
    }

    const currentTime = indiaTime();
    const allowed = action === "check_in"
      ? isInsideWindow(currentTime, event.check_in_start_time, event.check_in_end_time)
      : isInsideWindow(currentTime, event.check_out_start_time, event.check_out_end_time);
    if (!allowed) {
      const start = action === "check_in" ? event.check_in_start_time : event.check_out_start_time;
      const end = action === "check_in" ? event.check_in_end_time : event.check_out_end_time;
      return NextResponse.json({ error: `${action === "check_in" ? "Check-in" : "Check-out"} is allowed only between ${String(start).slice(0, 5)} and ${String(end).slice(0, 5)} (India time).` }, { status: 403 });
    }

    const distance = metersBetween(latitude, longitude, Number(event.venue_latitude), Number(event.venue_longitude));
    const radius = Number(event.venue_radius_meters || 150);
    if (distance > radius) {
      return NextResponse.json({ error: `You are ${Math.round(distance)} meters from the venue. Attendance is allowed within ${radius} meters only.` }, { status: 403 });
    }

    const { data: attendee, error: attendeeError } = await supabase
      .from("attendees")
      .select("id, name, event_id, whatsapp, status")
      .eq("event_id", event.id)
      .eq("employee_code", employeeCode)
      .maybeSingle();
    if (attendeeError) throw attendeeError;
    if (!attendee || String(attendee.whatsapp || "").replace(/\D/g, "") !== whatsapp) {
      return NextResponse.json({ error: "Employee Code or WhatsApp number does not match your registration." }, { status: 403 });
    }

    await verifyAuthentication({ supabase, attendeeId: attendee.id, response: body.passkey_response, request });

    const dayStart = indiaDateStart();
    const { data: existingAction, error: existingError } = await supabase
      .from("attendance_actions")
      .select("id, recorded_at")
      .eq("attendee_id", attendee.id)
      .eq("action", action)
      .gte("recorded_at", dayStart)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingAction) {
      return NextResponse.json({ error: `${action === "check_in" ? "Check-in" : "Check-out"} already recorded today at ${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(existingAction.recorded_at))}.` }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { error: actionError } = await supabase.from("attendance_actions").insert({
      attendee_id: attendee.id,
      event_id: event.id,
      action,
      source: "event_qr",
      note: `GPS verified: ${Math.round(distance)}m from venue`,
      recorded_at: now,
    });
    if (actionError) throw actionError;

    if (action === "check_in") {
      const { error: updateError } = await supabase.from("attendees").update({ status: "present", attended_at: now }).eq("id", attendee.id);
      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true, name: attendee.name, action, recorded_at: now, distance_meters: Math.round(distance) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not record attendance." }, { status: 400 });
  }
}
