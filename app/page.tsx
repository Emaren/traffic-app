export const dynamic = "force-dynamic";

import Link from "next/link";
import BuilderTopDeck from "@/components/traffic/builder-top-deck";
import { fetchOverview } from "@/components/traffic/api";
import { withFlag } from "@/components/traffic/display";
import type { OverviewResponse, SessionRecord } from "@/components/traffic/types";

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
      return "border-rose-500/30 bg-rose-500/10 text-rose-100";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    default:
      return "border-sky-500/30 bg-sky-500/10 text-sky-100";
  }
}

function verdictClass(state: SessionRecord["classification_state"]) {
  switch (state) {
    case "human_confirmed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "likely_human":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "candidate":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "bot":
      return "border-violet-500/30 bg-violet-500/10 text-violet-200";
    case "suspicious":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function dataConfidenceClass(label: string) {
  switch (label) {
    case "High":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "Good":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "Limited":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  }
}

function attentionClass(label: string) {
  switch (label) {
    case "Investigate":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    case "High":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "Medium":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  }
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{helper}</p>
    </div>
  );
}

function SessionCard({ session }: { session: SessionRecord }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/75">
              {session.project_name}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${verdictClass(
                session.classification_state,
              )}`}
            >
              {session.verdict_label}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${dataConfidenceClass(
                session.data_confidence_label,
              )}`}
            >
              Data confidence: {session.data_confidence_label}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${attentionClass(
                session.attention_label,
              )}`}
            >
              Attention: {session.attention_label}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-semibold text-white">
            <Link
              href={`/visitors/${session.visitor_profile_id}`}
              className="transition hover:text-sky-200"
            >
              {withFlag(session.country_code, session.visitor_alias)}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {session.city || "Unknown city"}
            {session.area ? `, ${session.area}` : ""}
            {session.country ? `, ${session.country}` : ""} • {session.device} • {session.os} •{" "}
            {session.browser}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {session.classification_summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-xs text-white/75">
              IP {session.ip}
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
              Times Returned: {session.times_returned_in_project}
            </span>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
              Total Project Visits: {session.total_project_visits}
            </span>
          </div>
        </div>

        <div className="grid min-w-[220px] gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Human likelihood
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {session.human_confidence}%
            </div>
            <div className="mt-1 text-xs text-slate-400">{session.verdict_label}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Traffic Visits
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {session.visits_in_window}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              All projects in the current window
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Journey</div>
          <div className="mt-2 font-mono text-xs text-white/85 break-all">
            {session.entry_page} → {session.current_page}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {session.page_count} pages • {session.event_count} events • {formatSeconds(session.total_seconds)} total
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Why Traffic thinks this</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {session.classification_reason_labels.slice(0, 4).map((reason) => (
              <span
                key={`${session.session_id}-${reason}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Identity</div>
          <div className="mt-2 text-sm text-white/85">
            {session.projects_visited_in_window} projects across Traffic
          </div>
          <div className="mt-2 font-mono text-xs text-slate-400 break-all">
            IP {session.ip}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {session.returning_visitor ? "Seen earlier in this window" : "First sighting in this window"}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {session.first_seen_alberta} to {session.last_seen_alberta}
          </div>
          <div className="mt-2 text-xs text-slate-400">Source: {session.source || "direct"}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/projects/${session.project_slug}`}
          className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:bg-sky-400/15"
        >
          Open {session.project_name}
        </Link>
        <Link
          href={`/visitors/${session.visitor_profile_id}`}
          className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/15"
        >
          Open visitor profile
        </Link>
      </div>
    </div>
  );
}

export default async function Home() {
  const overview: OverviewResponse | null = await fetchOverview().catch(() => null);

  if (!overview) {
    return (
      <main className="min-h-screen bg-[#06070a] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-rose-200">Traffic observatory</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">API not reachable</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            The web shell loaded, but Traffic could not fetch overview data. The first thing to
            check is whether the FastAPI service is running and reachable from the web app.
          </p>
        </div>
      </main>
    );
  }

  const countryMax = maxCount(overview.geo.countries.map((row) => row.sessions));
  const projectMax = maxCount(overview.projects.map((row) => row.requests));

  return (
    <main className="min-h-screen bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="rounded-[32px] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">traffic.tokentap.ca</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                Traffic observatory
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Clearer visitor intelligence for noobs first and operators second: how many people
                came, how many were probably real, what they touched, and what deserves attention.
              </p>
            </div>

            <div className="grid gap-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Window:</span>{" "}
                <span className="text-white">{overview.window}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Generated:</span>{" "}
                <span className="text-white">{formatTimestamp(overview.generated_at)}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Quick read:</span>{" "}
                <span className="text-white">Verdict tells you who, confidence tells you how solid, attention tells you what to watch.</span>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Total Visitors"
            value={formatNumber(overview.totals.total_visitors)}
            helper="Distinct visitor fingerprints seen in this time range."
          />
          <StatCard
            label="Real Humans"
            value={formatNumber(overview.totals.real_humans)}
            helper="Visitors Traffic believes are probably real people."
          />
          <StatCard
            label="Suspected Bots"
            value={formatNumber(overview.totals.suspected_bots)}
            helper="Known bots plus clearly automated or suspicious actors."
          />
          <StatCard
            label="Live Right Now"
            value={formatNumber(overview.totals.live_now)}
            helper="Human-ish visitors still active in the last few minutes."
          />
          <StatCard
            label="Returning Visitors"
            value={formatNumber(overview.totals.returning_visitors)}
            helper="Visitors Traffic has already seen more than once in this window."
          />
          <StatCard
            label="Projects Active"
            value={formatNumber(overview.totals.projects_active)}
            helper="Projects with live human-ish traffic right now."
          />
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">How To Read Traffic</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Clearer language first</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                The old machine-style labels are being replaced with plain-English ones. Verdict
                says what Traffic thinks the visitor is, data confidence says how much solid detail
                we captured, and attention says whether the session is worth watching right now.
              </p>
            </div>

            <Link
              href="/visits"
              className="rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-400/15"
            >
              Open live archive
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Verdict</div>
              <div className="mt-2 text-lg font-semibold text-white">Who Traffic thinks this is</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Likely Human, Probably Human, Unclear, Known Bot, or Suspicious.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Data Confidence</div>
              <div className="mt-2 text-lg font-semibold text-white">How solid the session trail is</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                High means browser, route, and timing data are strong. Low means the trail is thin.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Attention</div>
              <div className="mt-2 text-lg font-semibold text-white">What deserves operator focus</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                High attention usually means strong dwell, repeat behavior, active sessions, or something weird.
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <BuilderTopDeck />
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Project Pulse</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Traffic by project</h2>
              </div>
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-300">
                Request share
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {overview.projects.map((project) => {
                const width = Math.max(8, Math.round((project.requests / projectMax) * 100));

                return (
                  <div
                    key={project.slug}
                    className="rounded-2xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{project.name}</p>
                        <p className="text-sm text-slate-400">
                          {formatNumber(project.sessions)} sessions •{" "}
                          {formatNumber(project.engaged_sessions)} engaged
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-amber-300">
                          {formatNumber(project.requests)}
                        </p>
                        <p className="text-sm text-slate-400">
                          {formatNumber(project.human_confirmed_sessions ?? 0)} likely humans
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200"
                        style={{ width: `${width}%` }}
                      />
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/projects/${project.slug}`}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/75 transition hover:bg-white/10"
                      >
                        Open project page
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Watch First</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Operator alerts</h2>

            <div className="mt-5 space-y-3">
              {overview.alerts.map((alert) => (
                <div
                  key={`${alert.severity}-${alert.title}`}
                  className={`rounded-2xl border p-4 ${severityClass(alert.severity)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em]">{alert.severity}</p>
                      <p className="mt-2 text-sm leading-6 text-white">{alert.title}</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm font-semibold text-white">
                      {formatNumber(alert.count)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">What the dashboard is doing</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {(overview.notes || []).map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Session Explorer</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Recent sessions explained</h2>
              </div>

              <Link
                href="/visits"
                className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/75 transition hover:bg-black/30"
              >
                Open full session archive
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              {overview.recent_sessions.slice(0, 6).map((session) => (
                <SessionCard key={session.session_id} session={session} />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Geo Intelligence</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Country and area mix</h2>

              <div className="mt-5 space-y-4">
                {overview.geo.countries.map((row) => {
                  const width = Math.max(10, Math.round((row.sessions / countryMax) * 100));

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

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Threat Surface</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Suspicious paths</h2>

              <div className="mt-5 space-y-3">
                {overview.suspicious.top_paths.map((row) => (
                  <div
                    key={row.path}
                    className="flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3"
                  >
                    <span className="font-mono text-sm text-rose-100">{row.path}</span>
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
                        {row.country} • {row.category} • last seen {formatTimestamp(row.last_seen || "")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Host Matrix</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Top hosts</h2>

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
                    <tr key={host.host} className="border-b border-white/6 text-slate-200">
                      <td className="px-3 py-3 font-medium text-white">{host.host}</td>
                      <td className="px-3 py-3">{host.project_slug}</td>
                      <td className="px-3 py-3">{formatNumber(host.requests)}</td>
                      <td className="px-3 py-3">{formatNumber(host.unique_visitors)}</td>
                      <td className="px-3 py-3">{formatNumber(host.sessions)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-emerald-300">
                        {host.top_entry_page}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-amber-300">
                        {host.top_exit_page}
                      </td>
                      <td className="px-3 py-3">{formatSeconds(host.avg_session_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Route Intelligence</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Top routes and next steps</h2>

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
                    <tr key={page.path} className="border-b border-white/6 text-slate-200">
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
          </div>
        </section>
      </div>
    </main>
  );
}
