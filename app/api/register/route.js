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
    const whatsapp = body.whatsapp?.trim();
    const city = body.city?.trim();

    if (!name) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    if (!whatsapp) {
      return NextResponse.json(
        { error: "WhatsApp number is required" },
        { status: 400 }
      );
    }

    if (!city) {
      return NextResponse.json({ error: "City is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("attendees")
      .insert([{ name, whatsapp, city }])
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
