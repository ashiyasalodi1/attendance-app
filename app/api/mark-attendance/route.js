import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("attendees")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "QR not recognized" }, { status: 404 });
  }

  if (existing.status === "present") {
    return NextResponse.json({
      already: true,
      name: existing.name,
      attended_at: existing.attended_at,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("attendees")
    .update({ status: "present", attended_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ already: false, name: updated.name, attended_at: updated.attended_at });
}
