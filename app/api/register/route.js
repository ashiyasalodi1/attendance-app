import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function POST(req) {
  try {
    const body = await req.json();
    const name = body.name?.trim();
    const employeeCode = body.employee_code?.trim();
    const whatsapp = body.whatsapp?.replace(/\D/g, "");
    const division = body.division?.trim();
    const eventSlug = body.event_slug?.trim();
    const photoUrl = body.photo_url?.trim() || null;
    if (!name || !employeeCode || !division) return NextResponse.json({ error: "Name, employee code and division are required" }, { status: 400 });
    if (!whatsapp || !/^[6-9]\d{9}$/.test(whatsapp)) return NextResponse.json({ error: "Enter a valid 10-digit WhatsApp number" }, { status: 400 });
    const { data: event, error: eventError } = await supabase.from("events").select("id").eq("slug", eventSlug).eq("is_active", true).single();
    if (eventError || !event) return NextResponse.json({ error: "This event link is not available" }, { status: 404 });
    const { data: existingAttendee, error: duplicateCheckError } = await supabase
      .from("attendees")
      .select("id")
      .eq("event_id", event.id)
      .eq("employee_code", employeeCode)
      .maybeSingle();
    if (duplicateCheckError) return NextResponse.json({ error: duplicateCheckError.message }, { status: 500 });
    if (existingAttendee) {
      return NextResponse.json(
        { error: "You are already registered for this event with this Employee Code. Duplicate registration is not allowed." },
        { status: 409 }
      );
    }
    const { data, error } = await supabase.from("attendees").insert({ name, employee_code: employeeCode, whatsapp, division, photo_url: photoUrl, event_id: event.id, status: "absent" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attendee: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid registration request" }, { status: 400 });
  }
}
