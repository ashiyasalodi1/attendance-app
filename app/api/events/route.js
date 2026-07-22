import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeSlug(name) {
  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${cleanName || "event"}-${randomBytes(3).toString("hex")}`;
}

export async function GET() {
  try {
    // Get all events
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (eventsError) {
      return NextResponse.json(
        { error: eventsError.message },
        { status: 500 }
      );
    }

    // Get attendees only for calculating event-wise counts
    const { data: attendees, error: attendeesError } = await supabase
      .from("attendees")
      .select("id, event_id, status");

    if (attendeesError) {
      return NextResponse.json(
        { error: attendeesError.message },
        { status: 500 }
      );
    }

    // Add real attendance counts to every event
    const eventsWithCounts = (events || []).map((event) => {
      const eventAttendees = (attendees || []).filter(
        (attendee) => attendee.event_id === event.id
      );

      const presentCount = eventAttendees.filter(
        (attendee) => attendee.status === "present"
      ).length;

      return {
        ...event,
        registered_count: eventAttendees.length,
        present_count: presentCount,
        absent_count: eventAttendees.length - presentCount,
      };
    });

    return NextResponse.json({
      events: eventsWithCounts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Could not load events" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const { name } = await req.json();
    const eventName = name?.trim();

    if (!eventName) {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("events")
      .insert([
        {
          name: eventName,
          slug: makeSlug(eventName),
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        event: {
          ...data,
          registered_count: 0,
          present_count: 0,
          absent_count: 0,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid event request" },
      { status: 400 }
    );
  }
}
