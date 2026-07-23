import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

function csvValue(value) {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function formatExportDate(value) {
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

function formatDuration(milliseconds) {
  const minutes = Math.max(0, Math.round(milliseconds / 60000));

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function actionSummary(actions) {
  let openCheckIn = null;
  let totalMilliseconds = 0;

  for (const action of actions) {
    if (action.action === "check_in") {
      openCheckIn = new Date(action.recorded_at);
    }

    if (action.action === "check_out" && openCheckIn) {
      totalMilliseconds += new Date(action.recorded_at) - openCheckIn;
      openCheckIn = null;
    }
  }

  return {
    total: formatDuration(totalMilliseconds),
    open: Boolean(openCheckIn),
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event_id");
  const status = searchParams.get("status");

  let query = supabase
    .from("attendees")
    .select("*")
    .order("created_at", { ascending: false });

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  if (status === "present" || status === "absent") {
    query = query.eq("status", status);
  }

  const { data: attendees, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const attendeeIds = (attendees || []).map((attendee) => attendee.id);

  const { data: actions, error: actionsError } = attendeeIds.length
    ? await supabase
        .from("attendance_actions")
        .select("attendee_id, action, source, recorded_at")
        .in("attendee_id", attendeeIds)
        .order("recorded_at", { ascending: true })
    : { data: [], error: null };

  if (actionsError) {
    return NextResponse.json(
      { error: actionsError.message },
      { status: 500 }
    );
  }

  const { data: scans, error: scansError } = attendeeIds.length
    ? await supabase
        .from("attendance_scans")
        .select("attendee_id, checked_at")
        .in("attendee_id", attendeeIds)
        .order("checked_at", { ascending: true })
    : { data: [], error: null };

  if (scansError) {
    return NextResponse.json(
      { error: scansError.message },
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

  const scansByAttendee = (scans || []).reduce((all, scan) => {
    if (!all[scan.attendee_id]) {
      all[scan.attendee_id] = [];
    }

    all[scan.attendee_id].push(scan.checked_at);
    return all;
  }, {});

  // status present/absent means user clicked Download Report.
  if (status === "present" || status === "absent") {
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
        "Action Count",
        "Completed Attendance Time",
        "Currently Checked In",
        "Confirmation Scan Count",
        "First Confirmation Scan",
        "Last Confirmation Scan",
        "All Confirmation Scan Times",
      ],

      ...(attendees || []).map((attendee) => {
        const attendeeActions = actionsByAttendee[attendee.id] || [];
        const attendeeScans = scansByAttendee[attendee.id] || [];

        const firstCheckIn = attendeeActions.find(
          (item) => item.action === "check_in"
        );

        const latestCheckOut = attendeeActions
          .filter((item) => item.action === "check_out")
          .at(-1);

        const summary = actionSummary(attendeeActions);

        return [
          attendee.name,
          attendee.employee_code ? `'${attendee.employee_code}` : "",
          attendee.whatsapp ? `'${attendee.whatsapp}` : "",
          attendee.division,
          attendee.status,
          formatExportDate(attendee.created_at),
          formatExportDate(firstCheckIn?.recorded_at),
          formatExportDate(latestCheckOut?.recorded_at),
          attendeeActions.length,
          summary.total,
          summary.open ? "Yes" : "No",
          attendeeScans.length,
          formatExportDate(attendeeScans[0]),
          formatExportDate(attendeeScans.at(-1)),
          attendeeScans
            .map((time) => formatExportDate(time))
            .join(" | "),
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

  // No status means Dashboard is loading attendee data.
  const latestCheckoutByAttendee = {};

  for (const action of actions || []) {
    if (
      action.action === "check_out" &&
      !latestCheckoutByAttendee[action.attendee_id]
    ) {
      latestCheckoutByAttendee[action.attendee_id] =
        action.recorded_at;
    }
  }

  const dashboardAttendees = (attendees || []).map((attendee) => ({
    ...attendee,
    checked_out_at:
      latestCheckoutByAttendee[attendee.id] || null,
  }));

  return NextResponse.json(
    { attendees: dashboardAttendees },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}
