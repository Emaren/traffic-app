import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  if (!(await hasAdminSession())) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  const { reportId } = await params;
  const payload = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(await trafficAdminRequest(`/api/admin/performance/reports/${encodeURIComponent(reportId)}/status`, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Could not update Speed Report" }, { status: 500 });
  }
}
