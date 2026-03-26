import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function POST() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await trafficAdminRequest("/api/admin/notifications/test", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not send test notification" },
      { status: 500 },
    );
  }
}
