import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ muteId: string }> },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { muteId } = await params;
  try {
    const response = await trafficAdminRequest(`/api/admin/notifications/mutes/${muteId}`, {
      method: "DELETE",
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not delete mute" },
      { status: 500 },
    );
  }
}
