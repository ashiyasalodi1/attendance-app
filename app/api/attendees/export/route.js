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

function trackedDuration(firstScan, lastScan) {
  if (!firstScan || !lastScan) return "";
  const minutes = Math.max(0, Math.round((new Date(lastScan) - new Date(firstScan)) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
  const { data: scans, error: scansError } = attendeeIds.length
    ? await supabase.from("attendance_scans").select("attendee_id, checked_at").in("attendee_id", attendeeIds).order("checked_at", { ascending: true })
    : { data: [], error: null };

  if (scansError) {
    return NextResponse.json({ error: scansError.message }, { status: 500 });
  }

  const scansByAttendee = (scans || []).reduce((all, scan) => {
    if (!all[scan.attendee_id]) all[scan.attendee_id] = [];
    all[scan.attendee_id].push(scan.checked_at);
    return all;
  }, {});

  const rows = [
    ["Name", "Employee Code", "WhatsApp Number", "Division", "Status", "Registered At", "First Scan", "Last Scan", "Scan Count", "Time Between First and Last Scan"],
    ...(data || []).map((attendee) => {
      const attendeeScans = scansByAttendee[attendee.id] || [];
      const firstScan = attendeeScans[0];
      const lastScan = attendeeScans.at(-1);
      return [
      attendee.name,
      attendee.employee_code,
      attendee.whatsapp,
      attendee.division,
      attendee.status,
      attendee.created_at
        ? new Date(attendee.created_at).toLocaleString()
        : "",
      firstScan
        ? new Date(firstScan).toLocaleString()
        : "",
      lastScan
        ? new Date(lastScan).toLocaleString()
        : "",
      attendeeScans.length,
      trackedDuration(firstScan, lastScan),
    ];
    }),
  ];

  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${status}-attendees.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
