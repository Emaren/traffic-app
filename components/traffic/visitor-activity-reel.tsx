"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { SessionRecord } from "@/components/traffic/types";

type Props = {
  pollMs?: number;
  session: SessionRecord | null;
};

const LIVE_REEL_LIMIT = 180;

function routeKindClass(routeKind: string) {
  switch (routeKind) {
    case "page":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "api":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "probe":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-white/65";
  }
}

function formatStepTime(value: string) {
  const tokens = value.split(" ");
  return tokens.length >= 3 ? tokens.slice(-2).join(" ") : value;
}

function badgeClass(isLatest: boolean, isFresh: boolean) {
  if (isFresh) {
    return "border-sky-300/40 bg-sky-300/12 shadow-[0_0_0_1px_rgba(125,211,252,0.18),0_12px_36px_rgba(14,165,233,0.18)]";
  }
  if (isLatest) {
    return "border-emerald-300/35 bg-emerald-300/10 shadow-[0_0_0_1px_rgba(110,231,183,0.16)]";
  }
  return "border-white/10 bg-white/[0.04]";
}

export default function VisitorActivityReel({ session, pollMs = 5000 }: Props) {
  const allSteps = useMemo(() => session?.activity_sequence ?? [], [session?.activity_sequence]);
  const steps = useMemo(() => allSteps.slice(-LIVE_REEL_LIMIT), [allSteps]);
  const latestStep = steps.at(-1) ?? null;
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const [pinnedToLatest, setPinnedToLatest] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousStepIdsRef = useRef<string[]>(steps.map((step) => step.id));
  const shouldStickToRightRef = useRef(true);

  const stepSignature = useMemo(() => steps.map((step) => step.id).join("|"), [steps]);

  useEffect(() => {
    const previousIds = new Set(previousStepIdsRef.current);
    const newIds = steps
      .map((step) => step.id)
      .filter((stepId) => !previousIds.has(stepId));

    previousStepIdsRef.current = steps.map((step) => step.id);

    if (!newIds.length) {
      return;
    }

    setFreshIds((current) => Array.from(new Set([...current, ...newIds])));
    const timer = window.setTimeout(() => {
      setFreshIds((current) => current.filter((stepId) => !newIds.includes(stepId)));
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [stepSignature, steps]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !shouldStickToRightRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      element.scrollTo({ left: element.scrollWidth, behavior: "smooth" });
      shouldStickToRightRef.current = true;
      setPinnedToLatest(true);
    });
  }, [stepSignature]);

  const handleScroll = () => {
    const element = containerRef.current;
    if (!element) return;
    const remaining = element.scrollWidth - element.clientWidth - element.scrollLeft;
    const isPinned = remaining < 120;
    shouldStickToRightRef.current = isPinned;
    setPinnedToLatest(isPinned);
  };

  const jumpToLatest = () => {
    const element = containerRef.current;
    if (!element) return;
    element.scrollTo({ left: element.scrollWidth, behavior: "smooth" });
    shouldStickToRightRef.current = true;
    setPinnedToLatest(true);
  };

  return (
    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live Activity Reel</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {session?.active_now ? "Watching this visitor move in near realtime" : "Latest known movement trail"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            The old 50-step ceiling is gone from the full path below. This live rail stays focused on
            the latest movement so it remains readable, and new trackable events slide in on the right.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Refreshes every {Math.round(pollMs / 1000)}s
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
            {allSteps.length} trackable events
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
            Showing latest {steps.length}
          </div>
          <button
            type="button"
            onClick={jumpToLatest}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              pinnedToLatest
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
            }`}
          >
            {pinnedToLatest ? "Pinned to latest" : "Jump to latest"}
          </button>
        </div>
      </div>

      {session ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                {session.project_name}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-white/70">
                {session.last_seen_alberta}
              </span>
              {session.active_now ? (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-medium text-emerald-200">
                  Active now
                </span>
              ) : null}
            </div>

            <div className="mt-3 text-sm text-white/75">
              Current path:{" "}
              <span className="font-mono text-sky-100/80">{latestStep?.path || session.current_page}</span>
            </div>
            <div className="mt-2 text-sm text-white/55">
              {session.page_count} pages in the full path • {session.event_count} total events in this
              session
            </div>
          </div>

          <div className="flex flex-wrap items-start content-start gap-2 self-start lg:max-w-[360px] lg:justify-end">
            <Link
              href={`/projects/${session.project_slug}`}
              className="whitespace-nowrap rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:bg-sky-400/15"
            >
              Open {session.project_name}
            </Link>
            <div className="whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
              Times Returned: {session.times_returned_in_project}
            </div>
            <div className="whitespace-nowrap rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
              Total Project Visits: {session.total_project_visits}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-[28px] border border-white/10 bg-[#05070c]/90 p-4">
        {steps.length > 0 ? (
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="overflow-x-auto pb-2"
          >
            <div className="inline-flex min-w-full items-stretch gap-3">
              <AnimatePresence initial={false}>
                {steps.map((step, index) => {
                  const isLatest = index === steps.length - 1;
                  const isFresh = freshIds.includes(step.id);

                  return (
                    <motion.div
                      key={step.id}
                      layout="position"
                      initial={{ opacity: 0, x: 20, scale: 0.98, filter: "blur(4px)" }}
                      animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.26, ease: [0.2, 0.9, 0.2, 1] }}
                      className="inline-flex items-center gap-3"
                    >
                      <div
                        className={`min-w-[220px] max-w-[280px] rounded-2xl border p-3 transition ${badgeClass(
                          isLatest,
                          isFresh,
                        )}`}
                        title={step.path}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${routeKindClass(
                              step.route_kind,
                            )}`}
                          >
                            {step.route_kind}
                          </span>
                          <span className="text-[11px] text-white/45">
                            {formatStepTime(step.timestamp_alberta)}
                          </span>
                        </div>
                        <div className="mt-2 truncate font-mono text-xs text-white/85">
                          {step.path}
                        </div>
                      </div>

                      {isLatest ? (
                        <div className="flex items-center gap-2 pr-2 text-xs text-emerald-200/80">
                          <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                          latest
                        </div>
                      ) : (
                        <div className="text-white/20">-&gt;</div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
            Traffic has not seen any trackable page or route movement for this visitor yet.
          </div>
        )}
      </div>
    </section>
  );
}
