import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const search = new URLSearchParams();
  search.set("project_slug", url.searchParams.get("project_slug") || "aoe2hdbets");
  search.set("limit", url.searchParams.get("limit") || "100");
  const status = url.searchParams.get("status");
  if (status) search.set("status", status);
  const before = url.searchParams.get("before_created_at");
  if (before) search.set("before_created_at", before);
  try {
    return NextResponse.json(await trafficAdminRequest(`/api/admin/performance/reports?${search}`));
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Could not load Speed Reports" }, { status: 500 });
  }
}
