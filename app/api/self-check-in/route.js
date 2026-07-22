import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function POST(request) {
  try {
    const body = await request.json();
    const eventSlug = body.event_slug?.trim();
    const employeeCode = body.employee_code?.trim();
    const whatsapp = body.whatsapp?.replace(/\D/g, "");
    if (!eventSlug || !employeeCode || !whatsapp) return NextResponse.json({ error: "Employee code and WhatsApp number are required" }, { status: 400 });

    const { data: event, error: eventError } = await supabase.from("events").select("id").eq("slug", eventSlug).eq("is_active", true).single();
    if (eventError || !event) return NextResponse.json({ error: "This event QR is no longer active" }, { status: 404 });

    const { data: attendees, error: attendeeError } = await supabase.from("attendees").select("id, name, status, attended_at").eq("event_id", event.id).eq("employee_code", employeeCode).eq("whatsapp", whatsapp).limit(1);
    if (attendeeError) return NextResponse.json({ error: attendeeError.message }, { status: 500 });
    const attendee = attendees?.[0];
    if (!attendee) return NextResponse.json({ error: "Registration not found. Use the event registration link first." }, { status: 404 });
    if (attendee.status === "present") return NextResponse.json({ already: true, name: attendee.name, attended_at: attendee.attended_at });

    const { data: updated, error: updateError } = await supabase.from("attendees").update({ status: "present", attended_at: new Date().toISOString() }).eq("id", attendee.id).select("name, attended_at").single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ already: false, name: updated.name, attended_at: updated.attended_at });
  } catch {
    return NextResponse.json({ error: "Invalid check-in request" }, { status: 400 });
  }
}
