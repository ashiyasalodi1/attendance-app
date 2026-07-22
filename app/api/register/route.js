import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const whatsapp = body.whatsapp?.replace(/\D/g, "");
    const city = body.city?.trim();
    const eventSlug = body.event_slug?.trim();

    if (!name) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    if (!whatsapp || !/^[6-9]\d{9}$/.test(whatsapp)) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit WhatsApp number" },
        { status: 400 }
      );
    }

    if (!city) {
      return NextResponse.json({ error: "City is required" }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name")
      .eq("slug", eventSlug)
      .eq("is_active", true)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "This event link is not available" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("attendees")
      .insert([
        {
          name,
          email,
          whatsapp,
          city,
          event_id: event.id,
          status: "absent",
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attendee: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid registration request" },
      { status: 400 }
    );
  }
}
