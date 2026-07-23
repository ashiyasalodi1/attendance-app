import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
      { error: "Event is required" },
      { status: 400 }
    );
  }

  if (status !== "present" && status !== "absent") {
    return NextResponse.json(
      { error: "Status must be present or absent" },
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

  const attendeeIds = (attendees || []).map((attendee) => attendee.id);

  const { data: actions, error: actionsError } = attendeeIds.length
    ? await supabase
        .from("attendance_actions")
        .select("attendee_id, action, recorded_at")
        .in("attendee_id", attendeeIds)
        .order("recorded_at", { ascending: true })
    : { data: [], error: null };

  if (actionsError) {
    return NextResponse.json(
      { error: actionsError.message },
      { status: 500 }
    );
  }

  const actionsByAttendee = (actions || []).reduce((all, action) => {
    if (!all[action.attendee_id]) {
      all[action.attendee_id] = [];
    }

    all[action.attendee_id].push(action);
    return all;
  }, {});

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

    ...(attendees || []).map((attendee) => {
      const attendeeActions = actionsByAttendee[attendee.id] || [];

      const firstCheckIn = attendeeActions.find(
        (action) => action.action === "check_in"
      );

      const latestCheckOut = attendeeActions
        .filter((action) => action.action === "check_out")
        .at(-1);

      return [
        attendee.name,
        attendee.employee_code ? `'${attendee.employee_code}` : "",
        attendee.whatsapp ? `'${attendee.whatsapp}` : "",
        attendee.division,
        attendee.status,
        formatIndiaTime(attendee.created_at),
        formatIndiaTime(firstCheckIn?.recorded_at),
        formatIndiaTime(latestCheckOut?.recorded_at),
      ];
    }),
  ];

  const csv =
    "\uFEFF" +
    rows.map((row) => row.map(csvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${status}-attendees.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
