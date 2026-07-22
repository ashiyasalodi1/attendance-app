import { NextResponse } from "next/server";
import { createOwnerSession, verifyOwnerPassword } from "../../../lib/owner-auth";

export async function POST(req) {
  try {
    const { password } = await req.json();

    if (!process.env.OWNER_DASHBOARD_PASSWORD || !process.env.OWNER_SESSION_SECRET) {
      return NextResponse.json(
        { error: "Owner login environment variables are missing" },
        { status: 500 }
      );
    }

    if (!verifyOwnerPassword(password)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set("owner_session", createOwnerSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login request failed" }, { status: 400 });
  }
}
