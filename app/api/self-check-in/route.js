import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");

function indiaTodayStart() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+05:30`).toISOString();
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

    const { data: event, error: eventError } = await supabase.from("events").select("id, name").eq("slug", eventSlug).eq("is_active", true).maybeSingle();
    if (eventError) throw eventError;
    if (!event) return NextResponse.json({ error: "This event QR is no longer active." }, { status: 404 });

    const { data: attendee, error: attendeeError } = await supabase.from("attendees").select("id, name, whatsapp").eq("event_id", event.id).eq("employee_code", employeeCode).maybeSingle();
    if (attendeeError) throw attendeeError;
    if (!attendee || String(attendee.whatsapp || "").replace(/\D/g, "") !== whatsapp) {
      return NextResponse.json({ error: "Employee Code or WhatsApp number does not match your registration." }, { status: 403 });
    }

    const { count, error: countError } = await supabase
      .from("attendance_actions")
      .select("id", { count: "exact", head: true })
      .eq("attendee_id", attendee.id)
      .eq("action", action)
      .gte("recorded_at", indiaTodayStart());
    if (countError) throw countError;
    if ((count || 0) >= 2) {
      return NextResponse.json({ error: `Only two ${action === "check_in" ? "check-ins" : "check-outs"} can be recorded in one day.` }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { error: actionError } = await supabase.from("attendance_actions").insert({ attendee_id: attendee.id, event_id: event.id, action, source: "event_qr", recorded_at: now });
    if (actionError) throw actionError;

    if (action === "check_in") {
      const { error: updateError } = await supabase.from("attendees").update({ status: "present", attended_at: now }).eq("id", attendee.id);
      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true, name: attendee.name, action, recorded_at: now });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not record attendance." }, { status: 400 });
  }
}
