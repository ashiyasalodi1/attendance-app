import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function indiaDate(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatIndiaTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function duration(actions) {
  let openCheckIn = null;
  let total = 0;
  for (const action of actions) {
    if (action.action === "check_in") openCheckIn = new Date(action.recorded_at);
    if (action.action === "check_out" && openCheckIn) {
      total += new Date(action.recorded_at) - openCheckIn;
      openCheckIn = null;
    }
  }
  const minutes = Math.max(0, Math.round(total / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function todayIndia() {
  return indiaDate(new Date().toISOString());
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("event_id");
    const attendeeId = searchParams.get("attendee_id");
    const status = searchParams.get("status");
    const from = searchParams.get("from") || todayIndia();
    const to = searchParams.get("to") || from;

    if (!eventId) return NextResponse.json({ error: "Event is required" }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return NextResponse.json({ error: "Choose a valid From Date and To Date." }, { status: 400 });
    }

    let attendeeQuery = supabase.from("attendees").select("id, name, employee_code, whatsapp, division, status").eq("event_id", eventId).order("name");
    if (attendeeId) attendeeQuery = attendeeQuery.eq("id", attendeeId);
    const { data: attendees, error: attendeeError } = await attendeeQuery;
    if (attendeeError) throw attendeeError;

    const attendeeIds = (attendees || []).map((attendee) => attendee.id);
    const start = new Date(`${from}T00:00:00+05:30`).toISOString();
    const end = new Date(`${addDays(to, 1)}T00:00:00+05:30`).toISOString();
    const { data: actions, error: actionsError } = attendeeIds.length
      ? await supabase.from("attendance_actions").select("attendee_id, action, recorded_at").in("attendee_id", attendeeIds).gte("recorded_at", start).lt("recorded_at", end).order("recorded_at", { ascending: true })
      : { data: [], error: null };
    if (actionsError) throw actionsError;

    const attendeeById = Object.fromEntries((attendees || []).map((attendee) => [attendee.id, attendee]));
    const byDay = {};
    for (const action of actions || []) {
      const key = `${action.attendee_id}:${indiaDate(action.recorded_at)}`;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(action);
    }

    const reportAttendees = (attendees || []).filter((attendee) => {
      const hasAttendance = Object.keys(byDay).some((key) => key.startsWith(`${attendee.id}:`));
      if (status === "present") return hasAttendance;
      if (status === "absent") return !hasAttendance;
      return true;
    });
    const reportAttendeeIds = new Set(reportAttendees.map((attendee) => attendee.id));

    const detailedRows = Object.entries(byDay)
      .map(([key, dayActions]) => {
        const [id, date] = key.split(":");
        if (!reportAttendeeIds.has(id)) return null;
        const attendee = attendeeById[id];
        const checkIns = dayActions.filter((action) => action.action === "check_in");
        const checkOuts = dayActions.filter((action) => action.action === "check_out");
        return {
          Date: date,
          "Employee Code": attendee.employee_code || "",
          Name: attendee.name,
          WhatsApp: attendee.whatsapp || "",
          Division: attendee.division || "",
          "Check-in 1": formatIndiaTime(checkIns[0]?.recorded_at),
          "Check-out 1": formatIndiaTime(checkOuts[0]?.recorded_at),
          "Check-in 2": formatIndiaTime(checkIns[1]?.recorded_at),
          "Check-out 2": formatIndiaTime(checkOuts[1]?.recorded_at),
          "Total Hours": duration(dayActions),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.Date.localeCompare(b.Date) || a.Name.localeCompare(b.Name));

    const dates = [];
    for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
    const summaryRows = reportAttendees.map((attendee) => {
      const row = { "Employee Code": attendee.employee_code || "", Name: attendee.name, Division: attendee.division || "" };
      for (const date of dates) {
        const dayActions = byDay[`${attendee.id}:${date}`] || [];
        row[date] = dayActions.length ? `P - ${duration(dayActions)}` : "A";
      }
      row["Present Days"] = dates.filter((date) => (byDay[`${attendee.id}:${date}`] || []).length > 0).length;
      return row;
    });

    const workbook = XLSX.utils.book_new();
    const detailedSheet = XLSX.utils.json_to_sheet(detailedRows);
    detailedSheet["!cols"] = [{ wch: 13 }, { wch: 16 }, { wch: 24 }, { wch: 15 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, detailedSheet, "Daily Attendance");
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 18 }, ...dates.map(() => ({ wch: 16 })), { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Monthly Summary");

    const file = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const target = attendeeId ? "individual-attendance" : "attendance-report";
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${target}-${from}-to-${to}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create attendance report." }, { status: 500 });
  }
}
