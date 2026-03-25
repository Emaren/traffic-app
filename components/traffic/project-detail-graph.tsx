"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HumanSeriesPoint } from "@/components/traffic/types";

export default function ProjectDetailGraph({
  label,
  points,
}: {
  label: string;
  points: HumanSeriesPoint[];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Project Graph</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{label}</h2>
          <p className="mt-2 text-sm text-slate-400">
            24-hour view is live now. Week, month, and all-time ranges come after durable storage lands.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
            Realtime context
          </span>
          <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-medium text-sky-200">
            24 Hours
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-medium text-white/45">
            1 Week soon
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-medium text-white/45">
            1 Month soon
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-medium text-white/45">
            All Time soon
          </span>
        </div>
      </div>

      <div className="mt-5 h-72">
        <ResponsiveContainer width="100%" height="100%">
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
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
