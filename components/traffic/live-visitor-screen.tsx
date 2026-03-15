"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchLiveVisitors } from "@/components/traffic/api";
import LiveVisitorTile from "@/components/traffic/live-visitor-tile";
import type { LiveProjectCount, LiveVisitorsResponse } from "@/components/traffic/types";

type Props = {
  pollMs?: number;
};

export default function LiveVisitorScreen({ pollMs = 10000 }: Props) {
  const [data, setData] = useState<LiveVisitorsResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await fetchLiveVisitors(25);
        if (!mounted) return;
        setData(next);
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load live visitors");
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), pollMs);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  const projectCountMap = useMemo<Record<string, LiveProjectCount>>(() => {
    const rows = data?.project_counts ?? [];
    return rows.reduce<Record<string, LiveProjectCount>>((acc, row) => {
      acc[row.slug] = row;
      return acc;
    }, {});
  }, [data]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">Visitor View Screen</h2>
          <p className="text-sm text-white/60">
            Top 25 live dossiers. Real humans rise. Garbage gets pushed out.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
            Tower: {data?.top_25.length ?? 0}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
            History: {data?.history_count ?? 0}
          </div>
          <Link
            href="/visits"
            className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:bg-sky-400/15"
          >
            Open history
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!error && (data?.top_25.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          No live visitor tiles yet.
        </div>
      ) : null}

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {(data?.top_25 ?? []).map((session) => (
            <motion.div
              key={session.session_id}
              layout
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.22 }}
            >
              <LiveVisitorTile
                session={session}
                projectCount={projectCountMap[session.project_slug]}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
