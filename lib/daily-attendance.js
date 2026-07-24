export function indiaDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function getTodaySession(supabase, eventId) {
  const attendanceDate = indiaDate();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("event_id", eventId)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();

  if (error) throw error;
  return { session: data, attendanceDate };
}

export async function recordDailyAttendance({
  supabase,
  attendee,
  source,
  pin = "",
  note = null,
  allowClosed = false,
}) {
  const { session, attendanceDate } = await getTodaySession(
    supabase,
    attendee.event_id
  );
  const now = new Date();

  if (!allowClosed) {
    if (!session || !session.is_open) {
      return {
        error: "Check-in is currently closed. Please ask the owner to open today's check-in.",
        status: 403,
      };
    }

    if (session.closes_at && new Date(session.closes_at) <= now) {
      await supabase
        .from("attendance_sessions")
        .update({ is_open: false, updated_at: now.toISOString() })
        .eq("id", session.id);

      return {
        error: "Today's check-in window has closed.",
        status: 403,
      };
    }

    if (session.daily_pin && session.daily_pin !== String(pin).trim()) {
      return { error: "Enter the correct daily PIN displayed at the venue.", status: 403 };
    }
  }

  const { data, error } = await supabase
    .from("attendance_records")
    .insert({
      attendee_id: attendee.id,
      event_id: attendee.event_id,
      session_id: session?.id || null,
      attendance_date: attendanceDate,
      checked_in_at: now.toISOString(),
      source,
      note,
    })
    .select()
    .single();

  if (error?.code === "23505") {
    return {
      error: "Attendance already marked today.",
      status: 409,
      alreadyMarked: true,
    };
  }

  if (error) throw error;

  // Kept only for the existing dashboard's overall Present card. Daily reports
  // always read attendance_records, never this old single-date field.
  await supabase
    .from("attendees")
    .update({ status: "present", attended_at: data.checked_in_at })
    .eq("id", attendee.id);

  return { record: data, attendanceDate };
}
