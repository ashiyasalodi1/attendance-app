import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

function formatDuration(milliseconds) {
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function actionSummary(actions) {
  let openCheckIn = null;
  let totalMilliseconds = 0;
  for (const action of actions) {
    if (action.action === "check_in") openCheckIn = new Date(action.recorded_at);
    if (action.action === "check_out" && openCheckIn) {
      totalMilliseconds += new Date(action.recorded_at) - openCheckIn;
      openCheckIn = null;
    }
  }
  return { total: formatDuration(totalMilliseconds), open: Boolean(openCheckIn) };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const eventId = searchParams.get("event_id");

  if (!eventId) {
    return NextResponse.json({ error: "Event is required" }, { status: 400 });
  }

  if (status !== "present" && status !== "absent") {
    return NextResponse.json(
      { error: "Status must be present or absent" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("attendees")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const attendeeIds = (data || []).map((attendee) => attendee.id);
  const { data: actions, error: actionsError } = attendeeIds.length
    ? await supabase.from("attendance_actions").select("attendee_id, action, source, recorded_at").in("attendee_id", attendeeIds).order("recorded_at", { ascending: true })
    : { data: [], error: null };

  if (actionsError) {
    return NextResponse.json({ error: actionsError.message }, { status: 500 });
  }

  const actionsByAttendee = (actions || []).reduce((all, action) => {
    if (!all[action.attendee_id]) all[action.attendee_id] = [];
    all[action.attendee_id].push(action);
    return all;
  }, {});

  const { data: scans, error: scansError } = attendeeIds.length
    ? await supabase.from("attendance_scans").select("attendee_id, checked_at").in("attendee_id", attendeeIds).order("checked_at", { ascending: true })
    : { data: [], error: null };
  if (scansError) return NextResponse.json({ error: scansError.message }, { status: 500 });
  const scansByAttendee = (scans || []).reduce((all, scan) => {
    if (!all[scan.attendee_id]) all[scan.attendee_id] = [];
    all[scan.attendee_id].push(scan.checked_at);
    return all;
  }, {});

  const rows = [
    ["Name", "Employee Code", "WhatsApp Number", "Division", "Status", "Registration Time", "First Check-In Time", "Latest Check-Out Time", "Action Count", "Completed Attendance Time", "Currently Checked In", "Confirmation Scan Count", "First Confirmation Scan", "Last Confirmation Scan", "All Confirmation Scan Times"],
    ...(data || []).map((attendee) => {
      const attendeeActions = actionsByAttendee[attendee.id] || [];
      const firstCheckIn = attendeeActions.find((item) => item.action === "check_in");
      const latestCheckOut = attendeeActions.filter((item) => item.action === "check_out").at(-1);
      const summary = actionSummary(attendeeActions);
      const attendeeScans = scansByAttendee[attendee.id] || [];
      return [
      attendee.name,
      attendee.employee_code ? `'${attendee.employee_code}` : "",
      attendee.whatsapp ? `'${attendee.whatsapp}` : "",
      attendee.division,
      attendee.status,
      attendee.created_at
        ? new Date(attendee.created_at).toLocaleString()
        : "",
      firstCheckIn
        ? new Date(firstCheckIn.recorded_at).toLocaleString()
        : "",
      latestCheckOut
        ? new Date(latestCheckOut.recorded_at).toLocaleString()
        : "",
      attendeeActions.length,
      summary.total,
      summary.open ? "Yes" : "No",
      attendeeScans.length,
      attendeeScans[0] ? new Date(attendeeScans[0]).toLocaleString() : "",
      attendeeScans.at(-1) ? new Date(attendeeScans.at(-1)).toLocaleString() : "",
      attendeeScans.map((time) => new Date(time).toLocaleString()).join(" | "),
    ];
    }),
  ];

  // UTF-8 BOM makes Excel display text correctly instead of mojibake characters.
  const csv = "\uFEFF" + rows.map((row) => row.map(csvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${status}-attendees.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
