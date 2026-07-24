import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { indiaDate } from "../../../../lib/daily-attendance";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

function csvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatIndiaTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  }).format(new Date(value));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    const fromDate = searchParams.get("from_date") || indiaDate();
    const toDate = searchParams.get("to_date") || fromDate;

    if (!eventId) return NextResponse.json({ error: "Event ID is required." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
      return NextResponse.json({ error: "Choose a valid From Date and To Date." }, { status: 400 });
    }

    const { data: records, error } = await supabase
      .from("attendance_records")
      .select("attendee_id, attendance_date, checked_in_at, source, note")
      .eq("event_id", eventId)
      .gte("attendance_date", fromDate)
      .lte("attendance_date", toDate)
      .order("attendance_date", { ascending: true })
      .order("checked_in_at", { ascending: true });
    if (error) throw error;

    const attendeeIds = [...new Set((records || []).map((record) => record.attendee_id))];
    const { data: attendees, error: attendeeError } = attendeeIds.length
      ? await supabase.from("attendees").select("id, name, employee_code, whatsapp, division").in("id", attendeeIds)
      : { data: [], error: null };
    if (attendeeError) throw attendeeError;

    const attendeeById = Object.fromEntries((attendees || []).map((attendee) => [attendee.id, attendee]));
    const rows = [
      ["Attendance Date", "Name", "Employee Code", "WhatsApp Number", "Division", "Check-In Time (India)", "Source", "Note"],
      ...(records || []).map((record) => {
        const attendee = attendeeById[record.attendee_id] || {};
        return [
          record.attendance_date,
          attendee.name || "",
          attendee.employee_code ? `'${attendee.employee_code}` : "",
          attendee.whatsapp ? `'${attendee.whatsapp}` : "",
          attendee.division || "",
          formatIndiaTime(record.checked_in_at),
          record.source || "",
          record.note || "",
        ];
      }),
    ];

    const csv = "\uFEFF" + rows.map((row) => row.map(csvValue).join(",")).join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="daily-attendance-${fromDate}-to-${toDate}.csv"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create daily report." }, { status: 500 });
  }
}
