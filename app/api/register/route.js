import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  const body = await req.json();
  const { name, email, phone, whatsapp, city, event_name } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!email || !email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!phone || !phone.trim()) {
    return NextResponse.json({ error: "Phone is required" }, { status: 400 });
  }
  if (!whatsapp || !whatsapp.trim()) {
    return NextResponse.json({ error: "WhatsApp number is required" }, { status: 400 });
  }
  if (!city || !city.trim()) {
    return NextResponse.json({ error: "City is required" }, { status: 400 });
  }
  if (!event_name || !event_name.trim()) {
    return NextResponse.json({ error: "Event name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("attendees")
    .insert([{ name: name.trim(), email, phone, whatsapp, city, event_name }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attendee: data });
}
