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

export type SessionActivityItem = {
  id: string;
  path: string;
  route_kind: string;
  category: string;
  timestamp: string;
  timestamp_alberta: string;
};

export type LiveTransportMode = "connecting" | "streaming" | "polling";

export type SessionRecord = {
  session_id: string;
  visitor_key: string;
  person_key: string;
  visitor_profile_id: string;
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
  geo_resolved?: boolean;
  device: string;
  os: string;
  browser: string;
  known_automation: boolean;
  automation_family: string;
  route_bundle_spam?: boolean;
  is_burst_cluster?: boolean;
  burst_member_count?: number;
  burst_ip_count?: number;
  burst_path_count?: number;
  burst_window_seconds?: number;
  burst_ip_families?: string[];
  burst_sample_ips?: string[];
  burst_paths?: string[];
  network_ua_count?: number;
  network_path_count?: number;
  referrer: string;
  source: string;
  medium: string;
  campaign: string;
  entry_page: string;
  current_page: string;
  exit_page: string;
  next_page: string;
  page_sequence: string[];
  activity_sequence?: SessionActivityItem[];
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
    | "browser_script"
    | "script_burst"
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
  range_key: HistoryRangeKey;
  range_label: string;
  window_hours: number | null;
  window: string;
  coverage_mode: string;
  coverage_started_at?: string | null;
  coverage_started_alberta?: string | null;
  note?: string | null;
  totals: OverviewTotals;
  projects: ProjectSummary[];
  hosts?: HostSummary[];
  suspicious?: {
    top_paths: SuspiciousPath[];
    top_ips: SuspiciousIp[];
  };
  recent_sessions?: SessionRecord[];
  top_pages?: TopPage[];
  geo?: {
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
  browser_script?: number;
  active_now: number;
};

export type ProjectFilterOption = {
  slug: string;
  name: string;
};

export type LiveVisitorsResponse = {
  ok: boolean;
  generated_at: string;
  window_hours: number;
  tower_limit: number;
  history_count: number;
  stream_total: number;
  stream_items: SessionRecord[];
  browser_script_count?: number;
  browser_script_preview?: SessionRecord[];
  automation_count: number;
  automation_preview: SessionRecord[];
  security_count: number;
  security_preview: SessionRecord[];
  available_projects: ProjectFilterOption[];
  project_counts: LiveProjectCount[];
  top_25: SessionRecord[];
  history_preview: SessionRecord[];
};

export type HumanSeriesPoint = {
  bucket_start: string;
  label: string;
  visitors: number;
};

export type ProjectGraphRangeKey = "24h" | "7d" | "30d" | "all";
export type HistoryRangeKey = ProjectGraphRangeKey;

export type ProjectGraphData = {
  label: string;
  series_kind?: string;
  range_key: ProjectGraphRangeKey;
  range_label: string;
  window_hours?: number | null;
  bucket_minutes: number;
  coverage_mode: string;
  coverage_started_at?: string | null;
  coverage_started_alberta?: string | null;
  note?: string | null;
  points: HumanSeriesPoint[];
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
  range_key: ProjectGraphRangeKey;
  range_label: string;
  window_hours: number | null;
  bucket_minutes: number;
  coverage_mode: string;
  coverage_started_at?: string | null;
  coverage_started_alberta?: string | null;
  note?: string | null;
  series_kind: string;
  projects: HumanSeriesProject[];
};

export type ProjectGraphResponse = {
  ok: boolean;
  generated_at: string;
  project: {
    slug: string;
    name: string;
  };
  graph: ProjectGraphData;
};

export type VisitsHistoryResponse = {
  ok: boolean;
  generated_at: string;
  window_hours: number | null;
  range_key: HistoryRangeKey;
  range_label: string;
  coverage_mode: string;
  coverage_started_at?: string | null;
  coverage_started_alberta?: string | null;
  note?: string | null;
  offset: number;
  limit: number;
  total: number;
  available_projects: ProjectFilterOption[];
  items: SessionRecord[];
};

export type NotificationProviderKey = "pushover" | "ntfy" | "web_push";

export type NotificationSettings = {
  enabled: boolean;
  provider: NotificationProviderKey;
  armed_at?: string | null;
  site_base_url: string;
  providers: {
    pushover: {
      app_token: string;
      user_key: string;
      device: string;
      priority: number;
      sound: string;
    };
    ntfy: {
      base_url: string;
      topic: string;
      token: string;
      priority: number;
      tags: string;
    };
    web_push: {
      ttl_seconds: number;
    };
  };
  policy: {
    page_hits_only: boolean;
    suppress_operator_traffic: boolean;
    filter_exploit_probes: boolean;
    filter_known_automation: boolean;
    include_human_confirmed: boolean;
    include_likely_human: boolean;
    include_unclear: boolean;
    include_suspicious: boolean;
    include_bots: boolean;
    include_returning: boolean;
    new_visitors_only: boolean;
    selected_projects: string[];
    max_notifications_per_visitor_per_hour: number;
    max_notifications_per_session: number;
    max_notifications_per_path_per_visitor_per_hour: number;
  };
};

export type NotificationMuteRule = {
  id: number;
  rule_type:
    | "person_key"
    | "visitor_profile_id"
    | "ip"
    | "path"
    | "project_slug"
    | "host";
  match_value: string;
  label: string;
  reason: string;
  active: boolean;
  created_at: string;
};

export type NotificationOperatorIdentity = {
  id: number;
  rule_type: "person_key" | "visitor_profile_id" | "ip";
  match_value: string;
  label: string;
  notes: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type VisibilityRule = {
  id: number;
  rule_type: "ip" | "path" | "project_slug" | "host";
  match_value: string;
  label: string;
  reason: string;
  active: boolean;
  created_at: string;
};

export type NotificationEventRecord = {
  id: number;
  traffic_event_id: string;
  session_id: string;
  event_timestamp: string;
  event_timestamp_alberta: string;
  project_slug: string;
  project_name: string;
  host: string;
  path: string;
  route_kind: string;
  person_key: string;
  visitor_profile_id: string;
  visitor_alias: string;
  ip: string;
  country_code: string;
  country: string;
  classification_state: string;
  verdict_label: string;
  returning_visitor: boolean;
  total_project_visits: number;
  projects_visited_in_window: number;
  status: "delivered" | "suppressed" | "error";
  suppression_reason: string;
  provider: string;
  provider_message_id: string;
  delivery_error: string;
  notification_title: string;
  notification_body: string;
  destination_url: string;
  operator_identity?: NotificationOperatorIdentity | null;
  details: Record<string, unknown>;
  created_at: string;
  delivered_at?: string | null;
};

export type NotificationDashboardResponse = {
  ok: boolean;
  generated_at: string;
  projects: Array<{ slug: string; name: string }>;
  settings: NotificationSettings;
  provider_ready: boolean;
  web_push: {
    configured: boolean;
    public_key: string;
    subject: string;
    ready: boolean;
    active_count: number;
    subscriptions: Array<{
      id: number;
      endpoint: string;
      endpoint_tail: string;
      device_label: string;
      user_agent: string;
      active: boolean;
      last_error: string;
      created_at: string;
      updated_at: string;
      last_success_at?: string | null;
    }>;
  };
  operators: NotificationOperatorIdentity[];
  mutes: NotificationMuteRule[];
  visibility_rules: VisibilityRule[];
  recent_events: NotificationEventRecord[];
  stats: {
    delivered: number;
    suppressed: number;
    errors: number;
    total: number;
    last_delivered_at?: string | null;
  };
  loop: {
    mode?: string;
    checked?: number;
    delivered?: number;
    suppressed?: number;
    errors?: number;
    last_run_at?: string | null;
    message?: string;
  };
};

export type ProjectDetailResponse = {
  ok: boolean;
  generated_at: string;
  window_hours: number;
  bucket_minutes: number;
  deep_detail_included: boolean;
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
  graph: ProjectGraphData;
  live_feed: SessionRecord[];
  recent_sessions: SessionRecord[];
  top_humans: SessionRecord[];
  top_suspicious_sessions: SessionRecord[];
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

export type ProjectLiveFeedResponse = {
  ok: boolean;
  generated_at: string;
  window_hours: number;
  visible_count: number;
  project: {
    slug: string;
    name: string;
  };
  live_feed: SessionRecord[];
};

export type VisitorProfileResponse = {
  ok: boolean;
  generated_at: string;
  window_hours: number | null;
  range_key: HistoryRangeKey;
  range_label: string;
  coverage_mode: string;
  coverage_started_at?: string | null;
  coverage_started_alberta?: string | null;
  note?: string | null;
  session_limit: number;
  visitor: {
    id: string;
    alias: string;
    person_key: string;
    ip: string;
    country: string;
    country_code: string;
    area: string;
    city: string;
    device: string;
    os: string;
    browser: string;
    first_seen_at: string;
    last_seen_at: string;
    first_seen_alberta: string;
    last_seen_alberta: string;
    projects_visited: number;
    total_sessions: number;
    active_now: boolean;
    linked_profiles_count: number;
  };
  projects: Array<{
    slug: string;
    name: string;
    visits: number;
    first_seen_at: string;
    first_seen_alberta: string;
    last_seen_at: string;
    last_seen_alberta: string;
  }>;
  linked_profiles: Array<{
    id: string;
    alias: string;
    ip: string;
    browser: string;
    device: string;
    os: string;
    country: string;
    country_code: string;
    area: string;
    city: string;
    first_seen_at: string;
    last_seen_at: string;
    first_seen_alberta: string;
    last_seen_alberta: string;
    total_sessions: number;
    projects_visited: number;
    project_names: string[];
    reason: string;
  }>;
  sessions: SessionRecord[];
};
