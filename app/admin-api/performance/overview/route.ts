import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const search = new URLSearchParams();
  search.set("project_slug", url.searchParams.get("project_slug") || "aoe2hdbets");
  search.set("since_hours", url.searchParams.get("since_hours") || "24");
  const buildVersion = url.searchParams.get("build_version");
  if (buildVersion) search.set("build_version", buildVersion);
  try {
    return NextResponse.json(await trafficAdminRequest(`/api/admin/performance/overview?${search}`));
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Could not load performance overview" }, { status: 500 });
  }
}
