"use client";

import type { OverviewTotals } from "@/components/traffic/types";

type Props = {
  generatedAt: string;
  totals: OverviewTotals;
  pollMs?: number;
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{helper}</p>
    </div>
  );
}

export default function OverviewTopline({
  generatedAt,
  totals,
  pollMs = 15000,
}: Props) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
          Topline refreshes every {Math.round(pollMs / 1000)}s
        </div>
        <div className="text-xs text-white/45">Snapshot {new Date(generatedAt).toLocaleTimeString()}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Total Visitors"
          value={formatNumber(totals.total_visitors)}
          helper="Distinct visitor fingerprints seen in this time range."
        />
        <StatCard
          label="Real Humans"
          value={formatNumber(totals.real_humans)}
          helper="Visitors Traffic believes are probably real people."
        />
        <StatCard
          label="Suspected Bots"
          value={formatNumber(totals.suspected_bots)}
          helper="Known bots plus clearly automated or suspicious actors."
        />
        <StatCard
          label="Live Right Now"
          value={formatNumber(totals.live_now)}
          helper="Unique live people across all of Traffic right now."
        />
        <StatCard
          label="Returning Visitors"
          value={formatNumber(totals.returning_visitors)}
          helper="Visitors Traffic has already seen more than once in this window."
        />
        <StatCard
          label="Projects Active"
          value={formatNumber(totals.projects_active)}
          helper="Projects with live human-ish traffic right now."
        />
      </div>
    </section>
  );
}
