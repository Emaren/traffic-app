import type {
  HistoryRangeKey,
  LiveVisitorsResponse,
  OverviewResponse,
  ProjectDetailResponse,
  ProjectGraphRangeKey,
  ProjectGraphResponse,
  ProjectLiveFeedResponse,
  ProjectHumanSeriesResponse,
  VisibilityRule,
  VisitorProfileResponse,
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

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchAppJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `Request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function fetchOverview(): Promise<OverviewResponse> {
  return fetchJson<OverviewResponse>("/api/overview");
}

export async function fetchOverviewRange(
  rangeKey: HistoryRangeKey = "24h",
): Promise<OverviewResponse> {
  return fetchJson<OverviewResponse>(`/api/overview?range_key=${rangeKey}`);
}

export async function fetchLiveVisitors(
  limit = 25,
  historyLimit = 95,
): Promise<LiveVisitorsResponse> {
  return fetchJson<LiveVisitorsResponse>(
    `/api/live-visitors?limit=${limit}&history_limit=${historyLimit}`,
  );
}

export async function fetchProjectHumanSeries(
  rangeKey: ProjectGraphRangeKey = "24h",
): Promise<ProjectHumanSeriesResponse> {
  return fetchJson<ProjectHumanSeriesResponse>(
    `/api/project-human-series?range_key=${rangeKey}`,
  );
}

export async function fetchProjectDetail(
  slug: string,
  params?: { windowHours?: number; bucketMinutes?: number },
): Promise<ProjectDetailResponse> {
  const search = new URLSearchParams();

  if (params?.windowHours) search.set("window_hours", String(params.windowHours));
  if (params?.bucketMinutes) search.set("bucket_minutes", String(params.bucketMinutes));

  const query = search.toString();
  return fetchJson<ProjectDetailResponse>(
    `/api/projects/${slug}${query ? `?${query}` : ""}`,
  );
}

export async function fetchProjectGraph(
  slug: string,
  rangeKey: ProjectGraphRangeKey = "24h",
): Promise<ProjectGraphResponse> {
  return fetchJson<ProjectGraphResponse>(`/api/projects/${slug}/graph?range_key=${rangeKey}`);
}

export async function fetchProjectLiveFeed(
  slug: string,
  params?: { windowHours?: number; limit?: number },
): Promise<ProjectLiveFeedResponse> {
  const search = new URLSearchParams();

  if (params?.windowHours) search.set("window_hours", String(params.windowHours));
  if (params?.limit) search.set("limit", String(params.limit));

  const query = search.toString();
  return fetchJson<ProjectLiveFeedResponse>(
    `/api/projects/${slug}/live-feed${query ? `?${query}` : ""}`,
  );
}

export async function fetchVisitorProfile(
  visitorId: string,
  params?: { rangeKey?: HistoryRangeKey },
): Promise<VisitorProfileResponse> {
  const search = new URLSearchParams();

  if (params?.rangeKey) search.set("range_key", params.rangeKey);

  const query = search.toString();
  return fetchJson<VisitorProfileResponse>(
    `/api/visitors/${visitorId}${query ? `?${query}` : ""}`,
  );
}

export function buildVisitorProfileStreamUrl(
  visitorId: string,
  params?: { rangeKey?: HistoryRangeKey },
): string {
  const search = new URLSearchParams();

  if (params?.rangeKey) search.set("range_key", params.rangeKey);

  const query = search.toString();
  return buildApiUrl(`/api/visitors/${visitorId}/stream${query ? `?${query}` : ""}`);
}

export function buildLiveVisitorsStreamUrl(params?: {
  limit?: number;
  historyLimit?: number;
  windowHours?: number;
}): string {
  const search = new URLSearchParams();

  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.historyLimit) search.set("history_limit", String(params.historyLimit));
  if (params?.windowHours) search.set("window_hours", String(params.windowHours));

  const query = search.toString();
  return buildApiUrl(`/api/live-visitors/stream${query ? `?${query}` : ""}`);
}

export function buildProjectLiveFeedStreamUrl(
  slug: string,
  params?: { windowHours?: number; limit?: number },
): string {
  const search = new URLSearchParams();

  if (params?.windowHours) search.set("window_hours", String(params.windowHours));
  if (params?.limit) search.set("limit", String(params.limit));

  const query = search.toString();
  return buildApiUrl(`/api/projects/${slug}/live-feed/stream${query ? `?${query}` : ""}`);
}

export async function fetchVisitsHistory(params?: {
  limit?: number;
  offset?: number;
  classification?: string;
  project?: string;
  projects?: string[];
  rangeKey?: HistoryRangeKey;
}): Promise<VisitsHistoryResponse> {
  const search = new URLSearchParams();

  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (params?.classification) search.set("classification", params.classification);
  if (params?.projects?.length) search.set("projects", params.projects.join(","));
  else if (params?.project) search.set("project", params.project);
  if (params?.rangeKey) search.set("range_key", params.rangeKey);

  const query = search.toString();
  return fetchJson<VisitsHistoryResponse>(`/api/visits/history${query ? `?${query}` : ""}`);
}

export async function fetchVisibilityRules(): Promise<{
  ok: boolean;
  generated_at: string;
  rules: VisibilityRule[];
}> {
  return fetchAppJson("/admin-api/visibility-rules");
}

export async function createVisibilityRule(payload: {
  rule_type: VisibilityRule["rule_type"];
  match_value: string;
  label?: string;
  reason?: string;
}): Promise<{
  ok: boolean;
  generated_at: string;
  rule: VisibilityRule;
}> {
  return fetchAppJson("/admin-api/visibility-rules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteVisibilityRule(ruleId: number): Promise<{
  ok: boolean;
  generated_at: string;
}> {
  return fetchAppJson(`/admin-api/visibility-rules/${ruleId}`, {
    method: "DELETE",
  });
}
