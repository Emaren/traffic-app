"use client";

import type { OverviewTotals } from "@/components/traffic/types";

type Props = {
  generatedAt: string;
  totals: OverviewTotals;
  pollMs?: number;
  featuredProject?: {
    name: string;
    humans: number;
  } | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold text-white">{value}</p>
        <p className="max-w-[10rem] text-right text-[11px] leading-5 text-slate-400">{helper}</p>
      </div>
    </div>
  );
}

export default function OverviewTopline({
  generatedAt,
  totals,
  pollMs = 15000,
  featuredProject,
}: Props) {
  const compactStats = [
    {
      label: "Real Humans",
      value: formatNumber(totals.real_humans),
      helper: "Likely real people in the selected range.",
    },
    {
      label: "Live Now",
      value: formatNumber(totals.live_now),
      helper: "Unique people active right now.",
    },
    {
      label: "Projects Active",
      value: formatNumber(totals.projects_active),
      helper: "Projects with live human-ish movement.",
    },
    {
      label: "Suspicious",
      value: formatNumber(totals.suspicious),
      helper: "Sessions worth a security second look.",
    },
    {
      label: "Returning",
      value: formatNumber(totals.returning_visitors),
      helper: "Visitors seen more than once in this window.",
    },
  ];

  if (featuredProject) {
    compactStats.splice(3, 0, {
      label: `${featuredProject.name} Humans`,
      value: formatNumber(featuredProject.humans),
      helper: "Likely-human sessions on the featured project.",
    });
  }

  return (
    <section className="mt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
          KPI strip refresh {Math.round(pollMs / 1000)}s
        </div>
        <div className="text-xs text-white/45">Snapshot {new Date(generatedAt).toLocaleTimeString()}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {compactStats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            helper={stat.helper}
          />
        ))}
      </div>
    </section>
  );
}
