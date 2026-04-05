"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import BuilderTopDeck from "@/components/traffic/builder-top-deck";
import { fetchOverviewRange } from "@/components/traffic/api";
import type { HistoryRangeKey, OverviewResponse } from "@/components/traffic/types";

type OverviewSeed = Pick<
  OverviewResponse,
  | "ok"
  | "generated_at"
  | "range_key"
  | "range_label"
  | "coverage_mode"
  | "coverage_started_alberta"
  | "note"
  | "totals"
>;

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function HomeOverviewLite() {
  const [overview, setOverview] = useState<OverviewSeed | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = (await fetchOverviewRange("24h")) as OverviewSeed;
        if (!mounted || !next.ok) return;

        startTransition(() => {
          setOverview(next);
          setError("");
        });
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load Traffic overview seed");
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const uniqueLivePeople = overview?.totals.live_now ?? 0;
  const historyRangeKey: HistoryRangeKey = overview?.range_key ?? "24h";

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
                Live visitor stream and project graphs first. Everything else can live deeper in the stack.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/visits"
                  className="rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-400/15"
                >
                  Open visits history
                </Link>

                <Link
                  href="/admin"
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
                >
                  Open admin cockpit
                </Link>
              </div>
            </div>

            <div className="grid w-full gap-3 text-sm text-slate-300 lg:w-auto">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Homepage mode:</span>{" "}
                <span className="text-white">Live surfaces only</span>
              </div>

              {overview ? (
                <>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="text-slate-400">Overview seed:</span>{" "}
                    <span className="text-white">{overview.range_label}</span>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="text-slate-400">Generated:</span>{" "}
                    <span className="text-white">{formatTimestamp(overview.generated_at)}</span>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span className="text-slate-400">Overview seed:</span>{" "}
                  <span className="text-white">Loading…</span>
                </div>
              )}
            </div>
          </div>

          {overview ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
                {overview.coverage_mode === "durable_store" ? "Durable history" : "Live log fallback"}
              </div>

              {overview.coverage_started_alberta ? (
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
                  Stored since {overview.coverage_started_alberta}
                </div>
              ) : null}

              <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-medium text-sky-200">
                Live people seed: {uniqueLivePeople}
              </div>
            </div>
          ) : null}

          {overview?.note ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              {overview.note}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </header>

        <div className="mt-6">
          <BuilderTopDeck
            uniqueLivePeople={uniqueLivePeople}
            historyRangeKey={historyRangeKey}
          />
        </div>
      </div>
    </main>
  );
}
