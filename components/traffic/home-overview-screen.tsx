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
  const hasOverview = Boolean(overview);
  const alerts = overview?.alerts ?? [];
  const notes = overview?.notes ?? [];
  const geoCountries = overview?.geo?.countries ?? [];
  const geoAreas = overview?.geo?.areas ?? [];
  const geoCities = overview?.geo?.cities ?? [];
  const suspiciousPaths = overview?.suspicious?.top_paths ?? [];
  const suspiciousIps = overview?.suspicious?.top_ips ?? [];
  const hasGeo = geoCountries.length > 0 || geoAreas.length > 0 || geoCities.length > 0;
  const hasSuspicious = suspiciousPaths.length > 0 || suspiciousIps.length > 0;

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
    if (!hasOverview) return;

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
  }, [activeRangeKey, hasOverview, pollMs]);

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

  const countryMax = maxCount(geoCountries.map((row) => row.sessions));
  const projectMax = useMemo(
    () => maxCount(overview?.projects.map((row) => row.requests) ?? []),
    [overview?.projects],
  );
  const featuredProjectKpi = useMemo(() => {
    const aoe2Project = overview?.projects.find((project) => project.slug === "aoe2hdbets");
    if (!aoe2Project) return null;
    return {
      name: aoe2Project.name,
      humans: aoe2Project.human_confirmed_sessions ?? 0,
    };
  }, [overview?.projects]);

  if (!overview) {
    return (
      <main className="min-h-screen bg-[#06070a] text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(6,7,10,0.92))] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200/80">
                  traffic.tokentap.ca
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  Traffic observatory
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Reconnecting the command center. Traffic is trying to hydrate the featured graph
                  and live stream without blocking the page.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-medium text-sky-200">
                  Loading overview
                </div>
                <Link
                  href="/admin"
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 font-medium text-cyan-100 transition hover:bg-cyan-300/15"
                >
                  Admin cockpit
                </Link>
              </div>
            </div>
            {error ? (
              <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </header>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`overview-loading-${index}`}
                className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
              />
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="h-[34rem] animate-pulse rounded-[28px] border border-white/10 bg-white/[0.03]" />
            <div className="h-[34rem] animate-pulse rounded-[28px] border border-white/10 bg-white/[0.03]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(6,7,10,0.92))] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200/80">
                traffic.tokentap.ca
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Traffic observatory
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Featured graph left, realtime stream right, mini project graphs up top. The rest
                of the stack can stay below the fold.
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
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

            <div className="grid w-full gap-2 text-sm text-slate-300 lg:w-auto lg:min-w-[18rem]">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
                <span className="text-slate-400">Window:</span>{" "}
                <span className="text-white">{overview.range_label}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
                <span className="text-slate-400">Generated:</span>{" "}
                <span className="text-white">{formatTimestamp(overview.generated_at)}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
                <span className="text-slate-400">Focus:</span>{" "}
                <span className="text-white">AoE2 first, live stream always visible</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              {overview.note}
            </div>
          ) : null}
        </header>

        <OverviewTopline
          generatedAt={overview.generated_at}
          totals={overview.totals}
          pollMs={pollMs}
          featuredProject={featuredProjectKpi}
        />

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4">
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
              {alerts.length > 0 ? (
                alerts.map((alert) => (
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
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  No operator alerts are included in this overview payload right now.
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">What the dashboard is doing</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {notes.length > 0 ? (
                  notes.map((note) => (
                    <li key={note} className="break-all">
                      • {note}
                    </li>
                  ))
                ) : (
                  <li>No dashboard notes are present in this payload.</li>
                )}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-6">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Geo Intelligence</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Country and area mix</h2>

              {hasGeo ? (
                <>
                  <div className="mt-5 space-y-4">
                    {geoCountries.map((row) => {
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
                        {geoAreas.map((row) => (
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
                        {geoCities.map((row) => (
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
                </>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  Geo detail is not included in the current overview contract, so this panel stays
                  quiet instead of crashing.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Threat Surface</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Suspicious paths</h2>

              {hasSuspicious ? (
                <>
                  <div className="mt-5 space-y-3">
                    {suspiciousPaths.map((row) => (
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
                      {suspiciousIps.map((row) => (
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
                            {row.country} • {row.category} • last seen{" "}
                            {formatTimestamp(row.last_seen || "")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  Threat detail is absent from this overview payload, so the dashboard leaves this
                  panel empty on purpose.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
