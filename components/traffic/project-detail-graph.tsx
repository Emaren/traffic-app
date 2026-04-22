"use client";

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
import { fetchProjectGraph } from "@/components/traffic/api";
import type { ProjectGraphData, ProjectGraphRangeKey } from "@/components/traffic/types";

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

export default function ProjectDetailGraph({
  projectSlug,
  initialGraph,
}: {
  projectSlug: string;
  initialGraph: ProjectGraphData;
}) {
  const [graph, setGraph] = useState<ProjectGraphData>(initialGraph);
  const [pendingRange, setPendingRange] = useState<ProjectGraphRangeKey | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setGraph(initialGraph);
    setPendingRange(null);
    setError("");
  }, [initialGraph, projectSlug]);

  const loadRange = async (rangeKey: ProjectGraphRangeKey) => {
    if (rangeKey === graph.range_key || pendingRange) return;

    setPendingRange(rangeKey);
    setError("");

    try {
      const next = await fetchProjectGraph(projectSlug, rangeKey);
      if (!next.ok) {
        throw new Error("Traffic could not build this project graph range.");
      }

      startTransition(() => {
        setGraph(next.graph);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this graph range");
    } finally {
      setPendingRange(null);
    }
  };

  const description =
    graph.note ||
    `${graph.range_label} is now backed by Traffic's durable history so this graph can grow beyond the live window.`;

  const points = useMemo(
    () => (Array.isArray(graph.points) ? graph.points.filter(Boolean) : []),
    [graph.points],
  );

  const hasPoints = points.length > 0;
  const chartKey = `${projectSlug}:${graph.range_key}:${graph.coverage_started_at ?? "na"}:${points.length}`;

  return (
    <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Project Graph</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{graph.label}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {RANGE_OPTIONS.map((option) => {
            const isActive = graph.range_key === option.key;
            const isPending = pendingRange === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => void loadRange(option.key)}
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
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
          {graph.coverage_mode === "durable_store" ? "Durable history" : "Live log fallback"}
        </span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
          {formatBucketSize(graph.bucket_minutes)}
        </span>
        {graph.coverage_started_alberta ? (
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
            Stored since {graph.coverage_started_alberta}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-5 min-w-0">
        {hasPoints ? (
          <div className="h-72 min-w-0">
            <ResponsiveContainer key={chartKey} width="100%" height={288} minWidth={0}>
              <LineChart data={points}>
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
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-slate-400">
            No graph data available for this range yet.
          </div>
        )}
      </div>
    </div>
  );
}
