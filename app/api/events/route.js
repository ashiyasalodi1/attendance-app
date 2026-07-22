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

/* =========================
   GET ALL EVENTS
========================= */

export async function GET() {
  try {
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

    const { data: attendees, error: attendeesError } = await supabase
      .from("attendees")
      .select("id, event_id, status");

    if (attendeesError) {
      return NextResponse.json(
        { error: attendeesError.message },
        { status: 500 }
      );
    }

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
      {
        error: error.message || "Could not load events",
      },
      { status: 500 }
    );
  }
}

/* =========================
   CREATE EVENT
========================= */

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

/* =========================
   DELETE EVENT
========================= */

export async function DELETE(req) {
  try {
    const { event_id } = await req.json();

    if (!event_id) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    /*
      STEP 1:
      Make sure event actually exists.
    */

    const { data: existingEvent, error: findError } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", event_id)
      .maybeSingle();

    if (findError) {
      return NextResponse.json(
        { error: findError.message },
        { status: 500 }
      );
    }

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    /*
      STEP 2:
      Delete all registrations belonging
      to this event.
    */

    const { error: attendeesDeleteError } = await supabase
      .from("attendees")
      .delete()
      .eq("event_id", event_id);

    if (attendeesDeleteError) {
      return NextResponse.json(
        {
          error:
            "Could not delete event registrations: " +
            attendeesDeleteError.message,
        },
        { status: 500 }
      );
    }

    /*
      STEP 3:
      Delete the event itself.

      Once the event is deleted, its old
      registration link will no longer
      point to a valid event.
    */

    const { error: eventDeleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", event_id);

    if (eventDeleteError) {
      return NextResponse.json(
        {
          error:
            "Registrations were deleted, but event deletion failed: " +
            eventDeleteError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${existingEvent.name} deleted successfully`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Could not delete event",
      },
      { status: 500 }
    );
  }
}

/* =========================
   UPDATE EVENT (RENAME)
========================= */

export async function PATCH(req) {
  try {
    const { event_id, name } = await req.json();
    const eventName = name?.trim();

    if (!event_id) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    if (!eventName) {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 }
      );
    }

    const { data: existingEvent, error: findError } = await supabase
      .from("events")
      .select("id")
      .eq("id", event_id)
      .maybeSingle();

    if (findError) {
      return NextResponse.json(
        { error: findError.message },
        { status: 500 }
      );
    }

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("events")
      .update({ name: eventName })
      .eq("id", event_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      event: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Could not update event",
      },
      { status: 500 }
    );
  }
}
