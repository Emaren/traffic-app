"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  buildLiveVisitorsStreamUrl,
  fetchLiveVisitors,
} from "@/components/traffic/api";
import LiveVisitorStreamRow from "@/components/traffic/live-visitor-stream-row";
import type {
  LiveTransportMode,
  ProjectFilterOption,
  LiveVisitorsResponse,
  SessionRecord,
} from "@/components/traffic/types";
import {
  TRAFFIC_HIDDEN_IPS_KEY,
  loadStoredBoolean,
  loadStoredString,
  loadStoredStringArray,
  reconcileSelectedValues,
  storeBoolean,
  storeString,
  storeStringArray,
  TRAFFIC_LIVE_DENSITY_KEY,
  TRAFFIC_LIVE_GREEN_ONLY_KEY,
  TRAFFIC_SHARED_PROJECT_FILTER_KEY,
} from "@/components/traffic/view-preferences";

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
const STREAM_LIMIT = 25;
const STREAM_HISTORY_LIMIT = 95;

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function transportBadge(mode: LiveTransportMode, pollMs: number) {
  if (mode === "streaming") {
    return {
      label: "Streaming live",
      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    };
  }
  if (mode === "connecting") {
    return {
      label: "Connecting live stream",
      className: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    };
  }
  return {
    label: `Fallback refresh ${Math.round(pollMs / 1000)}s`,
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  };
}

function pillClass(isActive: boolean) {
  return isActive
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : "border-white/10 bg-black/20 text-white/65 hover:border-white/20 hover:text-white";
}

export default function LiveVisitorScreen({ pollMs = 10000 }: Props) {
  const [data, setData] = useState<LiveVisitorsResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [transportMode, setTransportMode] = useState<LiveTransportMode>("connecting");
  const [transportNotice, setTransportNotice] = useState("");
  const [pinnedToTop, setPinnedToTop] = useState(true);
  const [selectedProjects, setSelectedProjects] = useState<string[]>(() =>
    loadStoredStringArray(TRAFFIC_SHARED_PROJECT_FILTER_KEY),
  );
  const [showOnlyGreenHumans, setShowOnlyGreenHumans] = useState(() =>
    loadStoredBoolean(TRAFFIC_LIVE_GREEN_ONLY_KEY),
  );
  const [hiddenIps, setHiddenIps] = useState<string[]>(() =>
    loadStoredStringArray(TRAFFIC_HIDDEN_IPS_KEY),
  );
  const [density, setDensity] = useState<"full" | "compact">(() =>
    loadStoredString(TRAFFIC_LIVE_DENSITY_KEY) === "compact" ? "compact" : "full",
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToTopRef = useRef(true);

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;
    let pollingTimer: number | null = null;
    let pollingStarted = false;

    const load = async () => {
      try {
        const next = await fetchLiveVisitors(STREAM_LIMIT, STREAM_HISTORY_LIMIT);
        if (!mounted) return;

        startTransition(() => {
          setData(next);
          setError("");
        });
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load live visitors");
      }
    };

    const startPollingFallback = (notice: string) => {
      if (!mounted || pollingStarted) return;
      pollingStarted = true;
      setTransportMode("polling");
      setTransportNotice(notice);
      void load();
      pollingTimer = window.setInterval(() => void load(), pollMs);
    };

    if (typeof window === "undefined" || typeof window.EventSource === "undefined") {
      window.setTimeout(() => {
        startPollingFallback("Live stream is unavailable here, so Traffic is using refresh fallback.");
      }, 0);
      return () => {
        mounted = false;
        if (pollingTimer !== null) {
          window.clearInterval(pollingTimer);
        }
      };
    }

    try {
      eventSource = new EventSource(
        buildLiveVisitorsStreamUrl({
          limit: STREAM_LIMIT,
          historyLimit: STREAM_HISTORY_LIMIT,
        }),
      );

      eventSource.onopen = () => {
        if (!mounted) return;
        setTransportMode("streaming");
        setTransportNotice("");
        setError("");
        if (pollingTimer !== null) {
          window.clearInterval(pollingTimer);
          pollingTimer = null;
        }
      };

      eventSource.onmessage = (event) => {
        if (!mounted) return;

        try {
          const next = JSON.parse(event.data) as LiveVisitorsResponse;
          if (!next.ok) {
            setTransportNotice("The live stream is connected, but Traffic has no visible stream data right now.");
            return;
          }

          startTransition(() => {
            setData(next);
            setTransportMode("streaming");
            setTransportNotice("");
            setError("");
          });
        } catch {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          startPollingFallback("The live stream got out of shape, so Traffic fell back to refresh.");
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        startPollingFallback("The live stream dropped, so Traffic fell back to refresh.");
      };
    } catch {
      window.setTimeout(() => {
        startPollingFallback("Traffic could not open the live stream, so refresh fallback is active.");
      }, 0);
    }

    return () => {
      mounted = false;
      if (eventSource) {
        eventSource.close();
      }
      if (pollingTimer !== null) {
        window.clearInterval(pollingTimer);
      }
    };
  }, [pollMs]);

  const availableProjects = useMemo<ProjectFilterOption[]>(
    () => data?.available_projects ?? [],
    [data?.available_projects],
  );
  const availableProjectSlugs = useMemo(
    () => availableProjects.map((project) => project.slug),
    [availableProjects],
  );
  const effectiveSelectedProjects = useMemo(
    () => reconcileSelectedValues(selectedProjects, availableProjectSlugs),
    [availableProjectSlugs, selectedProjects],
  );

  useEffect(() => {
    if (availableProjectSlugs.length === 0) return;
    storeStringArray(TRAFFIC_SHARED_PROJECT_FILTER_KEY, effectiveSelectedProjects);
  }, [availableProjectSlugs.length, effectiveSelectedProjects]);

  useEffect(() => {
    storeBoolean(TRAFFIC_LIVE_GREEN_ONLY_KEY, showOnlyGreenHumans);
  }, [showOnlyGreenHumans]);

  useEffect(() => {
    storeStringArray(TRAFFIC_HIDDEN_IPS_KEY, hiddenIps);
  }, [hiddenIps]);

  useEffect(() => {
    storeString(TRAFFIC_LIVE_DENSITY_KEY, density);
  }, [density]);

  const allProjectsSelected =
    availableProjectSlugs.length > 0 &&
    effectiveSelectedProjects.length === availableProjectSlugs.length;

  const streamItems = useMemo(() => {
    const sourceItems = data?.stream_items ?? [];
    const selectedProjectSet = new Set(effectiveSelectedProjects);
    const hiddenIpSet = new Set(hiddenIps);

    return sourceItems.filter((session) => {
      if (selectedProjectSet.size > 0 && !selectedProjectSet.has(session.project_slug)) {
        return false;
      }
      if (hiddenIpSet.has(session.ip)) {
        return false;
      }
      if (showOnlyGreenHumans && session.classification_state !== "human_confirmed") {
        return false;
      }
      return true;
    });
  }, [data?.stream_items, effectiveSelectedProjects, hiddenIps, showOnlyGreenHumans]);

  const newestFirstItems = useMemo(() => [...streamItems].reverse(), [streamItems]);
  const generatedAt = useMemo(
    () => parseTimestamp(data?.generated_at ?? new Date().toISOString()),
    [data?.generated_at],
  );
  const transport = useMemo(() => transportBadge(transportMode, pollMs), [pollMs, transportMode]);

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

  const toggleProject = (slug: string) => {
    setSelectedProjects((current) => {
      const currentSet = new Set(reconcileSelectedValues(current, availableProjectSlugs));
      if (currentSet.has(slug)) {
        currentSet.delete(slug);
      } else {
        currentSet.add(slug);
      }
      return reconcileSelectedValues([...currentSet], availableProjectSlugs);
    });
  };

  const hideIp = (ip: string) => {
    setHiddenIps((current) => (current.includes(ip) ? current : [...current, ip]));
  };

  const unhideIp = (ip: string) => {
    setHiddenIps((current) => current.filter((value) => value !== ip));
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">Realtime Visitor Stream</h2>
          <p className="max-w-3xl text-sm text-white/60">
            Chronological, not ranked. When the stream is healthy, new movement pushes in live at the
            top; if that pipe drops, Traffic falls back to timed refresh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`rounded-full border px-3 py-1 text-xs ${transport.className}`}>
            {transport.label}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
            Visible in stream: {streamItems.length}
          </div>
          <button
            type="button"
            onClick={jumpToNewest}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
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

      {transportNotice ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
          {transportNotice}
        </div>
      ) : null}

      <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Feed Controls</div>
            <div className="mt-1 text-sm text-white/65">
              {effectiveSelectedProjects.length || availableProjectSlugs.length} of {availableProjectSlugs.length || 0} projects visible
              {showOnlyGreenHumans ? " • green humans only" : " • mixed human-confidence feed"}
              {hiddenIps.length > 0 ? ` • ${hiddenIps.length} hidden IPs` : ""}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDensity("full")}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
                density === "full",
              )}`}
            >
              Long form
            </button>
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
                density === "compact",
              )}`}
            >
              Short form
            </button>
            <button
              type="button"
              onClick={() => setShowOnlyGreenHumans((current) => !current)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
                showOnlyGreenHumans,
              )}`}
            >
              Only green humans
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedProjects([...availableProjectSlugs])}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
              allProjectsSelected,
            )}`}
          >
            All projects
          </button>
          {availableProjects.map((project) => {
            const active = effectiveSelectedProjects.includes(project.slug);

            return (
              <button
                key={project.slug}
                type="button"
                onClick={() => toggleProject(project.slug)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
                  active,
                )}`}
              >
                {project.name}
              </button>
            );
          })}
        </div>

        {hiddenIps.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.22em] text-amber-200/80">Hidden IPs</div>
              <button
                type="button"
                onClick={() => setHiddenIps([])}
                className="cursor-pointer rounded-full border border-amber-400/30 bg-black/20 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-black/30"
              >
                Clear all
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {hiddenIps.map((ip) => (
                <button
                  key={ip}
                  type="button"
                  onClick={() => unhideIp(ip)}
                  className="cursor-pointer rounded-full border border-amber-400/30 bg-black/20 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-black/30"
                >
                  {ip} ×
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!error && streamItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          No sessions match the current live feed filters yet.
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
                        <LiveVisitorStreamRow
                          session={session}
                          density={density}
                          onHideIp={hideIp}
                        />
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
