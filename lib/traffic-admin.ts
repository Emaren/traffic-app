import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NotificationDashboardResponse } from "@/components/traffic/types";

export const TRAFFIC_ADMIN_COOKIE = "traffic_admin_session";

function trimBaseUrl(raw: string | undefined): string {
  if (!raw) return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function trafficApiBaseUrl(): string {
  return trimBaseUrl(
    process.env.TRAFFIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_TRAFFIC_API_BASE_URL ||
      "http://127.0.0.1:3345",
  );
}

export function trafficAdminPassword(): string {
  return (process.env.TRAFFIC_ADMIN_PASSWORD || "").trim();
}

export function trafficAdminApiKey(): string {
  return (process.env.TRAFFIC_ADMIN_API_KEY || "").trim();
}

export function trafficAdminConfigured(): boolean {
  return Boolean(trafficAdminPassword() && trafficAdminApiKey());
}

export function adminSessionToken(): string {
  const password = trafficAdminPassword();
  if (!password) return "";
  return createHash("sha256").update(`traffic-admin:${password}`).digest("hex");
}

export function validAdminPassword(input: string): boolean {
  const expected = trafficAdminPassword();
  if (!expected) return false;

  const incomingBuffer = Buffer.from(input || "", "utf-8");
  const expectedBuffer = Buffer.from(expected, "utf-8");
  if (incomingBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(incomingBuffer, expectedBuffer);
}

export function validAdminSessionValue(value: string | null | undefined): boolean {
  const expected = adminSessionToken();
  if (!expected || !value) return false;

  const incomingBuffer = Buffer.from(value, "utf-8");
  const expectedBuffer = Buffer.from(expected, "utf-8");
  if (incomingBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(incomingBuffer, expectedBuffer);
}

export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return validAdminSessionValue(cookieStore.get(TRAFFIC_ADMIN_COOKIE)?.value);
}

export async function requireAdminSessionOrThrow(): Promise<void> {
  if (!(await hasAdminSession())) {
    throw new Error("Unauthorized");
  }
}

export async function trafficAdminRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiKey = trafficAdminApiKey();
  if (!apiKey) {
    throw new Error("Traffic admin API key is not configured on the web app.");
  }

  const response = await fetch(`${trafficApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": apiKey,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `Traffic admin request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function fetchAdminNotificationDashboard(): Promise<NotificationDashboardResponse> {
  return trafficAdminRequest<NotificationDashboardResponse>(
    "/api/admin/notifications/dashboard",
  );
}
