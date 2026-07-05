"use client";

import { useEffect, useMemo, useState } from "react";

type ReportSession = {
  session_id?: string | null;
  visitor_alias?: string | null;
  ip?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  ended_at?: string | null;

  known_visitor_kind?: string | null;
  known_visitor_label?: string | null;
  known_visitor_detail?: string | null;
  known_visitor_confirmed?: boolean | null;

  classification_state?: string | null;
  verdict_label?: string | null;
  route_kind?: string | null;
  known_automation?: boolean | null;
  suspicious_score?: number | null;

  page_count?: number | null;
  event_count?: number | null;
  signal_count?: number | null;
  total_seconds?: number | null;
  engaged_seconds?: number | null;
  browser_signal_count?: number | null;
  browser_max_scroll_pct?: number | null;
  browser_clicks?: number | null;

  entry_page?: string | null;
  current_page?: string | null;
  exit_page?: string | null;
  latest_page?: string | null;
  path?: string | null;
  page_sequence?: string[] | null;
  route_trail?: string[] | null;
};

type LiveVisitorsReportResponse = {
  stream_items?: ReportSession[];

  recent_page_review_items?: ReportSession[];
  app_activity_items?: ReportSession[];
  watcher_funnel_items?: ReportSession[];
  browser_script_items?: ReportSession[];
  automation_items?: ReportSession[];
  security_items?: ReportSession[];
  chain_signal_items?: ReportSession[];

  recent_page_review_count?: number;
  app_activity_count?: number;
  watcher_funnel_count?: number;
  browser_script_count?: number;
  automation_count?: number;
  security_count?: number;
  chain_signal_count?: number;
};

type VisitsHistoryResponse = {
  items?: ReportSession[];
};

type ReportCard = {
  label: string;
  value: number;
  detail: string;
  className: string;
};

type Props = {
  focusedProjectSlug?: string | null;
  pollMs?: number;
};

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().trim();
}

function uniqueSessions(sessions: ReportSession[]) {
  const seen = new Set<string>();
  const result: ReportSession[] = [];

  for (const session of sessions) {
    const route = session.current_page || session.latest_page || session.path || session.entry_page || "";
    const key =
      session.session_id ||
      `${session.ip ?? "unknown"}:${session.first_seen_at ?? ""}:${session.last_seen_at ?? session.ended_at ?? ""}:${route}`;

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(session);
  }

  return result;
}

function sessionRoutes(session: ReportSession) {
  const routes = [
    session.entry_page,
    session.current_page,
    session.exit_page,
    session.latest_page,
    session.path,
    ...(session.page_sequence ?? []),
    ...(session.route_trail ?? []),
  ]
    .filter(Boolean)
    .map((route) => String(route));

  return Array.from(new Set(routes));
}

function hasMeaningfulPageRoute(session: ReportSession) {
  const routes = sessionRoutes(session);
  if (routes.length === 0) return session.route_kind === "page";

  return routes.some((route) => {
    const lower = route.toLowerCase();

    if (!lower.startsWith("/")) return false;
    if (lower.startsWith("/api/")) return false;
    if (lower.startsWith("/_next/")) return false;
    if (lower.includes("favicon")) return false;
    if (lower.includes(".map")) return false;
    if (lower.includes(".css")) return false;
    if (lower.includes(".js")) return false;

    return true;
  });
}

function isOwnerSession(session: ReportSession) {
  const kind = normalize(session.known_visitor_kind);
  const label = normalize(session.known_visitor_label);
  const detail = normalize(session.known_visitor_detail);

  return kind === "owner" || label === "tony" || detail === "owner";
}

function isKnownPersonSession(session: ReportSession) {
  const kind = normalize(session.known_visitor_kind);

  return (
    !isOwnerSession(session) &&
    Boolean(session.known_visitor_confirmed) &&
    ["family", "known_player", "known_human"].includes(kind)
  );
}

function isBadAutomation(session: ReportSession) {
  const state = normalize(session.classification_state);
  const verdict = normalize(session.verdict_label);
  const suspicious = session.suspicious_score ?? 0;

  if (session.known_automation) return true;
  if (["bot", "known_bot", "automation", "security", "crawler", "browser_script"].includes(state)) {
    return true;
  }
  if (verdict.includes("known bot")) return true;
  if (verdict.includes("security")) return true;
  if (suspicious >= 75) return true;

  return false;
}

function isAudienceGradeSession(session: ReportSession) {
  return (
    (session.classification_state === "human_confirmed" ||
      session.classification_state === "likely_human") &&
    session.route_kind === "page" &&
    !isBadAutomation(session) &&
    hasMeaningfulPageRoute(session)
  );
}

function isOutsideAudienceSession(session: ReportSession) {
  return (
    isAudienceGradeSession(session) &&
    !isOwnerSession(session) &&
    !isKnownPersonSession(session)
  );
}

function isQuickOutsideSignal(session: ReportSession) {
  if (isOutsideAudienceSession(session)) return false;
  if (isOwnerSession(session) || isKnownPersonSession(session)) return false;
  if (isBadAutomation(session)) return false;
  if (!hasMeaningfulPageRoute(session)) return false;

  const state = normalize(session.classification_state);
  const routeKind = normalize(session.route_kind);
  const pageCount = session.page_count ?? 0;
  const eventCount = session.event_count ?? session.signal_count ?? 0;
  const browserSignals = session.browser_signal_count ?? 0;
  const scroll = session.browser_max_scroll_pct ?? 0;
  const engaged = session.engaged_seconds ?? 0;
  const total = session.total_seconds ?? 0;

  const pageLike = routeKind === "page" || routeKind === "";
  const humanPossibleState = ["candidate", "unclear", "likely_human", "human_visible", ""].includes(state);

  return (
    pageLike &&
    humanPossibleState &&
    (
      pageCount >= 1 ||
      eventCount >= 1 ||
      browserSignals >= 1 ||
      scroll > 0 ||
      engaged > 0 ||
      total > 0
    )
  );
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  const response = await fetch(url, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) return null;
  return (await response.json()) as T;
}

export default function RealPeopleReport({
  focusedProjectSlug = "aoe2hdbets",
  pollMs = 120000,
}: Props) {
  const projectSlug = focusedProjectSlug || "aoe2hdbets";
  const [liveData, setLiveData] = useState<LiveVisitorsReportResponse | null>(null);
  const [historyData, setHistoryData] = useState<VisitsHistoryResponse | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadReport() {
      try {
        const project = encodeURIComponent(projectSlug);

        const [nextLiveData, nextHistoryData] = await Promise.all([
          fetchJson<LiveVisitorsReportResponse>(
            `/api/live-visitors?project=${project}&window_hours=24&limit=100&history_limit=250`,
            controller.signal,
          ),
          fetchJson<VisitsHistoryResponse>(
            `/api/visits/history?projects=${project}&range_key=24h&limit=350`,
            controller.signal,
          ),
        ]);

        if (!mounted) return;

        setLiveData(nextLiveData);
        setHistoryData(nextHistoryData);
        setLoadError("");
      } catch (error) {
        if (!mounted || controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Traffic report is refreshing.");
      }
    }

    void loadReport();

    const timer = window.setInterval(() => {
      void loadReport();
    }, pollMs);

    return () => {
      mounted = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [pollMs, projectSlug]);

  const report = useMemo(() => {
    const allLiveItems = [
      ...(liveData?.stream_items ?? []),
      ...(liveData?.recent_page_review_items ?? []),
      ...(liveData?.app_activity_items ?? []),
      ...(liveData?.watcher_funnel_items ?? []),
    ];

    const allSurface = uniqueSessions([
      ...allLiveItems,
      ...(historyData?.items ?? []),
    ]);

    const outsideAudienceSessions = allSurface.filter(isOutsideAudienceSession);
    const confirmedOutsideSessions = outsideAudienceSessions.filter(
      (session) => session.classification_state === "human_confirmed",
    );
    const likelyOutsideSessions = outsideAudienceSessions.filter(
      (session) => session.classification_state === "likely_human",
    );
    const quickOutsideSignals = allSurface.filter(isQuickOutsideSignal);

    const ownerSessions = allSurface.filter(isOwnerSession);
    const knownPersonSessions = allSurface.filter(isKnownPersonSession);

    const crawlerReviewTotal =
      (liveData?.browser_script_count ?? liveData?.browser_script_items?.length ?? 0) +
      (liveData?.automation_count ?? liveData?.automation_items?.length ?? 0) +
      (liveData?.security_count ?? liveData?.security_items?.length ?? 0);

    const chainSignalTotal =
      liveData?.chain_signal_count ?? liveData?.chain_signal_items?.length ?? 0;

    const outsideSignalTotal =
      confirmedOutsideSessions.length +
      likelyOutsideSessions.length +
      quickOutsideSignals.length;

    const summary =
      outsideSignalTotal > 0
        ? `${outsideSignalTotal} outside signal${outsideSignalTotal === 1 ? "" : "s"} in the last 24h: ${confirmedOutsideSessions.length} confirmed, ${likelyOutsideSessions.length} likely, ${quickOutsideSignals.length} quick check${quickOutsideSignals.length === 1 ? "" : "s"}. Quick checks still count as market signal.`
        : ownerSessions.length + knownPersonSessions.length > 0
          ? "No outside signals in the last 24h. Owner or known-person activity is present; crawler and infrastructure noise stay separated."
          : "No outside signals in the last 24h yet. Traffic is seeing candidates, crawlers, page-walkers, or infrastructure signals instead.";

    const cards: ReportCard[] = [
      {
        label: "Confirmed",
        value: confirmedOutsideSessions.length,
        detail: "outside humans · 24h",
        className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
      },
      {
        label: "Likely humans",
        value: likelyOutsideSessions.length,
        detail: "strong outside signals",
        className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
      },
      {
        label: "Quick checks",
        value: quickOutsideSignals.length,
        detail: "thin / lobby-style signals",
        className: "border-amber-400/30 bg-amber-400/10 text-amber-100",
      },
      {
        label: "Owner / known",
        value: ownerSessions.length + knownPersonSessions.length,
        detail: "operator / trusted people",
        className: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
      },
      {
        label: "Crawler review",
        value: crawlerReviewTotal,
        detail: "scripts / bots / page-walkers",
        className: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100",
      },
      {
        label: "Chain/API",
        value: chainSignalTotal,
        detail: "infrastructure, not audience",
        className: "border-sky-400/25 bg-sky-400/10 text-sky-100",
      },
    ];

    return { cards, summary };
  }, [historyData?.items, liveData]);

  return (
    <div className="mb-3 rounded-3xl border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),rgba(2,6,23,0.72)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] md:p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/75">
            Real People & Outside Signals
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            What Traffic can actually defend
          </h3>
        </div>
        <p className="max-w-2xl text-xs leading-5 text-white/55">
          Confirmed people stay green. Likely humans stay blue. Quick checks stay gold
          because one-click visitors still matter when the lobby lights the beacon.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {report.cards.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border px-3 py-3 ${stat.className}`}
          >
            <div className="text-2xl font-semibold leading-none">
              {stat.value.toLocaleString()}
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] opacity-85">
              {stat.label}
            </div>
            <div className="mt-1 text-xs opacity-60">{stat.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white/72">
        {loadError ? "Traffic report is refreshing. Last known report may be incomplete." : report.summary}
      </div>
    </div>
  );
}
