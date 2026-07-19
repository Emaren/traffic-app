import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ sampleId: string }> }) {
  if (!(await hasAdminSession())) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  const { sampleId } = await params;
  try {
    return NextResponse.json(await trafficAdminRequest(`/api/admin/performance/samples/${encodeURIComponent(sampleId)}`));
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Could not load performance sample" }, { status: 500 });
  }
}
