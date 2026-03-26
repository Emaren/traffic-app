import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ subscriptionId: string }> },
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { subscriptionId } = await params;
  try {
    const response = await trafficAdminRequest(
      `/api/admin/web-push/subscriptions/${subscriptionId}`,
      {
        method: "DELETE",
      },
    );
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not remove device" },
      { status: 500 },
    );
  }
}
