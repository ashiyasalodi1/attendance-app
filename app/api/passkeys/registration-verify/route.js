import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Biometric verification is not enabled for this attendance system." }, { status: 410 });
}
