import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const search = new URLSearchParams();
  for (const key of ["limit", "project_slug", "since_hours", "before_received_at", "user_query", "route", "build_version", "slow_only"]) {
    const value = url.searchParams.get(key);
    if (value) search.set(key, value);
  }
  if (!search.has("limit")) search.set("limit", "100");
  if (!search.has("project_slug")) search.set("project_slug", "aoe2hdbets");
  if (!search.has("since_hours")) search.set("since_hours", "24");
  try {
    return NextResponse.json(await trafficAdminRequest(`/api/admin/performance/samples?${search}`));
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Could not load performance samples" }, { status: 500 });
  }
}
