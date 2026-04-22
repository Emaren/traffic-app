"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchProjectHumanSeries } from "@/components/traffic/api";
import type {
  HumanSeriesProject,
  ProjectGraphRangeKey,
  ProjectHumanSeriesResponse,
} from "@/components/traffic/types";

type Props = {
  pollMs?: number;
  uniqueLivePeople: number;
  initialRangeKey?: ProjectGraphRangeKey;
  selectedProjectSlug?: string | null;
  onSelectProject?: (slug: string) => void;
  layout?: "combined" | "stacked";
};

const DEFAULT_RANGE_KEY: ProjectGraphRangeKey = "7d";
const DEFAULT_FEATURED_PROJECT_SLUG = "aoe2hdbets";
const PINNED_PROJECT_SLUGS = [
  "aoe2hdbets",
  "aoe2dewarwagers",
  "tokentap",
  "tokenchain",
  "llama",
  "llama-chat",
  "wallyverse",
  "wheatandstone",
] as const;
const PINNED_PROJECT_NAMES: Record<(typeof PINNED_PROJECT_SLUGS)[number], string> = {
  aoe2hdbets: "AoE2HDBets",
  aoe2dewarwagers: "AoE2DEWarWagers",
  tokentap: "TokenTap",
  tokenchain: "TokenChain",
  llama: "Llama",
  "llama-chat": "Llama Chat",
  wallyverse: "Wallyverse",
  wheatandstone: "Wheat & Stone",
};
const RANGE_OPTIONS: Array<{ key: ProjectGraphRangeKey; label: string }> = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "1 Week" },
  { key: "30d", label: "1 Month" },
  { key: "all", label: "All Time" },
];

function formatBucketSize(bucketMinutes: number) {
  if (bucketMinutes < 60) return `${bucketMinutes}m buckets`;
  if (bucketMinutes < 1440) return `${Math.round(bucketMinutes / 60)}h buckets`;
  return `${Math.round(bucketMinutes / 1440)}d buckets`;
}

function rangeLabelFor(rangeKey: ProjectGraphRangeKey) {
  return RANGE_OPTIONS.find((option) => option.key === rangeKey)?.label ?? "24 Hours";
}

function pageIsHidden() {
  return typeof document !== "undefined" && document.hidden;
}

function sumVisitors(project: HumanSeriesProject): number {
  return project.points.reduce((sum, point) => sum + point.visitors, 0);
}

function peakVisitors(project: HumanSeriesProject): number {
  return project.points.reduce((peak, point) => Math.max(peak, point.visitors), 0);
}

function pinnedIndex(slug: string) {
  const index = PINNED_PROJECT_SLUGS.indexOf(slug as (typeof PINNED_PROJECT_SLUGS)[number]);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function placeholderProject(slug: (typeof PINNED_PROJECT_SLUGS)[number]): HumanSeriesProject {
  return {
    slug,
    name: PINNED_PROJECT_NAMES[slug],
    live_humans: 0,
    points: [],
  } as HumanSeriesProject;
}

export default function ProjectHumanGraphs({
  pollMs = 30000,
  uniqueLivePeople,
  initialRangeKey = DEFAULT_RANGE_KEY,
  selectedProjectSlug,
  onSelectProject,
  layout = "combined",
}: Props) {
  const [data, setData] = useState<ProjectHumanSeriesResponse | null>(null);
  const [error, setError] = useState("");
  const [activeRangeKey, setActiveRangeKey] = useState<ProjectGraphRangeKey>(initialRangeKey);
  const [pendingRange, setPendingRange] = useState<ProjectGraphRangeKey | null>(null);
  const [internalSelectedSlug, setInternalSelectedSlug] = useState(DEFAULT_FEATURED_PROJECT_SLUG);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (pageIsHidden()) return;

      try {
        const next = await fetchProjectHumanSeries(activeRangeKey);
        if (!mounted) return;

        startTransition(() => {
          setData(next);
        });
        setError("");
        setPendingRange(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load project graphs");
        setPendingRange(null);
      }
    };

    void load();

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

  const projects = useMemo<HumanSeriesProject[]>(() => {
    const rawProjects = data?.projects ?? [];
    return [...rawProjects].sort((left, right) => {
      const leftPinned = pinnedIndex(left.slug);
      const rightPinned = pinnedIndex(right.slug);

      if (leftPinned !== rightPinned) {
        return leftPinned - rightPinned;
      }

      const leftScore = left.live_humans * 1000 + peakVisitors(left) * 10 + sumVisitors(left);
      const rightScore = right.live_humans * 1000 + peakVisitors(right) * 10 + sumVisitors(right);
      return rightScore - leftScore;
    });
  }, [data]);

  const visibleProjects = useMemo<HumanSeriesProject[]>(() => {
    const projectMap = new Map(projects.map((project) => [project.slug, project]));
    const pinned = PINNED_PROJECT_SLUGS.map(
      (slug) => projectMap.get(slug) ?? placeholderProject(slug),
    );

    const seen = new Set(pinned.map((project) => project.slug));
    const strongestRemainder = projects
      .filter((project) => !seen.has(project.slug))
      .slice(0, Math.max(0, 8 - pinned.length));

    return [...pinned, ...strongestRemainder];
  }, [projects]);

  const fallbackProjectSlug = useMemo(() => {
    if (visibleProjects.some((project) => project.slug === DEFAULT_FEATURED_PROJECT_SLUG)) {
      return DEFAULT_FEATURED_PROJECT_SLUG;
    }
    return visibleProjects[0]?.slug ?? null;
  }, [visibleProjects]);

  const selectedSlugCandidate = selectedProjectSlug ?? internalSelectedSlug;
  const activeSelectedSlug =
    visibleProjects.some((project) => project.slug === selectedSlugCandidate)
      ? selectedSlugCandidate
      : fallbackProjectSlug;
  const featuredProject =
    visibleProjects.find((project) => project.slug === activeSelectedSlug) ??
    visibleProjects[0] ??
    null;
  const projectLiveTotal = useMemo(
    () => visibleProjects.reduce((sum, project) => sum + project.live_humans, 0),
    [visibleProjects],
  );
  const fallbackRangeLabel = rangeLabelFor(activeRangeKey);
  const description =
    data?.note ||
    `${data?.range_label ?? fallbackRangeLabel} of human-confirmed visitor flow across Traffic.`;

  const loadRange = (rangeKey: ProjectGraphRangeKey) => {
    if (rangeKey === activeRangeKey || pendingRange) return;
    setPendingRange(rangeKey);
    setActiveRangeKey(rangeKey);
    setError("");
  };

  const selectProject = (slug: string) => {
    if (!selectedProjectSlug) {
      setInternalSelectedSlug(slug);
    }
    onSelectProject?.(slug);
  };

  if (layout === "stacked") {
    return (
      <div className="space-y-5">
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(8,10,14,0.92))] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.28)] md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                Multi-Project Pulse
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                Pinned project lanes, then strongest movers
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Select any mini graph to move it into the featured lane below without crowding the
                live visitor stream.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {RANGE_OPTIONS.map((option) => {
                const isActive = activeRangeKey === option.key;
                const isPending = pendingRange === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => loadRange(option.key)}
                    disabled={Boolean(pendingRange)}
                    className={`cursor-pointer rounded-full border px-3 py-1 font-medium transition disabled:cursor-not-allowed ${
                      isActive
                        ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                        : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white"
                    } ${isPending ? "opacity-70" : ""}`}
                  >
                    {isPending ? `Loading ${option.label}` : option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-300">
              {!data
                ? "Loading history"
                : data.coverage_mode === "durable_store"
                  ? "Durable history"
                  : "Live log fallback"}
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
              {data?.range_label ?? fallbackRangeLabel}
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
              {formatBucketSize(data?.bucket_minutes ?? 180)}
            </div>
            {data?.coverage_started_alberta ? (
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
                Stored since {data.coverage_started_alberta}
              </div>
            ) : null}
            <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-medium text-sky-200">
              Unique live people: {uniqueLivePeople}
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
              Featured defaults to AoE2HDBets
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-white/60">{description}</p>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {!error && !data ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
              Loading project history for {fallbackRangeLabel.toLowerCase()}.
            </div>
          ) : null}

          {!error && data && visibleProjects.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
              No human series yet in this range.
            </div>
          ) : null}

          {visibleProjects.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {visibleProjects.map((project) => {
                const selected = featuredProject?.slug === project.slug;
                const totalVisitors = sumVisitors(project);
                const peak = peakVisitors(project);

                return (
                  <button
                    key={project.slug}
                    type="button"
                    onClick={() => selectProject(project.slug)}
                    className={`cursor-pointer rounded-[24px] border p-5 text-left transition ${
                      selected
                        ? "border-amber-400/35 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.22)]"
                        : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {project.name}
                        </div>
                        <div className="mt-1 text-[11px] text-white/45">
                          {selected ? "Featured below" : "Move into featured lane"}
                        </div>
                      </div>
                      <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
                        Live {project.live_humans}
                      </div>
                    </div>

                    <div className="mt-4 h-24 min-w-0 overflow-hidden">
                      {project.points.length > 0 ? (
                        <ResponsiveContainer width="100%" height={96} minWidth={0}>
                          <LineChart data={project.points}>
                            <Tooltip
                              contentStyle={{
                                background: "rgba(10,10,14,0.95)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 16,
                                color: "#fff",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="visitors"
                              stroke={selected ? "#f59e0b" : "#38bdf8"}
                              strokeWidth={2.5}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[11px] text-white/45">
                          No human points yet
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                        Peak {peak}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                        Total {totalVisitors}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(5,7,12,0.96))] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.32)] md:p-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Featured Graph
                </p>
                <h3 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  {featuredProject ? featuredProject.name : "Project movement"}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  The main analytical surface stays dedicated to one project at a time, so the
                  spike story is easy to read.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {featuredProject ? (
                  <>
                    <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
                      Live on project: {featuredProject.live_humans}
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
                      Peak bucket: {peakVisitors(featuredProject)}
                    </div>
                    <Link
                      href={`/projects/${featuredProject.slug}`}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-medium text-white/75 transition hover:border-white/20 hover:text-white"
                    >
                      Open project
                    </Link>
                  </>
                ) : (
                  <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
                    Featured graph is waiting for project history
                  </div>
                )}
              </div>
            </div>

            {featuredProject ? (
              <div className="h-[24rem] min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#05070c]/75 p-4">
                {featuredProject.points.length > 0 ? (
                  <ResponsiveContainer width="100%" height={384} minWidth={0}>
                    <LineChart data={featuredProject.points}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={18}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={24}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(10,10,14,0.95)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 16,
                        color: "#fff",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="visitors"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-white/45">
                    No human points yet
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                {data
                  ? "No featured project graph is available in this range yet."
                  : `Loading featured project history for ${fallbackRangeLabel.toLowerCase()}.`}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Featured Human Visitor Graph</p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {featuredProject ? featuredProject.name : "Project movement"}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">
            Mini graphs swap the focused project without losing the live stream beside it.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {RANGE_OPTIONS.map((option) => {
            const isActive = activeRangeKey === option.key;
            const isPending = pendingRange === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => loadRange(option.key)}
                disabled={Boolean(pendingRange)}
                className={`cursor-pointer rounded-full border px-3 py-1 font-medium transition disabled:cursor-not-allowed ${
                  isActive
                    ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                    : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white"
                } ${isPending ? "opacity-70" : ""}`}
              >
                {isPending ? `Loading ${option.label}` : option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-300">
          {!data
            ? "Loading history"
            : data.coverage_mode === "durable_store"
              ? "Durable history"
              : "Live log fallback"}
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
          {data?.range_label ?? fallbackRangeLabel}
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
          {formatBucketSize(data?.bucket_minutes ?? 180)}
        </div>
        {data?.coverage_started_alberta ? (
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
            Stored since {data.coverage_started_alberta}
          </div>
        ) : null}
        <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-medium text-sky-200">
          Unique live people: {uniqueLivePeople}
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
          Project live badges: {projectLiveTotal}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-white/60">{description}</p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!error && !data ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          Loading project history for {fallbackRangeLabel.toLowerCase()}.
        </div>
      ) : null}

      {!error && data && visibleProjects.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          No human series yet in this range.
        </div>
      ) : null}

      {visibleProjects.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {visibleProjects.map((project) => {
            const selected = featuredProject?.slug === project.slug;
            const totalVisitors = sumVisitors(project);
            const peak = peakVisitors(project);

            return (
              <button
                key={project.slug}
                type="button"
                onClick={() => selectProject(project.slug)}
                className={`cursor-pointer rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-amber-400/35 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.22)]"
                    : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{project.name}</div>
                    <div className="mt-1 text-[11px] text-white/45">
                      {selected ? "Featured graph" : "Swap into focus"}
                    </div>
                  </div>
                  <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
                    Live {project.live_humans}
                  </div>
                </div>

                <div className="mt-3 h-20 min-w-0 overflow-hidden">
                  {project.points.length > 0 ? (
                    <ResponsiveContainer width="100%" height={80} minWidth={0}>
                      <LineChart data={project.points}>
                        <Tooltip
                          contentStyle={{
                            background: "rgba(10,10,14,0.95)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 16,
                            color: "#fff",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="visitors"
                          stroke={selected ? "#f59e0b" : "#38bdf8"}
                          strokeWidth={2.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[11px] text-white/45">
                      No human points yet
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    Peak {peak}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    Total {totalVisitors}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {featuredProject ? (
        <div className="mt-4 rounded-[28px] border border-white/10 bg-[#05070c]/90 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Focused Project</p>
              <h3 className="mt-1 text-xl font-semibold text-white">{featuredProject.name}</h3>
              <p className="mt-1 max-w-3xl text-sm text-slate-300">
                Human-confirmed visitor arrivals only, so one chatty page or polling loop does not
                masquerade as a crowd.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
                Live on project: {featuredProject.live_humans}
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
                Peak bucket: {peakVisitors(featuredProject)}
              </div>
              <Link
                href={`/projects/${featuredProject.slug}`}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-medium text-white/75 transition hover:border-white/20 hover:text-white"
              >
                Open project
              </Link>
            </div>
          </div>

          <div className="mt-4 h-[20rem] min-w-0 overflow-hidden">
            {featuredProject.points.length > 0 ? (
              <ResponsiveContainer width="100%" height={320} minWidth={0}>
                <LineChart data={featuredProject.points}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={24}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,10,14,0.95)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 16,
                    color: "#fff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="visitors"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-white/45">
                No human points yet
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
