"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  buildProjectLiveFeedStreamUrl,
  fetchProjectLiveFeed,
} from "@/components/traffic/api";
import LiveVisitorStreamRow from "@/components/traffic/live-visitor-stream-row";
import VisibilityRulePanel from "@/components/traffic/visibility-rule-panel";
import {
  sessionHiddenByVisibilityRules,
  useTrafficVisibilityRules,
} from "@/components/traffic/visibility-client";
import type {
  LiveTransportMode,
  ProjectLiveFeedResponse,
  SessionRecord,
} from "@/components/traffic/types";
import {
  TRAFFIC_PROJECT_LIVE_DENSITY_KEY,
  TRAFFIC_PROJECT_LIVE_GREEN_ONLY_KEY,
  loadStoredBoolean,
  loadStoredString,
  storeBoolean,
  storeString,
} from "@/components/traffic/view-preferences";

type Props = {
  projectName: string;
  projectSlug: string;
  initialItems: SessionRecord[];
  pollMs?: number;
};

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

export default function ProjectLiveFeed({
  projectName,
  projectSlug,
  initialItems,
  pollMs = 15000,
}: Props) {
  const [items, setItems] = useState<SessionRecord[]>(initialItems);
  const [error, setError] = useState("");
  const [transportMode, setTransportMode] = useState<LiveTransportMode>("connecting");
  const [transportNotice, setTransportNotice] = useState("");
  const [showOnlyGreenHumans, setShowOnlyGreenHumans] = useState(() =>
    loadStoredBoolean(TRAFFIC_PROJECT_LIVE_GREEN_ONLY_KEY),
  );
  const [density, setDensity] = useState<"full" | "compact">(() =>
    loadStoredString(TRAFFIC_PROJECT_LIVE_DENSITY_KEY) === "compact" ? "compact" : "full",
  );
  const {
    supportsSharedRules,
    activeVisibilityRules,
    effectiveHiddenIps,
    localOnlyHiddenIps,
    upsertVisibilityRule,
    removeVisibilityRule,
    unhideIp,
  } = useTrafficVisibilityRules();

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;
    let pollingTimer: number | null = null;
    let pollingStarted = false;

    const load = async () => {
      try {
        const next = await fetchProjectLiveFeed(projectSlug, { limit: 10 });
        if (!mounted) return;

        startTransition(() => {
          setItems(next.live_feed);
          setError("");
        });
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load project visitor stream");
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
      eventSource = new EventSource(buildProjectLiveFeedStreamUrl(projectSlug, { limit: 10 }));

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
          const next = JSON.parse(event.data) as ProjectLiveFeedResponse;
          if (!next.ok) {
            setTransportNotice("This project has no live stream payload right now.");
            return;
          }

          startTransition(() => {
            setItems(next.live_feed);
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
  }, [pollMs, projectSlug]);

  useEffect(() => {
    storeBoolean(TRAFFIC_PROJECT_LIVE_GREEN_ONLY_KEY, showOnlyGreenHumans);
  }, [showOnlyGreenHumans]);

  useEffect(() => {
    storeString(TRAFFIC_PROJECT_LIVE_DENSITY_KEY, density);
  }, [density]);

  const transport = useMemo(() => transportBadge(transportMode, pollMs), [pollMs, transportMode]);
  const visibleItems = useMemo(
    () =>
      items.filter((session) => {
        if (showOnlyGreenHumans && session.classification_state !== "human_confirmed") {
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
        return true;
      }),
    [activeVisibilityRules, effectiveHiddenIps, items, showOnlyGreenHumans],
  );

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

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Realtime Visitor Stream</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Newest movement first on {projectName}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Chronological stream for this project only. When the stream is healthy, new activity
            pushes in live at the top; if it drops, Traffic falls back to refresh.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className={`rounded-full border px-3 py-1 font-medium ${transport.className}`}>
            {transport.label}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
            {visibleItems.length} visible
          </div>
        </div>
      </div>

      {transportNotice ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
          {transportNotice}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Project Feed Controls</div>
            <div className="mt-1 text-sm text-white/65">
              {showOnlyGreenHumans ? "Green humans only" : "Mixed human-confidence feed"}
              {effectiveHiddenIps.length > 0 ? ` • ${effectiveHiddenIps.length} hidden IPs` : ""}
              {activeVisibilityRules.length > 0 ? ` • ${activeVisibilityRules.length} shared hides` : ""}
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
      </div>

      <div className="mt-5 max-h-[980px] space-y-3 overflow-y-auto pr-2">
        {visibleItems.length > 0 ? (
          <AnimatePresence initial={false}>
            {visibleItems.map((session) => (
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
                  density={density}
                  onHideIp={hideIp}
                  onHidePath={supportsSharedRules ? hidePath : undefined}
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
