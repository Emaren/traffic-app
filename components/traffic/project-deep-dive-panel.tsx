"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { fetchProjectDetail } from "@/components/traffic/api";
import type { ProjectDetailResponse } from "@/components/traffic/types";

type Props = {
  projectName: string;
  projectSlug: string;
  windowHours: number;
};

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

function routeKindClass(routeKind: string) {
  if (routeKind === "page") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (routeKind === "probe") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  if (routeKind === "api") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  return "border-white/10 bg-white/5 text-white/70";
}

function LoadingPanel() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`project-deep-dive-loading-${index}`}
          className="h-48 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

export default function ProjectDeepDivePanel({
  projectName,
  projectSlug,
  windowHours,
}: Props) {
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(async () => {
      try {
        const next = await fetchProjectDetail(projectSlug, {
          windowHours,
          includeDeep: true,
        });
        if (!mounted) return;
        startTransition(() => {
          setDetail(next);
          setError("");
        });
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load the project deep dive");
      }
    }, 250);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [projectSlug, reloadKey, windowHours]);

  const pageRoutes = useMemo(
    () => detail?.top_pages.filter((page) => page.route_kind === "page") ?? [],
    [detail?.top_pages],
  );
  const noisyRoutes = useMemo(
    () => detail?.top_pages.filter((page) => page.route_kind !== "page") ?? [],
    [detail?.top_pages],
  );

  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Deep Drilldown</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Routes, geos, hosts, and threat context</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            This deeper layer loads after the project shell so {projectName} can open fast without
            dropping the operator detail you still need.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
            Window {windowHours}h
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
            Lazy-loaded after shell
          </div>
        </div>
      </div>

      {!detail && !error ? <LoadingPanel /> : null}

      {error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-100">
          <div>{error}</div>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="mt-3 cursor-pointer rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-300/15"
          >
            Retry deep dive
          </button>
        </div>
      ) : null}

      {detail ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Top Routes</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Human navigation first</h3>

              <div className="mt-5 space-y-3">
                {pageRoutes.length > 0 ? (
                  pageRoutes.map((page) => (
                    <div
                      key={`page-route-${page.path}`}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="break-all font-mono text-sm text-white">{page.path}</div>
                          <div className="mt-2 text-xs text-slate-400">
                            {formatNumber(page.views)} views • {formatNumber(page.entries)} entries •{" "}
                            {formatSeconds(page.avg_seconds)} avg
                          </div>
                        </div>
                        <div className={`rounded-full border px-3 py-1 text-xs ${routeKindClass(page.route_kind)}`}>
                          {page.route_kind}
                        </div>
                      </div>
                      <div className="mt-2 break-all text-xs text-slate-400">
                        Next: {page.top_next_paths[0]?.path || "—"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                    No strong page-navigation routes in this window yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Polling and API Noise</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">De-emphasized but still honest</h3>

              <div className="mt-5 space-y-3">
                {noisyRoutes.length > 0 ? (
                  noisyRoutes.map((page) => (
                    <div
                      key={`noisy-route-${page.path}`}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="break-all font-mono text-sm text-white">{page.path}</div>
                          <div className="mt-2 text-xs text-slate-400">
                            {formatNumber(page.views)} hits • {formatNumber(page.entries)} entries •{" "}
                            route kind {page.route_kind}
                          </div>
                        </div>
                        <div className={`rounded-full border px-3 py-1 text-xs ${routeKindClass(page.route_kind)}`}>
                          {page.route_kind}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                    No API-heavy or probe-heavy routes stood out in this window.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Geo Mix</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Top countries and areas</h3>

              <div className="mt-5 space-y-3">
                {detail.geo.countries.map((row) => (
                  <div
                    key={`country-${row.country}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 break-words text-sm text-white">{row.country}</span>
                    <span className="text-sm font-semibold text-sky-300">
                      {formatNumber(row.sessions)} sessions
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">Top Areas</div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {detail.geo.areas.map((row) => (
                    <div
                      key={`area-${row.country}-${row.area}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span>{row.area}, {row.country}</span>
                      <span className="font-semibold text-amber-300">{formatNumber(row.sessions)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Project Hosts</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Normalization check</h3>

              <div className="mt-5 space-y-3">
                {detail.hosts.map((host) => (
                  <div
                    key={host.host}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="break-all font-medium text-white">{host.host}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      {formatNumber(host.requests)} requests • {formatNumber(host.unique_visitors)} visitors •{" "}
                      {formatNumber(host.sessions)} sessions
                    </div>
                    <div className="mt-2 break-all text-xs text-slate-400">
                      Entry {host.top_entry_page} • Exit {host.top_exit_page} • Avg session {formatSeconds(host.avg_session_seconds)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Threat Surface</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Suspicious paths and bad IPs</h3>

              <div className="mt-5 space-y-3">
                {detail.suspicious.top_paths.length > 0 ? (
                  detail.suspicious.top_paths.map((row) => (
                    <div
                      key={`path-${row.path}`}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3"
                    >
                      <span className="min-w-0 flex-1 break-all font-mono text-sm text-rose-100">
                        {row.path}
                      </span>
                      <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-semibold text-rose-200">
                        {formatNumber(row.count)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                    No suspicious paths stood out in this project window.
                  </div>
                )}
              </div>

              {detail.suspicious.top_ips.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/40">Top Bad IPs</div>
                  <div className="mt-3 space-y-3">
                    {detail.suspicious.top_ips.map((row) => (
                      <div
                        key={`ip-${row.ip}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-sm text-white">{row.ip}</span>
                          <span className="text-sm font-semibold text-amber-300">
                            {formatNumber(row.count)}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          {row.country} • {row.category}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
