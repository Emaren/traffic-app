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
};

const DEFAULT_RANGE_KEY: ProjectGraphRangeKey = "7d";
const RANGE_OPTIONS: Array<{ key: ProjectGraphRangeKey; label: string }> = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "1 Week" },
  { key: "30d", label: "1 Month" },
  { key: "all", label: "All Time" },
];

function prettyProjectName(name: string): string {
  return name;
}

function formatBucketSize(bucketMinutes: number) {
  if (bucketMinutes < 60) return `${bucketMinutes}m buckets`;
  if (bucketMinutes < 1440) return `${Math.round(bucketMinutes / 60)}h buckets`;
  return `${Math.round(bucketMinutes / 1440)}d buckets`;
}

function rangeLabelFor(rangeKey: ProjectGraphRangeKey) {
  return RANGE_OPTIONS.find((option) => option.key === rangeKey)?.label ?? "24 Hours";
}

export default function ProjectHumanGraphs({
  pollMs = 15000,
  uniqueLivePeople,
  initialRangeKey = DEFAULT_RANGE_KEY,
}: Props) {
  const [data, setData] = useState<ProjectHumanSeriesResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [activeRangeKey, setActiveRangeKey] =
    useState<ProjectGraphRangeKey>(initialRangeKey);
  const [pendingRange, setPendingRange] = useState<ProjectGraphRangeKey | null>(null);

  useEffect(() => {
    setActiveRangeKey(initialRangeKey);
    setPendingRange(null);
    setError("");
  }, [initialRangeKey]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
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
    const timer = window.setInterval(() => void load(), pollMs);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [activeRangeKey, pollMs]);

  const projects = useMemo<HumanSeriesProject[]>(() => data?.projects ?? [], [data]);
  const projectLiveTotal = useMemo(
    () => projects.reduce((sum, project) => sum + project.live_humans, 0),
    [projects],
  );
  const fallbackRangeLabel = rangeLabelFor(activeRangeKey);
  const description =
    data?.note ||
    `${data?.range_label ?? fallbackRangeLabel} of human-confirmed visitor flow across the observatory.`;

  const loadRange = (rangeKey: ProjectGraphRangeKey) => {
    if (rangeKey === activeRangeKey || pendingRange) return;
    setPendingRange(rangeKey);
    setActiveRangeKey(rangeKey);
    setError("");

    void (async () => {
      try {
        const next = await fetchProjectHumanSeries(rangeKey);
        startTransition(() => {
          setData(next);
        });
        setError("");
      } catch (err) {
        setActiveRangeKey(data?.range_key ?? initialRangeKey);
        setError(err instanceof Error ? err.message : "Failed to load project graphs");
      } finally {
        setPendingRange(null);
      }
    })();
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Human Visitor Graphs</h2>
          <p className="text-sm text-white/60">{description}</p>
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

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
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

      <p className="mb-4 text-sm leading-6 text-white/60">
        Project badges count who is active inside each project. The homepage
        <span className="font-medium text-white"> Live Right Now </span>
        tile counts unique live people across all of Traffic, so one person can
        raise multiple project badges while only counting once there.
      </p>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!error && !data ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          Loading project history for {fallbackRangeLabel.toLowerCase()}.
        </div>
      ) : null}

      {!error && data && projects.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          No human series yet in this range.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {projects.map((project) => (
          <div
            key={project.slug}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white">
                  {prettyProjectName(project.name)}
                </h3>
                <p className="text-xs text-white/50">Human-confirmed visitor flow</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
                  Live on project: {project.live_humans}
                </div>
                <Link
                  href={`/projects/${project.slug}`}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  Open project
                </Link>
              </div>
            </div>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={project.points}>
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
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
