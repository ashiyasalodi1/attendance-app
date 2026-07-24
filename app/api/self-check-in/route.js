import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

function indiaNow() {
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const timeParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (parts, type) => parts.find((part) => part.type === type)?.value;
  return { date: `${get(dateParts, "year")}-${get(dateParts, "month")}-${get(dateParts, "day")}`, time: `${get(timeParts, "hour")}:${get(timeParts, "minute")}` };
}

function indiaTodayStart() {
  return new Date(`${indiaNow().date}T00:00:00+05:30`).toISOString();
}

function isInsideWindow(now, start, end) {
  return Boolean(start && end && now >= String(start).slice(0, 5) && now <= String(end).slice(0, 5));
}

function windowMessage(label, start, end) {
  return `${label} is allowed only from ${String(start).slice(0, 5)} to ${String(end).slice(0, 5)} India time.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const eventSlug = body.event_slug?.trim();
    const employeeCode = String(body.employee_code || "").trim();
    const whatsapp = String(body.whatsapp || "").replace(/\D/g, "");
    const action = body.action;
    if (!eventSlug || !/^\d+$/.test(employeeCode) || !/^\d{10}$/.test(whatsapp) || !["check_in", "check_out"].includes(action)) {
      return NextResponse.json({ error: "Enter your Employee Code, registered 10-digit WhatsApp number, and choose Check In or Check Out." }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabase.from("events").select("id, name, event_start_date, event_end_date, check_in_start_time, check_in_end_time, check_out_start_time, check_out_end_time, check_in_2_start_time, check_in_2_end_time, check_out_2_start_time, check_out_2_end_time").eq("slug", eventSlug).eq("is_active", true).maybeSingle();
    if (eventError) throw eventError;
    if (!event) return NextResponse.json({ error: "This event QR is no longer active." }, { status: 404 });

    const nowIndia = indiaNow();
    if (!event.event_start_date || !event.event_end_date) return NextResponse.json({ error: "The owner has not set this event's attendance dates and time windows yet." }, { status: 403 });
    if (nowIndia.date < event.event_start_date || nowIndia.date > event.event_end_date) {
      return NextResponse.json({ error: `Attendance is available only from ${event.event_start_date} to ${event.event_end_date}.` }, { status: 403 });
    }

    const { data: attendee, error: attendeeError } = await supabase.from("attendees").select("id, name, whatsapp").eq("event_id", event.id).eq("employee_code", employeeCode).maybeSingle();
    if (attendeeError) throw attendeeError;
    if (!attendee || String(attendee.whatsapp || "").replace(/\D/g, "") !== whatsapp) return NextResponse.json({ error: "Employee Code or WhatsApp number does not match your registration." }, { status: 403 });

    const { data: todayActions, error: actionsError } = await supabase.from("attendance_actions").select("action").eq("attendee_id", attendee.id).gte("recorded_at", indiaTodayStart()).order("recorded_at", { ascending: true });
    if (actionsError) throw actionsError;
    const checkIns = (todayActions || []).filter((item) => item.action === "check_in").length;
    const checkOuts = (todayActions || []).filter((item) => item.action === "check_out").length;

    let label;
    let start;
    let end;
    if (action === "check_in") {
      if (checkIns >= 2) return NextResponse.json({ error: "Both Check-in entries have already been recorded today." }, { status: 409 });
      if (checkOuts < checkIns) return NextResponse.json({ error: "Record the current Check-out before the next Check-in." }, { status: 409 });
      label = checkIns === 0 ? "Check-in 1" : "Check-in 2";
      start = checkIns === 0 ? event.check_in_start_time : event.check_in_2_start_time;
      end = checkIns === 0 ? event.check_in_end_time : event.check_in_2_end_time;
    } else {
      if (checkOuts >= 2) return NextResponse.json({ error: "Both Check-out entries have already been recorded today." }, { status: 409 });
      if (checkIns <= checkOuts) return NextResponse.json({ error: "Record Check-in before Check-out." }, { status: 409 });
      label = checkOuts === 0 ? "Check-out 1" : "Check-out 2";
      start = checkOuts === 0 ? event.check_out_start_time : event.check_out_2_start_time;
      end = checkOuts === 0 ? event.check_out_end_time : event.check_out_2_end_time;
    }
    if (!isInsideWindow(nowIndia.time, start, end)) return NextResponse.json({ error: windowMessage(label, start, end) }, { status: 403 });

    const now = new Date().toISOString();
    const { error: actionError } = await supabase.from("attendance_actions").insert({ attendee_id: attendee.id, event_id: event.id, action, source: "event_qr", note: label, recorded_at: now });
    if (actionError) throw actionError;
    if (action === "check_in") {
      const { error: updateError } = await supabase.from("attendees").update({ status: "present", attended_at: now }).eq("id", attendee.id);
      if (updateError) throw updateError;
    }
    return NextResponse.json({ success: true, name: attendee.name, action, label, recorded_at: now });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not record attendance." }, { status: 400 });
  }
}
