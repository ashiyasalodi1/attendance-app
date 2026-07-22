import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function POST(req) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing QR id" }, { status: 400 });
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
      .update({
        status: "present",
        attended_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      already: false,
      name: updated.name,
      attended_at: updated.attended_at,
    });
  } catch {
    return NextResponse.json({ error: "Invalid QR request" }, { status: 400 });
  }
}
