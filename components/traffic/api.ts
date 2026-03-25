import type {
  LiveVisitorsResponse,
  OverviewResponse,
  ProjectHumanSeriesResponse,
  VisitsHistoryResponse,
} from "@/components/traffic/types";

function trimBaseUrl(raw: string | undefined): string {
  if (!raw) return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return trimBaseUrl(
      process.env.TRAFFIC_API_BASE_URL ||
        process.env.NEXT_PUBLIC_TRAFFIC_API_BASE_URL ||
        "http://127.0.0.1:3345",
    );
  }

  return trimBaseUrl(process.env.NEXT_PUBLIC_TRAFFIC_API_BASE_URL);
}

async function fetchJson<T>(path: string): Promise<T> {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function fetchOverview(): Promise<OverviewResponse> {
  return fetchJson<OverviewResponse>("/api/overview");
}

export async function fetchLiveVisitors(limit = 25): Promise<LiveVisitorsResponse> {
  return fetchJson<LiveVisitorsResponse>(`/api/live-visitors?limit=${limit}`);
}

export async function fetchProjectHumanSeries(
  windowHours = 24,
  bucketMinutes = 30,
): Promise<ProjectHumanSeriesResponse> {
  return fetchJson<ProjectHumanSeriesResponse>(
    `/api/project-human-series?window_hours=${windowHours}&bucket_minutes=${bucketMinutes}`,
  );
}

export async function fetchVisitsHistory(params?: {
  limit?: number;
  offset?: number;
  classification?: string;
  project?: string;
  windowHours?: number;
}): Promise<VisitsHistoryResponse> {
  const search = new URLSearchParams();

  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (params?.classification) search.set("classification", params.classification);
  if (params?.project) search.set("project", params.project);
  if (params?.windowHours) search.set("window_hours", String(params.windowHours));

  const query = search.toString();
  return fetchJson<VisitsHistoryResponse>(`/api/visits/history${query ? `?${query}` : ""}`);
}
