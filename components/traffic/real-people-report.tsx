"use client";

import { useEffect, useMemo, useState } from "react";

type ReportSession = {
  session_id?: string | null;
  ip?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  ended_at?: string | null;
  known_visitor_kind?: string | null;
  known_visitor_label?: string | null;
  known_visitor_detail?: string | null;
  known_visitor_confirmed?: boolean | null;
  classification_state?: string | null;
  route_kind?: string | null;
  known_automation?: boolean | null;
  suspicious_score?: number | null;
};

type LiveVisitorsReportResponse = {
  stream_items?: ReportSession[];
  browser_script_items?: ReportSession[];
  automation_items?: ReportSession[];
  security_items?: ReportSession[];
  chain_signal_items?: ReportSession[];
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

function uniqueSessions(sessions: ReportSession[]) {
  const seen = new Set<string>();
  const result: ReportSession[] = [];

  for (const session of sessions) {
    const key =
      session.session_id ||
      `${session.ip ?? "unknown"}:${session.first_seen_at ?? ""}:${session.last_seen_at ?? session.ended_at ?? ""}`;

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(session);
  }

  return result;
}

function isOwnerSession(session: ReportSession) {
  const kind = String(session.known_visitor_kind ?? "").toLowerCase();
  const label = String(session.known_visitor_label ?? "").toLowerCase();
  const detail = String(session.known_visitor_detail ?? "").toLowerCase();

  return kind === "owner" || label === "tony" || detail === "owner";
}

function isKnownPersonSession(session: ReportSession) {
  const kind = String(session.known_visitor_kind ?? "").toLowerCase();

  return (
    !isOwnerSession(session) &&
    Boolean(session.known_visitor_confirmed) &&
    ["family", "known_player", "known_human"].includes(kind)
  );
}

function isAudienceGradeSession(session: ReportSession) {
  return (
    (session.classification_state === "human_confirmed" ||
      session.classification_state === "likely_human") &&
    session.route_kind === "page" &&
    !session.known_automation &&
    (session.suspicious_score ?? 0) < 35
  );
}

function isOutsideAudienceSession(session: ReportSession) {
  return (
    isAudienceGradeSession(session) &&
    !isOwnerSession(session) &&
    !isKnownPersonSession(session)
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
            `/api/live-visitors?project=${project}&window_hours=24&limit=50&history_limit=100`,
            controller.signal,
          ),
          fetchJson<VisitsHistoryResponse>(
            `/api/visits/history?projects=${project}&range_key=24h&classification=human_visible&limit=100`,
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
    const streamItems = liveData?.stream_items ?? [];
    const historyItems = historyData?.items ?? [];
    const humanSurface = uniqueSessions([...streamItems, ...historyItems]);

    const audienceGrade = humanSurface.filter(isAudienceGradeSession);
    const ownerSessions = audienceGrade.filter(isOwnerSession);
    const knownPersonSessions = audienceGrade.filter(isKnownPersonSession);
    const outsideHumanSessions = audienceGrade.filter(isOutsideAudienceSession);
    const unclearCandidateSessions = humanSurface.filter(
      (session) =>
        session.classification_state === "candidate" &&
        !session.known_automation &&
        (session.suspicious_score ?? 0) < 35,
    );

    const crawlerReviewTotal =
      (liveData?.browser_script_count ?? liveData?.browser_script_items?.length ?? 0) +
      (liveData?.automation_count ?? liveData?.automation_items?.length ?? 0) +
      (liveData?.security_count ?? liveData?.security_items?.length ?? 0);

    const chainSignalTotal =
      liveData?.chain_signal_count ?? liveData?.chain_signal_items?.length ?? 0;

    const outsideConfirmed = outsideHumanSessions.filter(
      (session) => session.classification_state === "human_confirmed",
    ).length;

    const outsideLikely = outsideHumanSessions.filter(
      (session) => session.classification_state === "likely_human",
    ).length;

    const summary =
      outsideHumanSessions.length > 0
        ? `${outsideHumanSessions.length} outside audience-grade session${
            outsideHumanSessions.length === 1 ? "" : "s"
          } in this focus window. ${outsideConfirmed} confirmed, ${outsideLikely} likely.`
        : knownPersonSessions.length > 0
          ? "No outside audience-grade human signals in the last 24h. Known people are present; crawler and page-walker traffic stays separated."
          : ownerSessions.length > 0
            ? "No outside audience-grade human signals in the last 24h. Owner/self activity is present; crawler and page-walker traffic stays separated."
            : "No outside human signals in the last 24h yet. Traffic is seeing candidates, crawlers, page-walkers, or infrastructure signals instead.";

    const cards: ReportCard[] = [
      {
        label: "Outside signals",
        value: outsideHumanSessions.length,
        detail: "confirmed + likely · 24h",
        className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
      },
      {
        label: "Known people",
        value: knownPersonSessions.length,
        detail: "players / trusted identities",
        className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
      },
      {
        label: "Owner / self",
        value: ownerSessions.length,
        detail: "Tony/operator traffic",
        className: "border-amber-400/25 bg-amber-400/10 text-amber-100",
      },
      {
        label: "Unclear candidates",
        value: unclearCandidateSessions.length,
        detail: "not counted as people",
        className: "border-white/10 bg-white/5 text-white/70",
      },
      {
        label: "Crawler review",
        value: crawlerReviewTotal,
        detail: "scripts / bots / page-walkers",
        className: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100",
      },
      {
        label: "Chain/API signals",
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
            Real People Report
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            What Traffic can actually defend
          </h3>
        </div>
        <p className="max-w-2xl text-xs leading-5 text-white/55">
          This separates owner traffic, known people, outside audience-grade humans,
          unclear candidates, crawler/page-walker review, and infrastructure noise.
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
