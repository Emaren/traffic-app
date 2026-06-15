import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = new URLSearchParams();

  search.set("limit", url.searchParams.get("limit") || "120");
  search.set("since_hours", url.searchParams.get("since_hours") || "24");

  const before = url.searchParams.get("before_event_timestamp");
  if (before) {
    search.set("before_event_timestamp", before);
  }

  try {
    const response = await trafficAdminRequest(`/api/admin/notifications/events?${search.toString()}`);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not load notification events" },
      { status: 500 },
    );
  }
}
