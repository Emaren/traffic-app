import { NextResponse } from "next/server";
import { hasAdminSession, trafficAdminRequest } from "@/lib/traffic-admin";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await trafficAdminRequest("/api/admin/visibility-rules");
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not load visibility rules" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  try {
    const response = await trafficAdminRequest("/api/admin/visibility-rules", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not create visibility rule" },
      { status: 500 },
    );
  }
}
