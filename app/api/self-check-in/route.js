import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { recordDailyAttendance } from "../../../lib/daily-attendance";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function POST(request) {
  try {
    const body = await request.json();
    const eventSlug = body.event_slug?.trim();
    const employeeCode = body.employee_code?.trim();
    const whatsapp = body.whatsapp?.replace(/\D/g, "");
    const dailyPin = body.daily_pin?.replace(/\D/g, "") || "";

    if (!eventSlug || !employeeCode || !whatsapp) {
      return NextResponse.json(
        { error: "Employee Code and registered WhatsApp number are required." },
        { status: 400 }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name")
      .eq("slug", eventSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event) {
      return NextResponse.json({ error: "This event QR is no longer active." }, { status: 404 });
    }

    const { data: attendee, error: attendeeError } = await supabase
      .from("attendees")
      .select("id, name, event_id, whatsapp")
      .eq("event_id", event.id)
      .eq("employee_code", employeeCode)
      .maybeSingle();

    if (attendeeError) throw attendeeError;
    if (!attendee) {
      return NextResponse.json(
        { error: "You are not registered for this event. Please register first." },
        { status: 404 }
      );
    }

    if ((attendee.whatsapp || "").replace(/\D/g, "") !== whatsapp) {
      return NextResponse.json(
        { error: "This WhatsApp number does not match your registration." },
        { status: 403 }
      );
    }

    const result = await recordDailyAttendance({
      supabase,
      attendee,
      source: "event_qr",
      pin: dailyPin,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error, already_marked: Boolean(result.alreadyMarked) },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      name: attendee.name,
      attendance_date: result.attendanceDate,
      checked_in_at: result.record.checked_in_at,
      message: "Attendance marked successfully for today.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not mark attendance." },
      { status: 500 }
    );
  }
}
