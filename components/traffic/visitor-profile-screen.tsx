"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  buildVisitorProfileStreamUrl,
  fetchVisitorProfile,
} from "@/components/traffic/api";
import { withFlag } from "@/components/traffic/display";
import LiveVisitorStreamRow from "@/components/traffic/live-visitor-stream-row";
import VisitorActivityReel from "@/components/traffic/visitor-activity-reel";
import VisibilityRulePanel from "@/components/traffic/visibility-rule-panel";
import {
  sessionHiddenByVisibilityRules,
  useTrafficVisibilityRules,
} from "@/components/traffic/visibility-client";
import type {
  HistoryRangeKey,
  LiveTransportMode,
  SessionRecord,
  VisitorProfileResponse,
} from "@/components/traffic/types";
import {
  TRAFFIC_SHARED_PROJECT_FILTER_KEY,
  TRAFFIC_VISITOR_PROFILE_DENSITY_KEY,
  TRAFFIC_VISITOR_PROFILE_GREEN_ONLY_KEY,
  loadStoredBoolean,
  loadStoredString,
  loadStoredStringArray,
  reconcileSelectedValues,
  storeBoolean,
  storeString,
  storeStringArray,
} from "@/components/traffic/view-preferences";

const RANGE_OPTIONS: Array<{ key: HistoryRangeKey; label: string }> = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "1 Week" },
  { key: "30d", label: "1 Month" },
  { key: "all", label: "All Time" },
];

type Props = {
  initialProfile: VisitorProfileResponse;
  pollMs?: number;
  visitorId: string;
};

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

function pickWatchedSession(sessions: SessionRecord[]) {
  return sessions.find((session) => session.active_now) ?? sessions[0] ?? null;
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

function rangeMissNotice(label: string) {
  return `Traffic has no ${label.toLowerCase()} history for this visitor yet, so the current snapshot stayed in place.`;
}

function pillClass(isActive: boolean) {
  return isActive
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : "border-white/10 bg-black/20 text-white/65 hover:border-white/20 hover:text-white";
}

export default function VisitorProfileScreen({
  initialProfile,
  pollMs = 5000,
  visitorId,
}: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState("");
  const [transportMode, setTransportMode] = useState<LiveTransportMode>("connecting");
  const [transportNotice, setTransportNotice] = useState("");
  const [pendingRange, setPendingRange] = useState<HistoryRangeKey | null>(null);
  const [showOnlyGreenHumans, setShowOnlyGreenHumans] = useState(() =>
    loadStoredBoolean(TRAFFIC_VISITOR_PROFILE_GREEN_ONLY_KEY),
  );
  const [density, setDensity] = useState<"full" | "compact">(() =>
    loadStoredString(TRAFFIC_VISITOR_PROFILE_DENSITY_KEY) === "compact" ? "compact" : "full",
  );
  const [selectedProjects, setSelectedProjects] = useState<string[]>(() =>
    loadStoredStringArray(TRAFFIC_SHARED_PROJECT_FILTER_KEY),
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
    setProfile(initialProfile);
    setPendingRange(null);
    setError("");
    setTransportNotice("");
    setTransportMode("connecting");
  }, [initialProfile, visitorId]);

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;
    let pollingTimer: number | null = null;
    let pollingStarted = false;

    const activeRangeKey = profile.range_key;

    const load = async () => {
      try {
        const next = await fetchVisitorProfile(visitorId, { rangeKey: activeRangeKey });
        if (!mounted) return;
        if (!next.ok) {
          setTransportNotice(rangeMissNotice(profile.range_label));
          return;
        }

        startTransition(() => {
          setProfile(next);
          setError("");
        });
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to refresh visitor profile");
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
        buildVisitorProfileStreamUrl(visitorId, { rangeKey: activeRangeKey }),
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
          const next = JSON.parse(event.data) as VisitorProfileResponse;
          if (!next.ok) {
            setTransportNotice(rangeMissNotice(profile.range_label));
            return;
          }

          startTransition(() => {
            setProfile(next);
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
  }, [pollMs, profile.range_key, profile.range_label, visitorId]);

  useEffect(() => {
    storeBoolean(TRAFFIC_VISITOR_PROFILE_GREEN_ONLY_KEY, showOnlyGreenHumans);
  }, [showOnlyGreenHumans]);

  useEffect(() => {
    storeString(TRAFFIC_VISITOR_PROFILE_DENSITY_KEY, density);
  }, [density]);

  const loadRange = async (rangeKey: HistoryRangeKey) => {
    if (rangeKey === profile.range_key || pendingRange) return;

    const rangeLabel = RANGE_OPTIONS.find((option) => option.key === rangeKey)?.label ?? rangeKey;
    setPendingRange(rangeKey);
    setError("");
    setTransportNotice("");

    try {
      const next = await fetchVisitorProfile(visitorId, { rangeKey });
      if (!next.ok) {
        setTransportNotice(rangeMissNotice(rangeLabel));
        return;
      }

      startTransition(() => {
        setProfile(next);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load this visitor range");
    } finally {
      setPendingRange(null);
    }
  };

  const availableProjectSlugs = useMemo(
    () => profile.projects.map((project) => project.slug),
    [profile.projects],
  );
  const effectiveSelectedProjects = useMemo(
    () => reconcileSelectedValues(selectedProjects, availableProjectSlugs),
    [availableProjectSlugs, selectedProjects],
  );
  const allProjectsSelected =
    availableProjectSlugs.length > 0 &&
    effectiveSelectedProjects.length === availableProjectSlugs.length;

  useEffect(() => {
    if (availableProjectSlugs.length === 0) return;
    storeStringArray(TRAFFIC_SHARED_PROJECT_FILTER_KEY, effectiveSelectedProjects);
  }, [availableProjectSlugs.length, effectiveSelectedProjects]);

  const visibleProjects = useMemo(
    () =>
      profile.projects.filter((project) => {
        if (effectiveSelectedProjects.length === 0) {
          return true;
        }
        return effectiveSelectedProjects.includes(project.slug);
      }),
    [effectiveSelectedProjects, profile.projects],
  );
  const visibleSessions = useMemo(
    () =>
      profile.sessions.filter((session) => {
        if (
          effectiveSelectedProjects.length > 0 &&
          !effectiveSelectedProjects.includes(session.project_slug)
        ) {
          return false;
        }
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
    [
      activeVisibilityRules,
      effectiveHiddenIps,
      effectiveSelectedProjects,
      profile.sessions,
      showOnlyGreenHumans,
    ],
  );

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

  const watchedSession = useMemo(
    () => pickWatchedSession(visibleSessions),
    [visibleSessions],
  );
  const transport = useMemo(() => transportBadge(transportMode, pollMs), [pollMs, transportMode]);
  const sessionCoverageLabel =
    profile.range_key === "all" ? "stored history" : `${profile.range_label.toLowerCase()} view`;
  const sessionSummary =
    profile.visitor.total_sessions > visibleSessions.length
      ? `Showing ${visibleSessions.length} visible sessions out of ${profile.visitor.total_sessions} stored in this range.`
      : "Newest session first. Expand a row to see the full stored path and why Traffic ties it to this visitor.";

  return (
    <main className="min-h-screen bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="rounded-[32px] border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/80">Visitor profile</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {withFlag(profile.visitor.country_code, profile.visitor.alias)}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                {profile.range_label} profile for this fingerprint. This page can still live-stream
                current movement when the visitor is active, but it now reaches back through the
                durable store instead of disappearing outside the day window.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-xs text-white/75">
                  IP {profile.visitor.ip}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
                  {profile.visitor.city || "Unknown city"}
                  {profile.visitor.area ? `, ${profile.visitor.area}` : ""}
                  {profile.visitor.country ? `, ${profile.visitor.country}` : ""}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
                  {profile.visitor.device} • {profile.visitor.os} • {profile.visitor.browser}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${transport.className}`}>
                  {transport.label}
                </span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  {profile.coverage_mode === "durable_store" ? "Durable history" : "Live log fallback"}
                </span>
                {profile.coverage_started_alberta ? (
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
                    Stored since {profile.coverage_started_alberta}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {RANGE_OPTIONS.map((option) => {
                  const isActive = profile.range_key === option.key;
                  const isPending = pendingRange === option.key;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => void loadRange(option.key)}
                      disabled={Boolean(pendingRange)}
                      className={`cursor-pointer rounded-full border px-3 py-1 font-medium transition disabled:cursor-not-allowed ${
                        isActive
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                          : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white"
                      } ${isPending ? "opacity-70" : ""}`}
                    >
                      {isPending ? `Loading ${option.label}` : option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid w-full gap-3 text-sm text-slate-300 lg:w-auto">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">First seen:</span>{" "}
                <span className="text-white">{profile.visitor.first_seen_alberta}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Last movement:</span>{" "}
                <span className="text-white">{profile.visitor.last_seen_alberta}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Link href="/" className="text-emerald-200 transition hover:text-emerald-100">
                  Back to observatory
                </Link>
              </div>
            </div>
          </div>
        </header>

        {profile.note ? (
          <div className="mt-4 break-words rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
            {profile.note}
          </div>
        ) : null}

        {transportNotice ? (
          <div className="mt-4 break-words rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            {transportNotice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            Live refresh hit a snag, so you are seeing the last good visitor snapshot: {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Sessions"
            value={String(profile.visitor.total_sessions)}
            helper={`Sessions tied to this visitor fingerprint in this ${sessionCoverageLabel}.`}
          />
          <StatCard
            label="Projects"
            value={String(profile.visitor.projects_visited)}
            helper="How many projects this visitor touched in the selected range."
          />
          <StatCard
            label="Status"
            value={profile.visitor.active_now ? "Active" : "Quiet"}
            helper="Whether at least one session from this visitor is active right now."
          />
          <StatCard
            label="Profile ID"
            value={profile.visitor.id.slice(0, 8)}
            helper="Stable visitor profile key used for this autogenerated visitor page."
          />
        </section>

        <div className="mt-6">
          <VisitorActivityReel
            key={`${profile.range_key}:${watchedSession?.session_id ?? "no-session"}`}
            session={watchedSession}
            pollMs={pollMs}
            transportMode={transportMode}
          />
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Projects</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Where this visitor showed up</h2>
            <p className="mt-2 text-sm text-slate-300">
              Project touches inside the selected {profile.range_label.toLowerCase()} range.
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/40">Project Filter</div>
                  <div className="mt-1 text-sm text-white/65">
                    {effectiveSelectedProjects.length || availableProjectSlugs.length} of {availableProjectSlugs.length} projects visible
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProjects([...availableProjectSlugs])}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
                      allProjectsSelected,
                    )}`}
                  >
                    All projects
                  </button>
                  {profile.projects.map((project) => (
                    <button
                      key={project.slug}
                      type="button"
                      onClick={() => toggleProject(project.slug)}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
                        effectiveSelectedProjects.includes(project.slug),
                      )}`}
                    >
                      {project.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {visibleProjects.map((project) => (
                <div
                  key={project.slug}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="break-words font-medium text-white">{project.name}</div>
                    <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
                      {project.visits} visits
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">Last seen {project.last_seen_at}</div>
                  <div className="mt-3">
                    <Link
                      href={`/projects/${project.slug}`}
                      className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/15"
                    >
                      Open {project.name}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Sessions</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Full session paths</h2>
            <p className="mt-2 text-sm text-slate-300">{sessionSummary}</p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/40">Session Controls</div>
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

            <div className="mt-5 space-y-3">
              {visibleSessions.length > 0 ? (
                visibleSessions.map((session) => (
                  <LiveVisitorStreamRow
                    key={session.session_id}
                    session={session}
                    showVisitorLink={false}
                    density={density}
                    onHideIp={hideIp}
                    onHidePath={supportsSharedRules ? hidePath : undefined}
                    onHideProject={supportsSharedRules ? hideProject : undefined}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                  No visitor sessions match the current project, verdict, and hide filters.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
