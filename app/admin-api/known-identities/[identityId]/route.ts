import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ identityId: string }> },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { identityId } = await params;

  try {
    const response = await trafficAdminRequest(`/api/admin/known-identities/${identityId}`, {
      method: "DELETE",
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not delete known identity" },
      { status: 500 },
    );
  }
}
