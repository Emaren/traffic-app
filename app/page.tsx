export const dynamic = "force-dynamic";

import BuilderTopDeck from "@/components/traffic/builder-top-deck";

type Totals = {
  requests: number;
  humans: number;
  bots: number;
  suspicious: number;
  unknown: number;
  unique_visitors: number;
  sessions: number;
  engaged_sessions: number;
  avg_session_seconds: number;
  avg_page_seconds: number;
};

type ProjectRow = {
  slug: string;
  name: string;
  category: string;
  requests: number;
  sessions: number;
  engaged_sessions: number;
  suspicious: number;
};

type HostRow = {
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

type ThreatPath = {
  path: string;
  count: number;
};

type ThreatIp = {
  ip: string;
  country: string;
  count: number;
  category: string;
  last_seen: string | null;
};

type SessionRow = {
  session_id: string;
  project_slug: string;
  host: string;
  started_at: string;
  ended_at: string;
  country: string;
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
  next_page: string;
  exit_page: string;
  page_count: number;
  event_count: number;
  total_seconds: number;
  engaged_seconds: number;
  suspicious_score: number;
  primary_category: string;
  route_kind: string;
  quality_score: number;
  quality_label: string;
};

type PageRow = {
  path: string;
  route_kind: string;
  entries: number;
  views: number;
  exits: number;
  avg_seconds: number;
  top_next_paths: Array<{
    path: string;
    count: number;
  }>;
};

type GeoCountry = {
  country: string;
  sessions: number;
  requests: number;
};

type GeoArea = {
  country: string;
  area: string;
  sessions: number;
};

type GeoCity = {
  country: string;
  area: string;
  city: string;
  sessions: number;
};

type AlertRow = {
  severity: string;
  title: string;
  count: number;
};

type Overview = {
  ok: boolean;
  generated_at: string;
  window: string;
  totals: Totals;
  projects: ProjectRow[];
  hosts: HostRow[];
  suspicious: {
    top_paths: ThreatPath[];
    top_ips: ThreatIp[];
  };
  recent_sessions: SessionRow[];
  top_pages: PageRow[];
  geo: {
    countries: GeoCountry[];
    areas: GeoArea[];
    cities: GeoCity[];
  };
  alerts: AlertRow[];
  notes?: string[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_TRAFFIC_API_BASE_URL || "http://127.0.0.1:3346";

async function getOverview(): Promise<Overview | null> {
  try {
    const response = await fetch(`${API_BASE}/api/overview`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as Overview;
  } catch {
    return null;
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSeconds(value: number) {
  if (value < 60) return `${value}s`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function maxCount(values: number[]) {
  return values.length ? Math.max(...values) : 1;
}

function severityClass(severity: string) {
  switch (severity) {
    case "high":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }
}

function sessionTone(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 55) return "text-sky-300";
  if (score >= 30) return "text-amber-300";
  return "text-slate-300";
}

function routeKindClass(routeKind: string) {
  switch (routeKind) {
    case "page":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "api":
      return "border-sky-500/20 bg-sky-500/10 text-sky-300";
    case "probe":
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    case "asset":
      return "border-slate-500/20 bg-slate-500/10 text-slate-300";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300";
  }
}

function categoryClass(category: string) {
  switch (category) {
    case "human":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "bot":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "suspicious":
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300";
  }
}

function qualityClass(label: string) {
  switch (label) {
    case "strong":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "good":
      return "border-sky-500/20 bg-sky-500/10 text-sky-300";
    case "thin":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    default:
      return "border-slate-500/20 bg-slate-500/10 text-slate-300";
  }
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

export default async function Home() {
  const overview = await getOverview();

  if (!overview) {
    return (
      <main className="min-h-screen bg-[#06070a] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-rose-200">
            Traffic command center
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            API not reachable
          </h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            The dashboard page loaded, but it could not pull data from the
            Traffic API. Check that the FastAPI server is still running and that
            this page is pointing at the correct API base.
          </p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            <p>Expected API base:</p>
            <p className="mt-2 font-mono text-amber-300">{API_BASE}</p>
          </div>
        </div>
      </main>
    );
  }

  const countryMax = maxCount(overview.geo.countries.map((row) => row.sessions));
  const projectMax = maxCount(overview.projects.map((row) => row.requests));

  return (
    <main className="min-h-screen bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="rounded-[28px] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">
                traffic.tokentap.ca
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                Ecosystem command center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Premium analytics shell for Traffic, built to become the central
                observatory for your projects, visitor journeys, campaign lift,
                and threat pressure.
              </p>
            </div>

            <div className="grid gap-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Window:</span>{" "}
                <span className="text-white">{overview.window}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Generated:</span>{" "}
                <span className="text-white">
                  {formatTimestamp(overview.generated_at)}
                </span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">API:</span>{" "}
                <span className="font-mono text-amber-300">{API_BASE}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6">
          <BuilderTopDeck />
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Requests"
            value={formatNumber(overview.totals.requests)}
            helper="All observed requests in the active window"
          />
          <StatCard
            label="Unique visitors"
            value={formatNumber(overview.totals.unique_visitors)}
            helper="Anonymous visitor-level view"
          />
          <StatCard
            label="Sessions"
            value={formatNumber(overview.totals.sessions)}
            helper={`${formatNumber(
              overview.totals.engaged_sessions,
            )} engaged sessions`}
          />
          <StatCard
            label="Avg session"
            value={formatSeconds(overview.totals.avg_session_seconds)}
            helper="Average total session duration"
          />
          <StatCard
            label="Suspicious"
            value={formatNumber(overview.totals.suspicious)}
            helper="Requests flagged as likely hostile"
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Project lift
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Ecosystem traffic by project
                </h2>
              </div>
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-300">
                Quality mode live
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {overview.projects.map((project) => {
                const width = Math.max(
                  8,
                  Math.round((project.requests / projectMax) * 100),
                );

                return (
                  <div
                    key={project.slug}
                    className="rounded-2xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">
                          {project.name}
                        </p>
                        <p className="text-sm text-slate-400">
                          {project.category} · {formatNumber(project.sessions)} sessions
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-amber-300">
                          {formatNumber(project.requests)}
                        </p>
                        <p className="text-sm text-slate-400">
                          {formatNumber(project.suspicious)} suspicious
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Operator alerts
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Watch this first
            </h2>

            <div className="mt-5 space-y-3">
              {overview.alerts.map((alert) => (
                <div
                  key={`${alert.severity}-${alert.title}`}
                  className={`rounded-2xl border p-4 ${severityClass(alert.severity)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em]">
                        {alert.severity}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white">
                        {alert.title}
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-semibold text-white">
                      {formatNumber(alert.count)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">What this means</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {(overview.notes || []).map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Host matrix
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Top hosts
            </h2>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-3 font-medium">Host</th>
                    <th className="px-3 py-3 font-medium">Project</th>
                    <th className="px-3 py-3 font-medium">Requests</th>
                    <th className="px-3 py-3 font-medium">Visitors</th>
                    <th className="px-3 py-3 font-medium">Sessions</th>
                    <th className="px-3 py-3 font-medium">Entry</th>
                    <th className="px-3 py-3 font-medium">Exit</th>
                    <th className="px-3 py-3 font-medium">Avg time</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.hosts.map((host) => (
                    <tr
                      key={host.host}
                      className="border-b border-white/6 text-slate-200"
                    >
                      <td className="px-3 py-3 font-medium text-white">
                        {host.host}
                      </td>
                      <td className="px-3 py-3">{host.project_slug}</td>
                      <td className="px-3 py-3">{formatNumber(host.requests)}</td>
                      <td className="px-3 py-3">
                        {formatNumber(host.unique_visitors)}
                      </td>
                      <td className="px-3 py-3">{formatNumber(host.sessions)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-emerald-300">
                        {host.top_entry_page}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-amber-300">
                        {host.top_exit_page}
                      </td>
                      <td className="px-3 py-3">
                        {formatSeconds(host.avg_session_seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Threat surface
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Suspicious paths
            </h2>

            <div className="mt-5 space-y-3">
              {overview.suspicious.top_paths.map((row) => (
                <div
                  key={row.path}
                  className="flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3"
                >
                  <span className="font-mono text-sm text-rose-100">
                    {row.path}
                  </span>
                  <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-semibold text-rose-200">
                    {formatNumber(row.count)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-white">Top bad IPs</p>
              <div className="mt-3 space-y-3">
                {overview.suspicious.top_ips.map((row) => (
                  <div
                    key={row.ip}
                    className="rounded-2xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm text-white">{row.ip}</span>
                      <span className="text-sm font-semibold text-amber-300">
                        {formatNumber(row.count)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {row.country} · {row.category} · last seen{" "}
                      {formatTimestamp(row.last_seen || "")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Session explorer
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Quality-prioritized recent sessions
            </h2>

            <div className="mt-5 space-y-4">
              {overview.recent_sessions.map((session) => (
                <div
                  key={session.session_id}
                  className="rounded-2xl border border-white/8 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                        {session.project_slug} · {session.host}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${routeKindClass(
                            session.route_kind,
                          )}`}
                        >
                          {session.route_kind}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${categoryClass(
                            session.primary_category,
                          )}`}
                        >
                          {session.primary_category}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${qualityClass(
                            session.quality_label,
                          )}`}
                        >
                          {session.quality_label}
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-white">
                        {session.country}, {session.area}, {session.city}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {session.device} · {session.os} · {session.browser}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className={`text-lg font-semibold ${sessionTone(session.quality_score)}`}>
                        quality {session.quality_score}
                      </p>
                      <p className="text-sm text-slate-400">
                        threat {session.suspicious_score} ·{" "}
                        {formatSeconds(session.total_seconds)} total
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Entry
                      </p>
                      <p className="mt-2 font-mono text-sm text-emerald-300">
                        {session.entry_page}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Next
                      </p>
                      <p className="mt-2 font-mono text-sm text-amber-300">
                        {session.next_page}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Exit
                      </p>
                      <p className="mt-2 font-mono text-sm text-rose-300">
                        {session.exit_page}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400">
                    <span>source: {session.source || "direct"}</span>
                    <span>medium: {session.medium || "unknown"}</span>
                    <span>campaign: {session.campaign || "—"}</span>
                    <span>paths: {session.page_count}</span>
                    <span>events: {session.event_count}</span>
                    <span>engaged: {formatSeconds(session.engaged_seconds)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Geo intelligence
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Country and area mix
            </h2>

            <div className="mt-5 space-y-4">
              {overview.geo.countries.map((row) => {
                const width = Math.max(
                  10,
                  Math.round((row.sessions / countryMax) * 100),
                );

                return (
                  <div key={row.country}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-white">{row.country}</span>
                      <span className="text-sm text-slate-400">
                        {formatNumber(row.sessions)} sessions
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-200"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-sm font-medium text-white">Top areas</p>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {overview.geo.areas.map((row) => (
                    <div
                      key={`${row.country}-${row.area}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span>
                        {row.area}, {row.country}
                      </span>
                      <span className="font-semibold text-amber-300">
                        {formatNumber(row.sessions)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-sm font-medium text-white">Top cities</p>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {overview.geo.cities.map((row) => (
                    <div
                      key={`${row.country}-${row.area}-${row.city}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span>{row.city}</span>
                      <span className="font-semibold text-sky-300">
                        {formatNumber(row.sessions)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Route intelligence
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Top routes and next steps
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 font-medium">Path</th>
                  <th className="px-3 py-3 font-medium">Kind</th>
                  <th className="px-3 py-3 font-medium">Entries</th>
                  <th className="px-3 py-3 font-medium">Views</th>
                  <th className="px-3 py-3 font-medium">Exits</th>
                  <th className="px-3 py-3 font-medium">Avg time</th>
                  <th className="px-3 py-3 font-medium">Top next path</th>
                </tr>
              </thead>
              <tbody>
                {overview.top_pages.map((page) => (
                  <tr
                    key={page.path}
                    className="border-b border-white/6 text-slate-200"
                  >
                    <td className="px-3 py-3 font-mono text-white">{page.path}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${routeKindClass(
                          page.route_kind,
                        )}`}
                      >
                        {page.route_kind}
                      </span>
                    </td>
                    <td className="px-3 py-3">{formatNumber(page.entries)}</td>
                    <td className="px-3 py-3">{formatNumber(page.views)}</td>
                    <td className="px-3 py-3">{formatNumber(page.exits)}</td>
                    <td className="px-3 py-3">{formatSeconds(page.avg_seconds)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-amber-300">
                      {page.top_next_paths[0]?.path || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
