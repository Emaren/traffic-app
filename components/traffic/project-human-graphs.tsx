"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { HumanSeriesProject, ProjectHumanSeriesResponse } from "@/components/traffic/types";

type Props = {
  pollMs?: number;
};

function prettyProjectName(name: string): string {
  return name;
}

export default function ProjectHumanGraphs({ pollMs = 15000 }: Props) {
  const [data, setData] = useState<ProjectHumanSeriesResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await fetchProjectHumanSeries(24, 30);
        if (!mounted) return;
        setData(next);
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load project graphs");
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), pollMs);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  const projects = useMemo<HumanSeriesProject[]>(() => data?.projects ?? [], [data]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Human Visitor Graphs</h2>
          <p className="text-sm text-white/60">
            New human-confirmed visitors per project over the last 24 hours.
          </p>
        </div>
        <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Live graphs
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!error && projects.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          No human series yet.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {projects.map((project) => (
          <div
            key={project.slug}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {prettyProjectName(project.name)}
                </h3>
                <p className="text-xs text-white/50">Human-confirmed visitor flow</p>
              </div>
              <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
                Live now: {project.live_humans}
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
