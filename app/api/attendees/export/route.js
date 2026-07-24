import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const eventId = searchParams.get("event_id");
  const status = searchParams.get("status");

  if (!eventId) {
    return NextResponse.json(
      { error: "Event ID is required." },
      { status: 400 }
    );
  }

  if (status !== "present" && status !== "absent") {
    return NextResponse.json(
      { error: "Status must be present or absent." },
      { status: 400 }
    );
  }

  const { data: attendees, error: attendeesError } = await supabase
    .from("attendees")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (attendeesError) {
    return NextResponse.json(
      { error: attendeesError.message },
      { status: 500 }
    );
  }

  const attendeeIds = attendees.map((attendee) => attendee.id);

  let actions = [];

  if (attendeeIds.length > 0) {
    const { data, error } = await supabase
      .from("attendance_actions")
      .select("attendee_id, action, recorded_at")
      .eq("event_id", eventId)
      .in("attendee_id", attendeeIds)
      .order("recorded_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    actions = data || [];
  }

  const actionsByAttendee = {};

  for (const action of actions) {
    if (!actionsByAttendee[action.attendee_id]) {
      actionsByAttendee[action.attendee_id] = [];
    }

    actionsByAttendee[action.attendee_id].push(action);
  }

  const rows = [
    [
      "Name",
      "Employee Code",
      "WhatsApp Number",
      "Division",
      "Status",
      "Registration Time",
      "First Check-In Time",
      "Latest Check-Out Time",
    ],
  ];

  for (const attendee of attendees) {
    const attendeeActions = actionsByAttendee[attendee.id] || [];

    const firstCheckIn = attendeeActions.find(
      (action) => action.action === "check_in"
    );

    const checkOutActions = attendeeActions.filter(
      (action) => action.action === "check_out"
    );

    const latestCheckOut =
      checkOutActions.length > 0
        ? checkOutActions[checkOutActions.length - 1]
        : null;

    rows.push([
      attendee.name || "",
      attendee.employee_code ? `'${attendee.employee_code}` : "",
      attendee.whatsapp ? `'${attendee.whatsapp}` : "",
      attendee.division || "",
      attendee.status || "",
      formatIndiaTime(attendee.created_at),
      formatIndiaTime(firstCheckIn?.recorded_at),
      formatIndiaTime(latestCheckOut?.recorded_at),
    ]);
  }

  const csv =
    "\uFEFF" +
    rows.map((row) => row.map(csvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${status}-attendees.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
