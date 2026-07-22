import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

export async function GET() {
  const { data, error } = await supabase
    .from("attendees")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ attendees: data });
}
