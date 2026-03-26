import { NextResponse } from "next/server";
import { fetchAdminNotificationDashboard, hasAdminSession } from "@/lib/traffic-admin";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const dashboard = await fetchAdminNotificationDashboard();
    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not load dashboard" },
      { status: 500 },
    );
  }
}
