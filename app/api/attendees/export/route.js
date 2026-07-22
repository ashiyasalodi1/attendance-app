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

  const rows = [
    ["Name", "Employee Code", "WhatsApp Number", "Division", "Status", "Registered At", "Checked In At"],
    ...(data || []).map((attendee) => [
      attendee.name,
      attendee.employee_code,
      attendee.whatsapp,
      attendee.division,
      attendee.status,
      attendee.created_at
        ? new Date(attendee.created_at).toLocaleString()
        : "",
      attendee.attended_at
        ? new Date(attendee.attended_at).toLocaleString()
        : "",
    ]),
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
