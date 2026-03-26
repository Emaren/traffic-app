import { NextResponse } from "next/server";
import {
  TRAFFIC_ADMIN_COOKIE,
  adminSessionToken,
  trafficAdminConfigured,
  validAdminPassword,
} from "@/lib/traffic-admin";

export async function POST(request: Request) {
  if (!trafficAdminConfigured()) {
    return NextResponse.json(
      { detail: "Traffic admin is not configured yet on this host." },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = (payload?.password || "").trim();
  if (!validAdminPassword(password)) {
    return NextResponse.json({ detail: "Invalid admin password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: TRAFFIC_ADMIN_COOKIE,
    value: adminSessionToken(),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: TRAFFIC_ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
