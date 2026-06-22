"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  buildLiveVisitorsStreamUrl,
  fetchLiveVisitors,
  fetchVisitsHistory,
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
  TRAFFIC_LIVE_SETUP_OPEN_KEY,
  TRAFFIC_LIVE_WINDOW_HOURS_KEY,
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
  key: "recent_page_review" | "app_activity" | "watcher_funnel" | "chain_signal" | "browser_scripts" | "automation" | "security";
  title: string;
  description: string;
  badgeClass: string;
  items: SessionRecord[];
};

const RECENT_WINDOW_MINUTES = 60;
const STREAM_LIMIT = 24;
const STREAM_HISTORY_LIMIT = 0;
type StreamWindowHours = 1 | 24;

const DEFAULT_STREAM_WINDOW_HOURS: StreamWindowHours = 24;
const STREAM_RETRY_MIN_MS = 30000;
const STREAM_WINDOW_OPTIONS: Array<{ value: StreamWindowHours; label: string; detail: string }> = [
  { value: 1, label: "1h", detail: "burst watch" },
  { value: 24, label: "24h", detail: "full day" },
];

function normalizeStreamWindowHours(value: string): StreamWindowHours {
  return value === "1" ? 1 : 24;
}
const OLDER_HUMAN_PAGE_SIZE = 25;
const OLDER_HUMAN_INITIAL_RANGE_KEY = "24h";
const OLDER_HUMAN_ARCHIVE_RANGE_KEY = "all";
const DEFAULT_FOCUS_PROJECT_SLUG = "aoe2hdbets";

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeProjectToken(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sessionProjectToken(session: SessionRecord): string {
  const raw = session as unknown as Record<string, unknown>;
  return normalizeProjectToken(
    raw.project_slug ?? raw.projectSlug ?? raw.project_key ?? raw.project ?? raw.project_name,
  );
}

function canonicalProjectSlug(value: string): string {
  return normalizeProjectToken(value) === "aoe2war" ? "aoe2hdbets" : value;
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

function sessionSearchText(session: SessionRecord) {
  return [
    session.ip,
    session.city,
    session.area,
    session.country,
    session.country_code,
    session.project_slug,
    session.project_name,
    session.entry_page,
    session.current_page,
    session.exit_page,
    session.verdict_label,
    session.classification_state,
    session.visitor_alias,
    ...(session.page_sequence || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}


function isPotentialAudienceSignal(item: SessionRecord): boolean {
  const state = item.classification_state;
  if (state === "likely_human") return true;

  if (state !== "candidate") return false;
  if (item.route_kind && item.route_kind !== "page") return false;
  if ((item.suspicious_score ?? 0) > 0) return false;

  const pageCount = item.page_count ?? 0;
  const eventCount = item.event_count ?? 0;
  const engagedSeconds = item.engaged_seconds ?? 0;
  const totalSeconds = item.total_seconds ?? 0;
  const reasons = item.classification_reasons ?? [];

  if (pageCount >= 3) return true;
  if (pageCount >= 2 && (engagedSeconds >= 5 || totalSeconds >= 5)) return true;
  if (eventCount >= 4 && !reasons.includes("bounce")) return true;

  return false;
}


function PotentialVisitorRow({
  session,
  children,
}: {
  session: SessionRecord;
  children: ReactNode;
}) {
  if (!isPotentialAudienceSignal(session)) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-[1.35rem] border border-sky-400/25 bg-sky-400/[0.035] p-1 shadow-[0_0_24px_rgba(56,189,248,0.08)]">
      <div className="mb-1 flex justify-end">
        <span className="rounded-full border border-sky-400/35 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
          Potential
        </span>
      </div>
      {children}
    </div>
  );
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
  const [streamWindowHours, setStreamWindowHours] = useState<StreamWindowHours>(DEFAULT_STREAM_WINDOW_HOURS);
  const [showFeedSetup, setShowFeedSetup] = useState(false);
  const [recentReviewQuery, setRecentReviewQuery] = useState("");
  const [olderHumanItems, setOlderHumanItems] = useState<SessionRecord[]>([]);
  const [olderHumanOffset, setOlderHumanOffset] = useState(0);
  const [olderHumanTotal, setOlderHumanTotal] = useState(0);
  const [olderHumanLoading, setOlderHumanLoading] = useState(false);
  const [olderHumanError, setOlderHumanError] = useState("");
  const [olderHumanArchiveMode, setOlderHumanArchiveMode] = useState(false);
  const [followFeaturedProject, setFollowFeaturedProject] = useState(true);
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
    const frame = window.requestAnimationFrame(() => {
      setSelectedProjects(loadStoredStringArray(TRAFFIC_SHARED_PROJECT_FILTER_KEY));
      setShowOnlyGreenHumans(loadStoredBoolean(TRAFFIC_LIVE_GREEN_ONLY_KEY));
      setDensity(loadStoredString(TRAFFIC_LIVE_DENSITY_KEY) === "compact" ? "compact" : "full");
      setStreamWindowHours(normalizeStreamWindowHours(loadStoredString(TRAFFIC_LIVE_WINDOW_HOURS_KEY)));
      setShowFeedSetup(loadStoredBoolean(TRAFFIC_LIVE_SETUP_OPEN_KEY, false));
      setFollowFeaturedProject(Boolean(focusedProjectSlug));
    });

    return () => window.cancelAnimationFrame(frame);
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
        const next = await fetchLiveVisitors(STREAM_LIMIT, STREAM_HISTORY_LIMIT, streamWindowHours);
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
            windowHours: streamWindowHours,
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
  }, [pollMs, streamWindowHours]);

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

  useEffect(() => {
    storeString(TRAFFIC_LIVE_WINDOW_HOURS_KEY, String(streamWindowHours));
  }, [streamWindowHours]);

  useEffect(() => {
    storeBoolean(TRAFFIC_LIVE_SETUP_OPEN_KEY, showFeedSetup);
  }, [showFeedSetup]);

  const allProjectsSelected =
    !followFeaturedProject &&
    availableProjectSlugs.length > 0 &&
    effectiveSelectedProjects.length === availableProjectSlugs.length;

  const olderHumanProjectFilter = useMemo(() => {
    if (followFeaturedProject) {
      return [canonicalProjectSlug(focusedProjectSlug || DEFAULT_FOCUS_PROJECT_SLUG)];
    }

    if (allProjectsSelected) return [];

    return effectiveSelectedProjects.length > 0
      ? effectiveSelectedProjects.map(canonicalProjectSlug)
      : [DEFAULT_FOCUS_PROJECT_SLUG];
  }, [allProjectsSelected, effectiveSelectedProjects, focusedProjectSlug, followFeaturedProject]);

  const olderHumanProjectSignature = olderHumanProjectFilter.join("|");
  const olderHumanProjectTokens = useMemo(() => {
    const tokens = new Set(olderHumanProjectFilter.map(normalizeProjectToken));

    // AoE2 War is the public brand; aoe2hdbets is the legacy canonical Traffic slug.
    if (tokens.has("aoe2hdbets")) tokens.add("aoe2war");
    if (tokens.has("aoe2war")) tokens.add("aoe2hdbets");

    return tokens;
  }, [olderHumanProjectFilter]);

  const loadOlderHumanTraffic = useCallback(
    async (reset = false) => {
      if (olderHumanLoading) return;

      const nextOffset = reset ? 0 : olderHumanOffset;
      setOlderHumanLoading(true);
      setOlderHumanError("");

      try {
        const next = await fetchVisitsHistory({
          limit: OLDER_HUMAN_PAGE_SIZE,
          offset: nextOffset,
          rangeKey: olderHumanArchiveMode
            ? OLDER_HUMAN_ARCHIVE_RANGE_KEY
            : OLDER_HUMAN_INITIAL_RANGE_KEY,
          classification: "human_visible",
          projects: olderHumanProjectFilter.length > 0 ? olderHumanProjectFilter : undefined,
        });

        startTransition(() => {
          setOlderHumanItems((current) => {
            const merged = reset ? [] : [...current];
            const seen = new Set(merged.map((session) => session.session_id));

            for (const session of next.items) {
              if (!seen.has(session.session_id)) {
                merged.push(session);
                seen.add(session.session_id);
              }
            }

            return merged;
          });
          setOlderHumanOffset(nextOffset + next.items.length);
          setOlderHumanTotal(next.total);
        });
      } catch (err) {
        setOlderHumanError(
          err instanceof Error ? err.message : "Failed to load older human traffic",
        );
      } finally {
        setOlderHumanLoading(false);
      }
    },
    [olderHumanArchiveMode, olderHumanLoading, olderHumanOffset, olderHumanProjectFilter],
  );

  useEffect(() => {
    if (heroMode) return;

    setOlderHumanItems([]);
    setOlderHumanOffset(0);
    setOlderHumanTotal(0);
    setOlderHumanError("");
    setOlderHumanArchiveMode(false);
    void loadOlderHumanTraffic(true);
    // The project signature intentionally resets history when the operator changes filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroMode, olderHumanProjectSignature]);

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
      if (olderHumanProjectTokens.size > 0 && !olderHumanProjectTokens.has(sessionProjectToken(session))) {
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


  const unlockOlderHumanArchive = useCallback(() => {
    setOlderHumanArchiveMode(true);
    setOlderHumanItems([]);
    setOlderHumanOffset(0);
    setOlderHumanTotal(0);
    setOlderHumanError("");
    void loadOlderHumanTraffic(true);
  }, [loadOlderHumanTraffic]);

  const olderHumanVisibleItems = useMemo(() => {
    const streamSessionIds = new Set(streamItems.map((session) => session.session_id));

    return olderHumanItems.filter((session) => {
      if (streamSessionIds.has(session.session_id)) {
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
      if (olderHumanProjectTokens.size > 0 && !olderHumanProjectTokens.has(sessionProjectToken(session))) {
        return false;
      }
      if (showOnlyGreenHumans && session.classification_state !== "human_confirmed") {
        return false;
      }
      return true;
    });
  }, [
    activeVisibilityRules,
    effectiveHiddenIps,
    olderHumanItems,
    olderHumanProjectTokens,
    showOnlyGreenHumans,
    streamItems,
  ]);

  const olderHumanHasMore = olderHumanOffset < olderHumanTotal;

  const operatorTruthStats = useMemo(() => {
    const raw = (data ?? {}) as Record<string, unknown>;
    const numberFrom = (key: string, fallback = 0) => {
      const value = raw[key];
      return typeof value === "number" && Number.isFinite(value) ? value : fallback;
    };
    const arrayLengthFrom = (key: string) => {
      const value = raw[key];
      return Array.isArray(value) ? value.length : 0;
    };

    const projectCounts = data?.project_counts ?? [];
    const confirmedHumans = projectCounts.reduce(
      (total, project) => total + (project.human_confirmed ?? 0),
      0,
    );
    const likelyHumans = projectCounts.reduce(
      (total, project) => total + (project.likely_human ?? 0),
      0,
    );
    const unclearHumans = projectCounts.reduce(
      (total, project) => total + (project.candidate ?? 0),
      0,
    );

    return [
      {
        label: "Audience history",
        value: olderHumanProjectTokens.size > 0 ? olderHumanVisibleItems.length : olderHumanTotal,
        detail: olderHumanProjectTokens.size > 0 ? "visible focused humans" : "clean 24h humans",
        className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
      },
      {
        label: "Confirmed",
        value: confirmedHumans,
        detail: "high confidence",
        className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
      },
      {
        label: "Likely",
        value: likelyHumans,
        detail: "audience-grade",
        className: "border-sky-400/25 bg-sky-400/10 text-sky-100",
      },
      {
        label: "Unclear",
        value: unclearHumans,
        detail: "kept separate",
        className: "border-white/10 bg-white/5 text-white/70",
      },
      {
        label: "App activity",
        value: numberFrom("app_activity_count", arrayLengthFrom("app_activity_preview")),
        detail: "user-facing API",
        className: "border-violet-400/25 bg-violet-400/10 text-violet-100",
      },
      {
        label: "Watcher funnel",
        value: numberFrom("watcher_funnel_count", arrayLengthFrom("watcher_funnel_preview")),
        detail: "download/install",
        className: "border-amber-400/25 bg-amber-400/10 text-amber-100",
      },
      {
        label: "Chain signals",
        value: numberFrom("chain_signal_count", arrayLengthFrom("chain_signal_preview")),
        detail: "not audience",
        className: "border-amber-400/25 bg-amber-400/10 text-amber-100",
      },
      {
        label: "Crawler review",
        value: numberFrom("security_count", arrayLengthFrom("security_preview")),
        detail: "probe/watch",
        className: "border-rose-400/25 bg-rose-400/10 text-rose-100",
      },
    ];
  }, [data, olderHumanProjectTokens.size, olderHumanTotal, olderHumanVisibleItems.length]);

  const recentPageReviewItems = useMemo(() => {
    if (showOnlyGreenHumans) {
      return [];
    }

    const selectedProjectSet = new Set(effectiveSelectedProjects);
    const streamSessionIds = new Set(streamItems.map((session) => session.session_id));
    const query = recentReviewQuery.trim().toLowerCase();

    return (data?.recent_page_review ?? [])
      .filter((session) => {
        if (streamSessionIds.has(session.session_id)) {
          return false;
        }
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
        if (query && !sessionSearchText(session).includes(query)) {
          return false;
        }
        return true;
      })
      .slice(0, query ? 100 : 40);
  }, [
    activeVisibilityRules,
    data?.recent_page_review,
    effectiveHiddenIps,
    effectiveSelectedProjects,
    recentReviewQuery,
    showOnlyGreenHumans,
    streamItems,
  ]);


  const appActivityItems = useMemo(() => {
    if (showOnlyGreenHumans) {
      return [];
    }

    const selectedProjectSet = new Set(effectiveSelectedProjects);
    const streamSessionIds = new Set(streamItems.map((session) => session.session_id));

    return (data?.app_activity_preview ?? []).filter((session) => {
      if (streamSessionIds.has(session.session_id)) {
        return false;
      }
      if (selectedProjectSet.size > 0 && !selectedProjectSet.has(session.project_slug)) {
        return false;
      }
      return !sessionHiddenByVisibilityRules(session, activeVisibilityRules, effectiveHiddenIps);
    });
  }, [
    activeVisibilityRules,
    data?.app_activity_preview,
    effectiveHiddenIps,
    effectiveSelectedProjects,
    showOnlyGreenHumans,
    streamItems,
  ]);

  const watcherFunnelItems = useMemo(() => {
    if (showOnlyGreenHumans) {
      return [];
    }

    const selectedProjectSet = new Set(effectiveSelectedProjects);
    const streamSessionIds = new Set(streamItems.map((session) => session.session_id));

    return (data?.watcher_funnel_preview ?? []).filter((session) => {
      if (streamSessionIds.has(session.session_id)) {
        return false;
      }
      if (selectedProjectSet.size > 0 && !selectedProjectSet.has(session.project_slug)) {
        return false;
      }
      return !sessionHiddenByVisibilityRules(session, activeVisibilityRules, effectiveHiddenIps);
    });
  }, [
    activeVisibilityRules,
    data?.watcher_funnel_preview,
    effectiveHiddenIps,
    effectiveSelectedProjects,
    showOnlyGreenHumans,
    streamItems,
  ]);

  const chainSignalItems = useMemo(() => {
    if (showOnlyGreenHumans) {
      return [];
    }

    const selectedProjectSet = new Set(effectiveSelectedProjects);

    return (data?.chain_signal_preview ?? []).filter((session) => {
      if (selectedProjectSet.size > 0 && !selectedProjectSet.has(session.project_slug)) {
        return false;
      }
      return !sessionHiddenByVisibilityRules(session, activeVisibilityRules, effectiveHiddenIps);
    });
  }, [
    activeVisibilityRules,
    data?.chain_signal_preview,
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

  const newestFirstItems = useMemo(() => streamItems, [streamItems]);
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
        key: "app_activity",
        title: "App Activity Watch",
        description:
          "User-facing app/API activity promoted as real app movement when it is not chain polling.",
        badgeClass: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
        items: appActivityItems,
      },
      {
        key: "watcher_funnel",
        title: "Watcher Funnel",
        description:
          "Download page views, installer clicks, release artifact fetches, and watcher update checks kept visible for operator follow-through.",
        badgeClass: "border-amber-400/30 bg-amber-400/10 text-amber-200",
        items: watcherFunnelItems,
      },
      {
        key: "chain_signal",
        title: "Chain Signal Watch",
        description:
          "Validator, explorer, wallet, indexer, and node-client traffic separated from audience.",
        badgeClass: "border-sky-400/30 bg-sky-400/10 text-sky-200",
        items: chainSignalItems,
      },
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
        title: "Crawler Review",
        description:
          "Known bots and unverified page-walkers worth inspection, separated from real people.",
        badgeClass: "border-rose-400/30 bg-rose-400/10 text-rose-200",
        items: securityItems,
      },
    ];

    // Keep non-human review lanes below the human stream. Crawler review is useful,
    // but verified bots should not outrank people or likely people.
    return sectionRows.filter((section) => section.items.length > 0);
  }, [appActivityItems, automationItems, browserScriptItems, chainSignalItems, securityItems, watcherFunnelItems]);

  const hasVisibleContent =
    streamItems.length > 0 ||
    olderHumanVisibleItems.length > 0 ||
    olderHumanLoading ||
    (!heroMode && auxiliarySections.length > 0);

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
        {heroMode ? (
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Realtime Visitor Stream</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Newest rows stay beside the featured graph</h2>
            <p className="max-w-3xl text-sm text-white/60">
              Keep the spike and the top rows in the same viewport without pretending every row is equally trustworthy.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className={`rounded-full border px-3 py-1 text-xs ${transport.className}`}>
            {transport.label}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
            Visible people/unclear: {streamItems.length}
          </div>
          {!showOnlyGreenHumans && !heroMode && recentPageReviewItems.length > 0 ? (
            <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
              Recently seen review {recentPageReviewItems.length}
            </div>
          ) : null}

          {!showOnlyGreenHumans && !heroMode && watcherFunnelItems.length > 0 ? (
            <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
              Watcher funnel {watcherFunnelItems.length}
            </div>
          ) : null}
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
              Crawler review {securityItems.length}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setShowFeedSetup((current) => !current)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
              showFeedSetup,
            )}`}
          >
            {showFeedSetup ? "Hide setup" : "Show setup"}
          </button>
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

      {showFeedSetup && !heroMode ? (
        <div className="mb-4 rounded-3xl border border-white/10 bg-black/25 p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">
                Operator Truth
              </p>
              <h3 className="text-lg font-semibold text-white">
                Raw traffic is separated from audience traffic
              </h3>
            </div>
            <p className="max-w-xl text-xs text-white/50">
              Live stays light. Older human traffic lazy-loads below. Chain, automation, and security noise stay visible without pretending to be people.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-8">
            {operatorTruthStats.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-2xl border px-3 py-3 ${stat.className}`}
              >
                <div className="text-2xl font-semibold leading-none">
                  {stat.value.toLocaleString()}
                </div>
                <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] opacity-85">
                  {stat.label}
                </div>
                <div className="mt-1 text-xs opacity-60">{stat.detail}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {transportNotice ? (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
          {transportNotice}
        </div>
      ) : null}

      {showFeedSetup ? (
      <div className={`mb-3 rounded-2xl border border-white/10 bg-black/20 ${heroMode ? "p-3" : "p-4"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">
              {heroMode ? "Hero Feed Controls" : "Feed Controls"}
            </div>
            <div className="mt-1 text-sm text-white/65">
              {streamWindowHours}h window • {effectiveSelectedProjects.length || availableProjectSlugs.length} of {availableProjectSlugs.length || 0} projects visible
              {showOnlyGreenHumans ? " • confirmed humans only" : " • mixed-confidence people feed"}
              {!showOnlyGreenHumans && !heroMode && recentPageReviewItems.length > 0
                ? ` • ${recentPageReviewItems.length} recently seen review`
                : ""}
              {!showOnlyGreenHumans && !heroMode && browserScriptItems.length > 0
                ? ` • ${browserScriptItems.length} browser scripts separated`
                : ""}
              {!showOnlyGreenHumans && !heroMode && automationItems.length > 0
                ? ` • ${automationItems.length} known automation separated`
                : ""}
              {!showOnlyGreenHumans && !heroMode && securityItems.length > 0
                ? ` • ${securityItems.length} crawler review`
                : ""}
              {followFeaturedProject && focusedProject ? ` • following ${focusedProject.name}` : ""}
              {effectiveHiddenIps.length > 0 ? ` • ${effectiveHiddenIps.length} hidden IPs` : ""}
              {activeVisibilityRules.length > 0 ? ` • ${activeVisibilityRules.length} shared hides` : ""}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-1 py-1">
              {STREAM_WINDOW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStreamWindowHours(option.value)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
                    streamWindowHours === option.value,
                  )}`}
                  title={option.detail}
                >
                  {option.label}
                </button>
              ))}
            </div>
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

        {!showOnlyGreenHumans && !heroMode ? (
          <div className="mt-3">
            <label className="text-xs uppercase tracking-[0.22em] text-white/35">
              Find recently seen
            </label>
            <input
              value={recentReviewQuery}
              onChange={(event) => setRecentReviewQuery(event.target.value)}
              placeholder="Search recent review: Seoul, /staking, IP, country, verdict..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-400/40 focus:bg-black/45"
            />
          </div>
        ) : null}

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

      ) : null}

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
                  initial={{ opacity: 0, y: -18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  <PotentialVisitorRow session={session}>
                  <LiveVisitorStreamRow
                    session={session}
                    density={density}
                    onHideIp={hideIp}
                    onHidePath={supportsSharedRules ? hidePath : undefined}
                    onHideProject={supportsSharedRules ? hideProject : undefined}
                  />
                  </PotentialVisitorRow>
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
          className="max-h-[calc(100vh-16rem)] min-h-[28rem] overflow-y-auto pr-2"
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
                        initial={{ opacity: 0, y: -18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <PotentialVisitorRow session={session}>
                        <LiveVisitorStreamRow
                          session={session}
                          density={density}
                          onHideIp={hideIp}
                          onHidePath={supportsSharedRules ? hidePath : undefined}
                          onHideProject={supportsSharedRules ? hideProject : undefined}
                        />
                        </PotentialVisitorRow>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}

            {(olderHumanVisibleItems.length > 0 ||
              olderHumanLoading ||
              olderHumanError ||
              olderHumanTotal > 0) ? (
              <div>
                <div className="sticky top-0 z-10 mb-3 rounded-2xl border border-white/10 bg-[#090b11]/90 px-4 py-3 backdrop-blur">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-white">Older Human Traffic</h3>
                      <p className="text-xs text-white/50">
                        {olderHumanArchiveMode
                          ? "Lazy-loaded AoE2 War audience-grade visits from all stored history. Live rows stay fast; older people load on demand."
                          : "Showing recent AoE2 War audience-grade visits first. Open the archive to scroll back through stored history."}
                      </p>
                    </div>
                    <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                      {olderHumanVisibleItems.length} visible / {olderHumanTotal} total
                    </div>
                  </div>
                </div>

                {olderHumanError ? (
                  <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
                    {olderHumanError}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {olderHumanVisibleItems.map((session) => (
                      <motion.div
                        key={`older-human-${session.session_id}`}
                        initial={{ opacity: 0, y: -18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <PotentialVisitorRow session={session}>
                        <LiveVisitorStreamRow
                          session={session}
                          density={density}
                          onHideIp={hideIp}
                          onHidePath={supportsSharedRules ? hidePath : undefined}
                          onHideProject={supportsSharedRules ? hideProject : undefined}
                        />
                        </PotentialVisitorRow>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-white/55">
                    {olderHumanArchiveMode
                      ? olderHumanHasMore
                        ? "Load the next older AoE2 War archive batch without increasing the live stream payload."
                        : "No more audience-grade human visits in stored AoE2 War history."
                      : "Open the full AoE2 War archive when you want to scroll beyond the recent 24h window."}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      olderHumanArchiveMode
                        ? void loadOlderHumanTraffic(false)
                        : unlockOlderHumanArchive()
                    }
                    disabled={olderHumanLoading || (olderHumanArchiveMode && !olderHumanHasMore)}
                    className="cursor-pointer rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {olderHumanLoading
                      ? "Loading older humans…"
                      : olderHumanArchiveMode
                        ? "Load older human traffic"
                        : "Open full AoE2 War archive"}
                  </button>
                </div>
              </div>
            ) : null}

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
                        initial={{ opacity: 0, y: -18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <PotentialVisitorRow session={session}>
                        <LiveVisitorStreamRow
                          session={session}
                          density={density}
                          onHideIp={hideIp}
                          onHidePath={supportsSharedRules ? hidePath : undefined}
                          onHideProject={supportsSharedRules ? hideProject : undefined}
                        />
                        </PotentialVisitorRow>
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
    const timer = window.setTimeout(() => setIsClientMounted(true), 0);
    return () => window.clearTimeout(timer);
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
