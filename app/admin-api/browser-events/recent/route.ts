import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = new URLSearchParams();

  search.set("limit", url.searchParams.get("limit") || "80");
  search.set("project_slug", url.searchParams.get("project_slug") || "aoe2hdbets");
  search.set("since_hours", url.searchParams.get("since_hours") || "24");

  const before = url.searchParams.get("before_received_at");
  if (before) {
    search.set("before_received_at", before);
  }

  try {
    const response = await trafficAdminRequest(
      `/api/admin/browser-events/recent?${search.toString()}`,
    );
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not load browser events" },
      { status: 500 },
    );
  }
}
