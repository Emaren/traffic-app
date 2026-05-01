"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  buildLiveVisitorsStreamUrl,
  fetchLiveVisitors,
} from "@/components/traffic/api";
import LiveVisitorStreamRow from "@/components/traffic/live-visitor-stream-row";
import VisibilityRulePanel from "@/components/traffic/visibility-rule-panel";
import {
  sessionHiddenByVisibilityRules,
  useTrafficVisibilityRules,
} from "@/components/traffic/visibility-client";
import type {
  LiveTransportMode,
  ProjectFilterOption,
  LiveVisitorsResponse,
  SessionRecord,
} from "@/components/traffic/types";
import {
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
  mode?: "default" | "hero";
  focusedProjectSlug?: string | null;
};

type StreamSection = {
  key: "archive" | "recent" | "live";
  title: string;
  description: string;
  badgeClass: string;
  items: SessionRecord[];
};

type AuxiliarySection = {
  key: "browser_scripts" | "automation" | "security";
  title: string;
  description: string;
  badgeClass: string;
  items: SessionRecord[];
};

const RECENT_WINDOW_MINUTES = 60;
const STREAM_LIMIT = 100;
const STREAM_HISTORY_LIMIT = 500;
const STREAM_WINDOW_HOURS = 168;
const STREAM_RETRY_MIN_MS = 30000;

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

function pageIsHidden() {
  return typeof document !== "undefined" && document.hidden;
}

function LiveVisitorScreenInner({
  pollMs = 15000,
  mode = "default",
  focusedProjectSlug = null,
}: Props) {
  const heroMode = mode === "hero";
  const [data, setData] = useState<LiveVisitorsResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [transportMode, setTransportMode] = useState<LiveTransportMode>("connecting");
  const [transportNotice, setTransportNotice] = useState("");
  const [pinnedToTop, setPinnedToTop] = useState(true);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [showOnlyGreenHumans, setShowOnlyGreenHumans] = useState(false);
  const [density, setDensity] = useState<"full" | "compact">("full");
  const [followFeaturedProject, setFollowFeaturedProject] = useState(Boolean(focusedProjectSlug));
  const {
    supportsSharedRules,
    activeVisibilityRules,
    effectiveHiddenIps,
    localOnlyHiddenIps,
    upsertVisibilityRule,
    removeVisibilityRule,
    unhideIp,
  } = useTrafficVisibilityRules();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToTopRef = useRef(true);

  useEffect(() => {
    setSelectedProjects(loadStoredStringArray(TRAFFIC_SHARED_PROJECT_FILTER_KEY));
    setShowOnlyGreenHumans(loadStoredBoolean(TRAFFIC_LIVE_GREEN_ONLY_KEY));
    setDensity(loadStoredString(TRAFFIC_LIVE_DENSITY_KEY) === "compact" ? "compact" : "full");
    setFollowFeaturedProject(Boolean(focusedProjectSlug));
  }, [focusedProjectSlug]);

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;
    let pollingTimer: number | null = null;
    let reconnectTimer: number | null = null;

    const clearPolling = () => {
      if (pollingTimer !== null) {
        window.clearInterval(pollingTimer);
        pollingTimer = null;
      }
    };

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const closeStream = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    const load = async () => {
      if (pageIsHidden()) return;

      try {
        const next = await fetchLiveVisitors(STREAM_LIMIT, STREAM_HISTORY_LIMIT, STREAM_WINDOW_HOURS);
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

    const connectStream = (notice = "") => {
      if (!mounted) return;

      if (typeof window === "undefined" || typeof window.EventSource === "undefined") {
        startPollingFallback(
          "Live stream is unavailable here, so Traffic is using refresh fallback.",
        );
        return;
      }

      closeStream();
      clearPolling();
      clearReconnect();

      setTransportMode("connecting");
      setTransportNotice(notice);

      try {
        const source = new EventSource(
          buildLiveVisitorsStreamUrl({
            limit: STREAM_LIMIT,
            historyLimit: STREAM_HISTORY_LIMIT,
            windowHours: STREAM_WINDOW_HOURS,
          }),
        );

        eventSource = source;

        source.onopen = () => {
          if (!mounted) return;
          setTransportMode("streaming");
          setTransportNotice("");
          setError("");
          clearPolling();
          clearReconnect();
        };

        source.onmessage = (event) => {
          if (!mounted) return;

          try {
            const next = JSON.parse(event.data) as LiveVisitorsResponse;
            if (!next.ok) {
              setTransportNotice(
                "The live stream is connected, but Traffic has no visible stream data right now.",
              );
              return;
            }

            startTransition(() => {
              setData(next);
              setTransportMode("streaming");
              setTransportNotice("");
              setError("");
            });
          } catch {
            closeStream();
            startPollingFallback(
              "The live stream got out of shape, so Traffic fell back to refresh.",
            );
          }
        };

        source.onerror = () => {
          closeStream();
          startPollingFallback("The live stream dropped, so Traffic fell back to refresh.");
        };
      } catch {
        startPollingFallback("Traffic could not open the live stream, so refresh fallback is active.");
      }
    };

    const scheduleReconnect = (notice: string) => {
      clearReconnect();
      reconnectTimer = window.setTimeout(() => {
        if (!mounted) return;
        connectStream(notice);
      }, Math.max(pollMs * 2, STREAM_RETRY_MIN_MS));
    };

    const startPollingFallback = (notice: string) => {
      if (!mounted) return;

      closeStream();
      clearPolling();

      setTransportMode("polling");
      setTransportNotice(notice);

      void load();

      pollingTimer = window.setInterval(() => {
        if (!pageIsHidden()) {
          void load();
        }
      }, pollMs);

      scheduleReconnect("Retrying live stream...");
    };

    connectStream();

    const handleVisibilityChange = () => {
      if (!mounted || pageIsHidden()) return;
      if (eventSource) return;
      connectStream("Reconnecting live stream...");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      closeStream();
      clearPolling();
      clearReconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
  const focusedProject = useMemo(
    () =>
      availableProjects.find((project) => project.slug === focusedProjectSlug) ?? null,
    [availableProjects, focusedProjectSlug],
  );
  const storedSelectedProjects = useMemo(
    () => reconcileSelectedValues(selectedProjects, availableProjectSlugs),
    [availableProjectSlugs, selectedProjects],
  );
  const effectiveSelectedProjects = useMemo(() => {
    if (
      followFeaturedProject &&
      focusedProjectSlug &&
      availableProjectSlugs.includes(focusedProjectSlug)
    ) {
      return [focusedProjectSlug];
    }
    return storedSelectedProjects;
  }, [
    availableProjectSlugs,
    followFeaturedProject,
    focusedProjectSlug,
    storedSelectedProjects,
  ]);

  useEffect(() => {
    if (availableProjectSlugs.length === 0) return;
    if (followFeaturedProject) return;
    storeStringArray(TRAFFIC_SHARED_PROJECT_FILTER_KEY, storedSelectedProjects);
  }, [availableProjectSlugs.length, followFeaturedProject, storedSelectedProjects]);

  useEffect(() => {
    storeBoolean(TRAFFIC_LIVE_GREEN_ONLY_KEY, showOnlyGreenHumans);
  }, [showOnlyGreenHumans]);

  useEffect(() => {
    storeString(TRAFFIC_LIVE_DENSITY_KEY, density);
  }, [density]);

  const allProjectsSelected =
    !followFeaturedProject &&
    availableProjectSlugs.length > 0 &&
    effectiveSelectedProjects.length === availableProjectSlugs.length;

  const streamItems = useMemo(() => {
    const sourceItems = data?.stream_items ?? [];
    const selectedProjectSet = new Set(effectiveSelectedProjects);

    return sourceItems.filter((session) => {
      if (selectedProjectSet.size > 0 && !selectedProjectSet.has(session.project_slug)) {
        return false;
      }
      if (
        sessionHiddenByVisibilityRules(
          session,
          activeVisibilityRules,
          effectiveHiddenIps,
        )
      ) {
        return false;
      }
      if (showOnlyGreenHumans && session.classification_state !== "human_confirmed") {
        return false;
      }
      return true;
    });
  }, [
    activeVisibilityRules,
    data?.stream_items,
    effectiveHiddenIps,
    effectiveSelectedProjects,
    showOnlyGreenHumans,
  ]);

  const browserScriptItems = useMemo(() => {
    if (showOnlyGreenHumans) {
      return [];
    }

    const selectedProjectSet = new Set(effectiveSelectedProjects);
    return (data?.browser_script_preview ?? []).filter((session) => {
      if (selectedProjectSet.size > 0 && !selectedProjectSet.has(session.project_slug)) {
        return false;
      }
      return !sessionHiddenByVisibilityRules(session, activeVisibilityRules, effectiveHiddenIps);
    });
  }, [
    activeVisibilityRules,
    data?.browser_script_preview,
    effectiveHiddenIps,
    effectiveSelectedProjects,
    showOnlyGreenHumans,
  ]);

  const automationItems = useMemo(() => {
    if (showOnlyGreenHumans) {
      return [];
    }

    const selectedProjectSet = new Set(effectiveSelectedProjects);
    return (data?.automation_preview ?? []).filter((session) => {
      if (selectedProjectSet.size > 0 && !selectedProjectSet.has(session.project_slug)) {
        return false;
      }
      return !sessionHiddenByVisibilityRules(session, activeVisibilityRules, effectiveHiddenIps);
    });
  }, [
    activeVisibilityRules,
    data?.automation_preview,
    effectiveHiddenIps,
    effectiveSelectedProjects,
    showOnlyGreenHumans,
  ]);

  const securityItems = useMemo(() => {
    if (showOnlyGreenHumans) {
      return [];
    }

    const selectedProjectSet = new Set(effectiveSelectedProjects);
    return (data?.security_preview ?? []).filter((session) => {
      if (selectedProjectSet.size > 0 && !selectedProjectSet.has(session.project_slug)) {
        return false;
      }
      return !sessionHiddenByVisibilityRules(session, activeVisibilityRules, effectiveHiddenIps);
    });
  }, [
    activeVisibilityRules,
    data?.security_preview,
    effectiveHiddenIps,
    effectiveSelectedProjects,
    showOnlyGreenHumans,
  ]);

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

  const auxiliarySections = useMemo<AuxiliarySection[]>(() => {
    const sectionRows: AuxiliarySection[] = [
      {
        key: "browser_scripts",
        title: "Browser Script Watch",
        description:
          "Browser-shaped sessions that look too thin or too patterned to trust as real people.",
        badgeClass: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
        items: browserScriptItems,
      },
      {
        key: "automation",
        title: "Known Automation",
        description:
          "Recognized crawlers, previews, and proxy fetches kept visible without polluting the people feed.",
        badgeClass: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
        items: automationItems,
      },
      {
        key: "security",
        title: "Security Watch",
        description:
          "Suspicious traffic worth inspection, clearly separated from known automation.",
        badgeClass: "border-rose-400/30 bg-rose-400/10 text-rose-200",
        items: securityItems,
      },
    ];

    return sectionRows.filter((section) => section.items.length > 0);
  }, [automationItems, browserScriptItems, securityItems]);

  const hasVisibleContent =
    streamItems.length > 0 || (!heroMode && auxiliarySections.length > 0);

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
    setFollowFeaturedProject(false);
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

  const hideIp = async (ip: string) => {
    await upsertVisibilityRule({
      rule_type: "ip",
      match_value: ip,
      label: ip,
    });
  };

  const hidePath = async (path: string) => {
    await upsertVisibilityRule({
      rule_type: "path",
      match_value: path,
      label: path,
    });
  };

  const hideProject = async (slug: string, name: string) => {
    await upsertVisibilityRule({
      rule_type: "project_slug",
      match_value: slug,
      label: name,
    });
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Realtime Visitor Stream</p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {heroMode ? "Newest rows stay beside the featured graph" : "Chronological visitor movement"}
          </h2>
          <p className="max-w-3xl text-sm text-white/60">
            {heroMode
              ? "Keep the spike and the top rows in the same viewport without pretending every row is equally trustworthy."
              : "Chronological, not ranked. Strict humans, likely humans, unclear sessions, browser scripts, and automation are separated so noisy browser traffic does not masquerade as people."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`rounded-full border px-3 py-1 text-xs ${transport.className}`}>
            {transport.label}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
            Visible people/unclear: {streamItems.length}
          </div>
          {!showOnlyGreenHumans && !heroMode && browserScriptItems.length > 0 ? (
            <div className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
              Browser scripts {browserScriptItems.length}
            </div>
          ) : null}
          {!showOnlyGreenHumans && !heroMode && automationItems.length > 0 ? (
            <div className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
              Automation {automationItems.length}
            </div>
          ) : null}
          {!showOnlyGreenHumans && !heroMode && securityItems.length > 0 ? (
            <div className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-200">
              Security {securityItems.length}
            </div>
          ) : null}
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

      <div className={`mb-3 rounded-2xl border border-white/10 bg-black/20 ${heroMode ? "p-3" : "p-4"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">
              {heroMode ? "Hero Feed Controls" : "Feed Controls"}
            </div>
            <div className="mt-1 text-sm text-white/65">
              {effectiveSelectedProjects.length || availableProjectSlugs.length} of {availableProjectSlugs.length || 0} projects visible
              {showOnlyGreenHumans ? " • confirmed humans only" : " • mixed-confidence people feed"}
              {!showOnlyGreenHumans && !heroMode && browserScriptItems.length > 0
                ? ` • ${browserScriptItems.length} browser scripts separated`
                : ""}
              {!showOnlyGreenHumans && !heroMode && automationItems.length > 0
                ? ` • ${automationItems.length} known automation separated`
                : ""}
              {!showOnlyGreenHumans && !heroMode && securityItems.length > 0
                ? ` • ${securityItems.length} security watch`
                : ""}
              {followFeaturedProject && focusedProject ? ` • following ${focusedProject.name}` : ""}
              {effectiveHiddenIps.length > 0 ? ` • ${effectiveHiddenIps.length} hidden IPs` : ""}
              {activeVisibilityRules.length > 0 ? ` • ${activeVisibilityRules.length} shared hides` : ""}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {focusedProject ? (
              <button
                type="button"
                onClick={() => setFollowFeaturedProject((current) => !current)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
                  followFeaturedProject,
                )}`}
              >
                {followFeaturedProject ? `Following ${focusedProject.name}` : "Follow featured graph"}
              </button>
            ) : null}
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
              Confirmed humans only
            </button>
          </div>
        </div>

        <div className={`flex flex-wrap gap-2 ${heroMode ? "mt-3" : "mt-4"}`}>
          <button
            type="button"
            onClick={() => {
              setFollowFeaturedProject(false);
              setSelectedProjects([...availableProjectSlugs]);
            }}
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

        {!heroMode || activeVisibilityRules.length > 0 || localOnlyHiddenIps.length > 0 ? (
          <VisibilityRulePanel
            rules={activeVisibilityRules}
            localOnlyHiddenIps={localOnlyHiddenIps}
            onRemoveRule={(rule) => {
              void removeVisibilityRule(rule);
            }}
            onRemoveLocalIp={(ip) => {
              void unhideIp(ip);
            }}
          />
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!error && !hasVisibleContent ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          No sessions match the current live feed filters yet.
        </div>
      ) : null}

      {!error && hasVisibleContent && heroMode ? (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="max-h-[42rem] overflow-y-auto pr-2"
        >
          <div className="space-y-3 pb-3">
            <AnimatePresence initial={false}>
              {newestFirstItems.map((session) => (
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
                    density={density}
                    onHideIp={hideIp}
                    onHidePath={supportsSharedRules ? hidePath : undefined}
                    onHideProject={supportsSharedRules ? hideProject : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : null}

      {!error && hasVisibleContent && !heroMode ? (
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
                          onHidePath={supportsSharedRules ? hidePath : undefined}
                          onHideProject={supportsSharedRules ? hideProject : undefined}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}

            {auxiliarySections.map((section) => (
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
                          onHidePath={supportsSharedRules ? hidePath : undefined}
                          onHideProject={supportsSharedRules ? hideProject : undefined}
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

export default function LiveVisitorScreen(props: Parameters<typeof LiveVisitorScreenInner>[0]) {
  const [isClientMounted, setIsClientMounted] = useState(false);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  if (!isClientMounted) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-black/30 p-6 text-sm text-white/60">
        Loading live visitor stream…
      </section>
    );
  }

  return <LiveVisitorScreenInner {...props} />;
}
