"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchLiveVisitors } from "@/components/traffic/api";
import LiveVisitorStreamRow from "@/components/traffic/live-visitor-stream-row";
import type { LiveVisitorsResponse, SessionRecord } from "@/components/traffic/types";

type Props = {
  pollMs?: number;
};

type StreamSection = {
  key: "archive" | "recent" | "live";
  title: string;
  description: string;
  badgeClass: string;
  items: SessionRecord[];
};

const RECENT_WINDOW_MINUTES = 60;

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function LiveVisitorScreen({ pollMs = 10000 }: Props) {
  const [data, setData] = useState<LiveVisitorsResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [pinnedToTop, setPinnedToTop] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToTopRef = useRef(true);

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

  const streamItems = useMemo(() => data?.stream_items ?? [], [data?.stream_items]);
  const newestFirstItems = useMemo(() => [...streamItems].reverse(), [streamItems]);
  const generatedAt = useMemo(
    () => parseTimestamp(data?.generated_at ?? new Date().toISOString()),
    [data?.generated_at],
  );

  const sections = useMemo<StreamSection[]>(() => {
    const recentCutoff = generatedAt - RECENT_WINDOW_MINUTES * 60 * 1000;
    const archive: SessionRecord[] = [];
    const recent: SessionRecord[] = [];
    const live: SessionRecord[] = [];

    for (const session of newestFirstItems) {
      const movementTs = parseTimestamp(session.last_seen_at || session.ended_at);
      if (session.active_now) {
        live.push(session);
      } else if (movementTs >= recentCutoff) {
        recent.push(session);
      } else {
        archive.push(session);
      }
    }

    const sectionRows: StreamSection[] = [
      {
        key: "live",
        title: "Happening Now",
        description: "Newest live movement sits at the top and older movement falls downward.",
        badgeClass: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
        items: live,
      },
      {
        key: "recent",
        title: "Recently Quiet",
        description: "Newest recently quiet sessions first, followed by older ones underneath.",
        badgeClass: "border-amber-400/30 bg-amber-400/10 text-amber-200",
        items: recent,
      },
      {
        key: "archive",
        title: "Earlier In Window",
        description: "Older visible sessions in reverse chronology, with the most recent of them first.",
        badgeClass: "border-white/10 bg-white/5 text-white/70",
        items: archive,
      },
    ];

    return sectionRows.filter((section) => section.items.length > 0);
  }, [generatedAt, newestFirstItems]);

  const streamHeadSignature = useMemo(
    () =>
      newestFirstItems
        .slice(0, 6)
        .map((session) => `${session.session_id}:${session.last_seen_at}`)
        .join("|"),
    [newestFirstItems],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (shouldStickToTopRef.current) {
      window.requestAnimationFrame(() => {
        element.scrollTo({ top: 0, behavior: "smooth" });
        shouldStickToTopRef.current = true;
        setPinnedToTop(true);
      });
    }
  }, [streamHeadSignature]);

  const handleScroll = () => {
    const element = containerRef.current;
    if (!element) return;
    const isPinned = element.scrollTop < 120;
    shouldStickToTopRef.current = isPinned;
    setPinnedToTop(isPinned);
  };

  const jumpToNewest = () => {
    const element = containerRef.current;
    if (!element) return;
    element.scrollTo({ top: 0, behavior: "smooth" });
    shouldStickToTopRef.current = true;
    setPinnedToTop(true);
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">Realtime Visitor Stream</h2>
          <p className="max-w-3xl text-sm text-white/60">
            Near realtime, refreshed every 15 seconds. This stream is chronological, not ranked:
            newest movement sits at the top, animates in there, and older sessions get pushed down.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
            Refreshes every {Math.round(pollMs / 1000)}s
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
            Visible in stream: {streamItems.length}
          </div>
          <button
            type="button"
            onClick={jumpToNewest}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              pinnedToTop
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
            }`}
          >
            {pinnedToTop ? "Pinned to newest" : "Jump to newest"}
          </button>
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

      {!error && streamItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          No human-ish sessions are visible in the stream yet.
        </div>
      ) : null}

      {!error && streamItems.length > 0 ? (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="max-h-[1100px] overflow-y-auto pr-2"
        >
          <div className="space-y-6 pb-3">
            {sections.map((section) => (
              <div key={section.key}>
                <div className="sticky top-0 z-10 mb-3 rounded-2xl border border-white/10 bg-[#090b11]/90 px-4 py-3 backdrop-blur">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-white">{section.title}</h3>
                      <p className="text-xs text-white/50">{section.description}</p>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs ${section.badgeClass}`}>
                      {section.items.length} visible
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {section.items.map((session) => (
                      <motion.div
                        key={`${section.key}-${session.session_id}`}
                        layout="position"
                        initial={{ opacity: 0, y: -18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <LiveVisitorStreamRow session={session} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
