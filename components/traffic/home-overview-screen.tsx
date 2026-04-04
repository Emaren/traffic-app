"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import BuilderTopDeck from "@/components/traffic/builder-top-deck";
import OverviewTopline from "@/components/traffic/overview-topline";
import { fetchOverviewRange } from "@/components/traffic/api";
import type { HistoryRangeKey, OverviewResponse } from "@/components/traffic/types";

const RANGE_OPTIONS: Array<{ key: HistoryRangeKey; label: string }> = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "1 Week" },
  { key: "30d", label: "1 Month" },
  { key: "all", label: "All Time" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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

function pageIsHidden() {
  return typeof document !== "undefined" && document.hidden;
}

export default function HomeOverviewScreen({
  initialOverview,
  pollMs = 30000,
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
      if (pageIsHidden()) return;

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

    const handleVisibilityChange = () => {
      if (!mounted || pageIsHidden()) return;
      void load();
    };

    const timer = window.setInterval(() => {
      if (!pageIsHidden()) {
        void load();
      }
    }, pollMs);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeRangeKey, pollMs]);

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
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200">
                Loading live overview...
              </div>
              <Link
                href="/admin"
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
              >
                Open admin cockpit
              </Link>
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
              <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">
                traffic.tokentap.ca
              </p>
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
                <Link
                  href="/admin"
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 font-medium text-cyan-100 transition hover:bg-cyan-300/15"
                >
                  Admin cockpit
                </Link>
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

        <section className="mt-6 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Archive Direction</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Visitor history replaces the old explorer slab
                </h2>
              </div>

              <Link
                href="/visits"
                className="rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-200 transition hover:bg-sky-400/15"
              >
                Open visits history
              </Link>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
              The live stream above is now the realtime surface, and the dedicated archive is the deep
              history surface. Traffic is slimming away the duplicate session-explorer slab so this page
              stays focused on observatory truth instead of repeating the same story twice.
            </p>
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