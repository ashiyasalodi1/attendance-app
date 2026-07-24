import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { indiaDate } from "../../../lib/daily-attendance";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    const date = searchParams.get("date") || indiaDate();

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("attendance_sessions")
      .select("id, event_id, attendance_date, is_open, opened_at, closes_at, daily_pin")
      .eq("event_id", eventId)
      .eq("attendance_date", date)
      .maybeSingle();

    if (error) throw error;
    const safeSession = data
      ? { ...data, has_daily_pin: Boolean(data.daily_pin), daily_pin: undefined }
      : null;
    return NextResponse.json({ session: safeSession, attendance_date: date }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not load session." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { event_id: eventId, action, duration_minutes: durationMinutes, daily_pin: dailyPin } = await request.json();

    if (!eventId || !["open", "close"].includes(action)) {
      return NextResponse.json({ error: "Event and valid session action are required." }, { status: 400 });
    }

    const attendanceDate = indiaDate();
    const now = new Date();

    if (action === "close") {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .update({ is_open: false, closes_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("event_id", eventId)
        .eq("attendance_date", attendanceDate)
        .select()
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({
        session: data ? { ...data, has_daily_pin: Boolean(data.daily_pin), daily_pin: undefined } : null,
        message: "Today's check-in is closed.",
      });
    }

    const minutes = Number(durationMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720) {
      return NextResponse.json({ error: "Duration must be between 1 and 720 minutes." }, { status: 400 });
    }

    const closesAt = new Date(now.getTime() + minutes * 60 * 1000).toISOString();
    const pin = String(dailyPin || "").replace(/\D/g, "");
    if (pin && !/^\d{4,8}$/.test(pin)) {
      return NextResponse.json({ error: "Daily PIN must contain 4 to 8 digits." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("attendance_sessions")
      .upsert({
        event_id: eventId,
        attendance_date: attendanceDate,
        is_open: true,
        opened_at: now.toISOString(),
        closes_at: closesAt,
        daily_pin: pin || null,
        updated_at: now.toISOString(),
      }, { onConflict: "event_id,attendance_date" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({
      session: { ...data, has_daily_pin: Boolean(data.daily_pin), daily_pin: undefined },
      message: "Today's check-in is open.",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update session." }, { status: 500 });
  }
}
