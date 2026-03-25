export type Severity = "low" | "medium" | "high";

export type OverviewTotals = {
  requests: number;
  humans: number;
  bots: number;
  suspicious: number;
  unknown: number;
  unique_visitors: number;
  total_visitors: number;
  real_humans: number;
  suspected_bots: number;
  live_now: number;
  returning_visitors: number;
  projects_active: number;
  sessions: number;
  engaged_sessions: number;
  avg_session_seconds: number;
  avg_page_seconds: number;
};

export type ProjectSummary = {
  slug: string;
  name: string;
  category: string;
  requests: number;
  sessions: number;
  engaged_sessions: number;
  human_confirmed_sessions?: number;
  suspicious: number;
};

export type HostSummary = {
  host: string;
  project_slug: string;
  requests: number;
  unique_visitors: number;
  sessions: number;
  human_requests: number;
  bot_requests: number;
  suspicious_requests: number;
  top_entry_page: string;
  top_exit_page: string;
  avg_session_seconds: number;
};

export type SuspiciousPath = {
  path: string;
  count: number;
};

export type SuspiciousIp = {
  ip: string;
  country: string;
  count: number;
  category: string;
  last_seen?: string | null;
};

export type TopPage = {
  path: string;
  route_kind: string;
  entries: number;
  views: number;
  exits: number;
  avg_seconds: number;
  top_next_paths: Array<{ path: string; count: number }>;
};

export type GeoRowCountry = {
  country: string;
  sessions: number;
  requests: number;
};

export type GeoRowArea = {
  country: string;
  area: string;
  sessions: number;
};

export type GeoRowCity = {
  country: string;
  area: string;
  city: string;
  sessions: number;
};

export type AlertRow = {
  severity: Severity;
  title: string;
  count: number;
};

export type SessionRecord = {
  session_id: string;
  visitor_key: string;
  person_key: string;
  visitor_alias: string;
  project_slug: string;
  project_name: string;
  project_category: string;
  host: string;
  ip: string;
  started_at: string;
  ended_at: string;
  first_seen_at: string;
  last_seen_at: string;
  last_page_request_at: string;
  first_seen_alberta: string;
  last_seen_alberta: string;
  country: string;
  country_code: string;
  area: string;
  city: string;
  device: string;
  os: string;
  browser: string;
  referrer: string;
  source: string;
  medium: string;
  campaign: string;
  entry_page: string;
  current_page: string;
  exit_page: string;
  next_page: string;
  page_sequence: string[];
  page_count: number;
  event_count: number;
  total_seconds: number;
  engaged_seconds: number;
  idle_seconds: number;
  active_now: boolean;
  suspicious_score: number;
  primary_category: string;
  route_kind: string;
  quality_score: number;
  quality_label: string;
  human_confidence: number;
  classification_state:
    | "candidate"
    | "likely_human"
    | "human_confirmed"
    | "bot"
    | "suspicious"
    | "archived";
  verdict_label: string;
  classification_summary: string;
  classification_reasons: string[];
  classification_reason_labels: string[];
  data_confidence_label: string;
  data_confidence_summary: string;
  attention_label: string;
  attention_summary: string;
  human_confirmed: boolean;
  visits_in_window: number;
  project_visits_in_window: number;
  total_project_visits: number;
  times_returned_in_project: number;
  projects_visited_in_window: number;
  returning_visitor: boolean;
  live_priority: number;
};

export type OverviewResponse = {
  ok: boolean;
  generated_at: string;
  window: string;
  totals: OverviewTotals;
  projects: ProjectSummary[];
  hosts: HostSummary[];
  suspicious: {
    top_paths: SuspiciousPath[];
    top_ips: SuspiciousIp[];
  };
  recent_sessions: SessionRecord[];
  top_pages: TopPage[];
  geo: {
    countries: GeoRowCountry[];
    areas: GeoRowArea[];
    cities: GeoRowCity[];
  };
  alerts: AlertRow[];
  notes: string[];
};

export type LiveProjectCount = {
  slug: string;
  name: string;
  human_confirmed: number;
  likely_human: number;
  candidate: number;
  active_now: number;
};

export type LiveVisitorsResponse = {
  ok: boolean;
  generated_at: string;
  window_hours: number;
  tower_limit: number;
  history_count: number;
  stream_total: number;
  stream_items: SessionRecord[];
  project_counts: LiveProjectCount[];
  top_25: SessionRecord[];
  history_preview: SessionRecord[];
};

export type HumanSeriesPoint = {
  bucket_start: string;
  label: string;
  visitors: number;
};

export type HumanSeriesProject = {
  slug: string;
  name: string;
  live_humans: number;
  points: HumanSeriesPoint[];
};

export type ProjectHumanSeriesResponse = {
  ok: boolean;
  generated_at: string;
  window_hours: number;
  bucket_minutes: number;
  series_kind: string;
  projects: HumanSeriesProject[];
};

export type VisitsHistoryResponse = {
  ok: boolean;
  generated_at: string;
  window_hours: number;
  offset: number;
  limit: number;
  total: number;
  items: SessionRecord[];
};

export type ProjectDetailResponse = {
  ok: boolean;
  generated_at: string;
  window_hours: number;
  bucket_minutes: number;
  project: {
    slug: string;
    name: string;
    category: string;
    requests: number;
    sessions: number;
    real_humans: number;
    suspected_bots: number;
    live_now: number;
    returning_visitors: number;
    engaged_sessions: number;
    avg_session_seconds: number;
    unique_visitors: number;
  };
  graph: {
    label: string;
    points: HumanSeriesPoint[];
  };
  live_feed: SessionRecord[];
  recent_sessions: SessionRecord[];
  hosts: Array<{
    host: string;
    project_slug: string;
    requests: number;
    unique_visitors: number;
    sessions: number;
    top_entry_page: string;
    top_exit_page: string;
    avg_session_seconds: number;
  }>;
  top_pages: TopPage[];
  geo: {
    countries: GeoRowCountry[];
    areas: GeoRowArea[];
    cities: GeoRowCity[];
  };
  suspicious: {
    top_paths: SuspiciousPath[];
    top_ips: SuspiciousIp[];
  };
};
