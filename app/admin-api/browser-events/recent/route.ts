import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = new URLSearchParams();

  search.set("limit", url.searchParams.get("limit") || "60");
  search.set("project_slug", url.searchParams.get("project_slug") || "aoe2hdbets");

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
