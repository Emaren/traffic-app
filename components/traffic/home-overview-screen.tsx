"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import BuilderTopDeck from "@/components/traffic/builder-top-deck";
import OverviewTopline from "@/components/traffic/overview-topline";
import { fetchOverviewRange } from "@/components/traffic/api";
import { withFlag } from "@/components/traffic/display";
import type { HistoryRangeKey, OverviewResponse, SessionRecord } from "@/components/traffic/types";

const RANGE_OPTIONS: Array<{ key: HistoryRangeKey; label: string }> = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "1 Week" },
  { key: "30d", label: "1 Month" },
  { key: "all", label: "All Time" },
];

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

function SessionCard({ session }: { session: SessionRecord }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
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

        <div className="grid w-full min-w-0 gap-3 md:w-auto md:min-w-[220px] md:grid-cols-2">
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
              All projects in the selected range
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
            {session.returning_visitor ? "Seen earlier in this selected range" : "First sighting in this selected range"}
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

export default function HomeOverviewScreen({
  initialOverview,
  pollMs = 15000,
}: {
  initialOverview: OverviewResponse | null;
  pollMs?: number;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [pendingRange, setPendingRange] = useState<HistoryRangeKey | null>(null);
  const [error, setError] = useState("");
  const activeRangeKey = overview?.range_key ?? "24h";

  useEffect(() => {
    setOverview(initialOverview);
    setPendingRange(null);
    setError("");
  }, [initialOverview]);

  useEffect(() => {
    if (!overview) {
      let mounted = true;

      const loadInitial = async () => {
        try {
          const next = await fetchOverviewRange("24h");
          if (!mounted || !next.ok) return;

          startTransition(() => {
            setOverview(next);
            setError("");
          });
        } catch (err) {
          if (!mounted) return;
          setError(err instanceof Error ? err.message : "Failed to load Traffic overview");
        }
      };

      void loadInitial();

      return () => {
        mounted = false;
      };
    }
  }, [overview]);

  useEffect(() => {
    if (!overview) return;

    let mounted = true;

    const load = async () => {
      try {
        const next = await fetchOverviewRange(activeRangeKey);
        if (!mounted || !next.ok) return;

        startTransition(() => {
          setOverview(next);
          setError("");
        });
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to refresh observatory overview");
      }
    };

    const timer = window.setInterval(() => void load(), pollMs);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [activeRangeKey, overview, pollMs]);

  const loadRange = async (rangeKey: HistoryRangeKey) => {
    if (!overview) return;
    if (rangeKey === overview.range_key || pendingRange) return;

    setPendingRange(rangeKey);
    setError("");

    try {
      const next = await fetchOverviewRange(rangeKey);
      if (!next.ok) {
        throw new Error("Traffic could not build this homepage range.");
      }

      startTransition(() => {
        setOverview(next);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this homepage range");
    } finally {
      setPendingRange(null);
    }
  };

  const countryMax = useMemo(
    () => maxCount(overview?.geo.countries.map((row) => row.sessions) ?? []),
    [overview?.geo.countries],
  );
  const projectMax = useMemo(
    () => maxCount(overview?.projects.map((row) => row.requests) ?? []),
    [overview?.projects],
  );

  if (!overview) {
    return (
      <main className="min-h-screen bg-[#06070a] text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <header className="rounded-[32px] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
            <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">
              traffic.tokentap.ca
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Traffic observatory
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              The shell is up. Traffic is loading the observatory data in the browser so the page
              can appear fast even when analytics queries are heavy.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200">
              Loading live overview…
            </div>
            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </header>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`overview-loading-${index}`}
                className="h-36 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
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

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {RANGE_OPTIONS.map((option) => {
                  const isActive = overview.range_key === option.key;
                  const isPending = pendingRange === option.key;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => void loadRange(option.key)}
                      disabled={Boolean(pendingRange)}
                      className={`cursor-pointer rounded-full border px-3 py-1 font-medium transition disabled:cursor-not-allowed ${
                        isActive
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                          : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white"
                      } ${isPending ? "opacity-70" : ""}`}
                    >
                      {isPending ? `Loading ${option.label}` : option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid w-full gap-3 text-sm text-slate-300 lg:w-auto">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Window:</span>{" "}
                <span className="text-white">{overview.range_label}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Generated:</span>{" "}
                <span className="text-white">{formatTimestamp(overview.generated_at)}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Quick read:</span>{" "}
                <span className="text-white">
                  Historical counts follow the selected range. Live Right Now still means right now.
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
              {overview.coverage_mode === "durable_store" ? "Durable history" : "Live log fallback"}
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
              {overview.range_label}
            </div>
            {overview.coverage_started_alberta ? (
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
                Stored since {overview.coverage_started_alberta}
              </div>
            ) : null}
            <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-medium text-sky-200">
              Live now stays current
            </div>
          </div>

          {overview.note ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              {overview.note}
            </div>
          ) : null}
        </header>

        <OverviewTopline
          generatedAt={overview.generated_at}
          totals={overview.totals}
          pollMs={pollMs}
        />

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

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
          <BuilderTopDeck
            uniqueLivePeople={overview.totals.live_now}
            historyRangeKey={overview.range_key}
          />
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
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
                  <li key={note} className="break-all">
                    • {note}
                  </li>
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
                    className="flex items-start justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 break-all font-mono text-sm text-rose-100">
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
                        {row.country} • {row.category} • last seen {formatTimestamp(row.last_seen || "")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
