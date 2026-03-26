import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function PUT(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  try {
    const response = await trafficAdminRequest("/api/admin/notifications/settings", {
      method: "PUT",
      body: JSON.stringify(payload || {}),
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not save settings" },
      { status: 500 },
    );
  }
}
