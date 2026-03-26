"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchProjectLiveFeed } from "@/components/traffic/api";
import LiveVisitorStreamRow from "@/components/traffic/live-visitor-stream-row";
import type { SessionRecord } from "@/components/traffic/types";

type Props = {
  projectName: string;
  projectSlug: string;
  initialItems: SessionRecord[];
  pollMs?: number;
};

export default function ProjectLiveFeed({
  projectName,
  projectSlug,
  initialItems,
  pollMs = 15000,
}: Props) {
  const [items, setItems] = useState<SessionRecord[]>(initialItems);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await fetchProjectLiveFeed(projectSlug, { limit: 10 });
        if (!mounted) return;
        setItems(next.live_feed);
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load project visitor stream");
      }
    };

    const timer = window.setInterval(() => void load(), pollMs);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [pollMs, projectSlug]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Realtime Visitor Stream</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Newest movement first on {projectName}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Chronological stream for this project only. New activity animates in at the top and
            older sessions are pushed down.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
            Refreshes every {Math.round(pollMs / 1000)}s
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
            {items.length} visible
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-5 max-h-[980px] space-y-3 overflow-y-auto pr-2">
        {items.length > 0 ? (
          <AnimatePresence initial={false}>
            {items.map((session) => (
              <motion.div
                key={session.session_id}
                layout="position"
                initial={{ opacity: 0, y: -18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                <LiveVisitorStreamRow
                  session={session}
                  showProjectBadge={false}
                  showProjectLink={false}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
            No live human-ish sessions on this project right now.
          </div>
        )}
      </div>
    </div>
  );
}
