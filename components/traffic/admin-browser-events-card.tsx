"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrowserEventRecord, BrowserEventsResponse } from "@/components/traffic/types";
import {
  TRAFFIC_ADMIN_BEHAVIOR_FULL_KEY,
  loadStoredBoolean,
  storeBoolean,
} from "@/components/traffic/view-preferences";

type VisitorJourney = {
  key: string;
  latest: BrowserEventRecord;
  oldest: BrowserEventRecord;
  events: BrowserEventRecord[];
  paths: Set<string>;
  maxScroll: number;
  clicks: number;
  visibleMs: number;
};

function countryFlag(countryCode?: string): string {
  const code = (countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🌍";
  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatShortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatMs(value: number | null | undefined): string {
  if (!value) return "—";
  if (value < 1000) return `${value}ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function shortSession(value?: string): string {
  const v = (value || "").trim();
  return v ? v.slice(0, 18) : "—";
}

function displayIp(ip?: string): string {
  return (ip || "").trim() || "unknown IP";
}

function locationLine(event: BrowserEventRecord): string {
  return [event.city, event.area, event.country].filter(Boolean).join(", ");
}

function visitorName(event: BrowserEventRecord): string {
  if (event.known_visitor_label) return event.known_visitor_label;
  if (event.city) return `${event.city} visitor`;
  if (event.country) return `${event.country} visitor`;
  return "Unknown visitor";
}

function identityLine(event: BrowserEventRecord): string {
  const parts = [displayIp(event.ip)];
  if (event.known_visitor_detail) parts.push(event.known_visitor_detail);
  return parts.join(" · ");
}

function eventTone(eventType: string): string {
  if (eventType.includes("click")) return "border-cyan-300/35 bg-cyan-300/12 text-cyan-100";
  if (eventType === "scroll_milestone") return "border-emerald-300/35 bg-emerald-300/12 text-emerald-100";
  if (eventType === "heartbeat") return "border-violet-300/35 bg-violet-300/12 text-violet-100";
  if (eventType === "page_view") return "border-white/15 bg-white/10 text-white";
  return "border-amber-300/35 bg-amber-300/12 text-amber-100";
}

function prettyEventType(eventType: string): string {
  if (eventType === "page_view") return "opened";
  if (eventType === "scroll_milestone") return "scrolled";
  if (eventType === "heartbeat") return "still active";
  if (eventType === "visibility_change") return "tab changed";
  if (eventType === "page_hide") return "left page";
  if (eventType === "outbound_click") return "outbound click";
  return eventType.replace(/_/g, " ");
}

function readableEvent(event: BrowserEventRecord): string {
  if (event.click_label) return event.click_label;
  if (event.event_type === "scroll_milestone") {
    return `Scrolled to ${event.max_scroll_depth_pct ?? event.scroll_depth_pct ?? "?"}%`;
  }
  if (event.event_type === "heartbeat") return "Still reading";
  if (event.event_type === "visibility_change") return "Switched tab / returned";
  if (event.event_type === "page_hide") return "Left the page";
  return event.title || event.path;
}

function actionSentence(event: BrowserEventRecord): string {
  if (event.event_type.includes("click")) return `clicked ${readableEvent(event)}`;
  if (event.event_type === "scroll_milestone") return readableEvent(event).toLowerCase();
  if (event.event_type === "heartbeat") return `is still active on ${event.path}`;
  if (event.event_type === "page_view") return `opened ${event.path}`;
  if (event.event_type === "visibility_change") return "changed browser visibility";
  return readableEvent(event);
}

function buildJourneys(events: BrowserEventRecord[]): VisitorJourney[] {
  const groups = new Map<string, VisitorJourney>();

  for (const event of events) {
    const key = event.session_id || event.visitor_id || event.ip || `event-${event.id}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        latest: event,
        oldest: event,
        events: [event],
        paths: new Set(event.path ? [event.path] : []),
        maxScroll: Number(event.max_scroll_depth_pct || event.scroll_depth_pct || 0),
        clicks: event.event_type.includes("click") ? 1 : 0,
        visibleMs: Number(event.visible_ms || 0),
      });
      continue;
    }

    existing.events.push(event);
    existing.oldest = event;
    if (event.path) existing.paths.add(event.path);
    existing.maxScroll = Math.max(
      existing.maxScroll,
      Number(event.max_scroll_depth_pct || event.scroll_depth_pct || 0),
    );
    existing.visibleMs = Math.max(existing.visibleMs, Number(event.visible_ms || 0));
    if (event.event_type.includes("click")) existing.clicks += 1;
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.latest.received_at).getTime() - new Date(a.latest.received_at).getTime(),
  );
}

function bestAction(journey: VisitorJourney): BrowserEventRecord {
  return (
    journey.events.find((event) => event.event_type.includes("click")) ||
    journey.events.find((event) => event.event_type === "page_view") ||
    journey.events.find((event) => event.event_type === "scroll_milestone") ||
    journey.latest
  );
}

export default function AdminBrowserEventsCard() {
  const [data, setData] = useState<BrowserEventsResponse | null>(null);
  const [events, setEvents] = useState<BrowserEventRecord[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFull, setShowFull] = useState(false);

  async function loadEvents(options?: { quiet?: boolean; append?: boolean; before?: string | null }) {
    const append = Boolean(options?.append);
    if (append) {
      setLoadingMore(true);
    } else if (!options?.quiet) {
      setBusy(true);
    }
    setError("");

    try {
      const search = new URLSearchParams({
        project_slug: "aoe2hdbets",
        since_hours: "24",
        limit: "80",
      });

      if (options?.before) {
        search.set("before_received_at", options.before);
      }

      const response = await fetch(
        `/admin-api/browser-events/recent?${search.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not load browser behavior events.");
      }

      const payload = (await response.json()) as BrowserEventsResponse;
      setData(payload);
      setNextBefore(payload.next_before_received_at ?? null);
      setHasMore(Boolean(payload.has_more));

      setEvents((current) => {
        const merged = append ? [...current, ...payload.events] : payload.events;
        const byId = new Map<number, BrowserEventRecord>();
        for (const event of merged) {
          byId.set(event.id, event);
        }
        return Array.from(byId.values()).sort(
          (left, right) =>
            new Date(right.received_at).getTime() - new Date(left.received_at).getTime() ||
            right.id - left.id,
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load browser behavior events.");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else if (!options?.quiet) {
        setBusy(false);
      }
    }
  }

  function loadMoreStories() {
    if (!nextBefore || loadingMore) return;
    void loadEvents({ append: true, before: nextBefore });
  }

  useEffect(() => {
    setShowFull(loadStoredBoolean(TRAFFIC_ADMIN_BEHAVIOR_FULL_KEY, false));
    void loadEvents();

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void loadEvents({ quiet: true });
    }, 15000);

    const onVisibility = () => {
      if (!document.hidden) void loadEvents({ quiet: true });
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    storeBoolean(TRAFFIC_ADMIN_BEHAVIOR_FULL_KEY, showFull);
  }, [showFull]);

  const journeys = useMemo(() => buildJourneys(events), [events]);
  const visibleJourneys = showFull ? journeys.slice(0, 30) : journeys.slice(0, 8);

  const stats = useMemo(() => {
    const clicks = events.filter((event) => event.event_type.includes("click")).length;
    const maxScroll = Math.max(
      0,
      ...events.map((event) => Number(event.max_scroll_depth_pct || event.scroll_depth_pct || 0)),
    );
    const named = journeys.filter((journey) => journey.latest.known_visitor_label).length;

    return { clicks, maxScroll, named };
  }, [events, journeys]);

  return (
    <section className="mt-6 flex max-h-[calc(100vh-6rem)] min-h-[40rem] flex-col overflow-hidden rounded-[38px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_30%),rgba(255,255,255,0.035)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:p-6">
      <div className="flex shrink-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">
            AoE2WAR visitor stories
          </p>
          <h2 className="mt-1 text-4xl font-semibold tracking-tight text-white">
            Who did what?
          </h2>
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-300">
            Big readable cards grouped by visitor session. Lazy-loads AoE2WAR behavior back through the previous 24 hours.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-black/25 px-5 py-2.5 text-sm font-medium text-white/70">
            {events.length} signals loaded · 24h window
          </span>
          <button
            type="button"
            onClick={() => setShowFull((current) => !current)}
            className={`w-fit cursor-pointer rounded-full border px-5 py-2.5 text-sm font-medium transition ${
              showFull
                ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 bg-black/25 text-white/75 hover:border-cyan-300/35 hover:text-white"
            }`}
          >
            {showFull ? "Lean stories" : "Show more stories"}
          </button>

          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={busy}
            className="w-fit cursor-pointer rounded-full border border-white/10 bg-black/25 px-5 py-2.5 text-sm font-medium text-white/85 transition hover:border-cyan-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Visitor stories", journeys.length],
          ["Known names", stats.named],
          ["Clicks", stats.clicks],
          ["Max scroll", `${stats.maxScroll}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 shrink-0 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {visibleJourneys.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-base text-slate-300">
            No browser behavior events yet. Visit AoE2WAR, scroll, click, then refresh.
          </div>
        ) : (
          visibleJourneys.map((journey) => {
            const latest = journey.latest;
            const chosenAction = bestAction(journey);
            const location = locationLine(latest);
            const paths = Array.from(journey.paths).slice(0, 4);

            return (
              <article
                key={journey.key}
                className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] shadow-[0_14px_50px_rgba(0,0,0,0.28)]"
              >
                <div className="grid gap-0 xl:grid-cols-[1fr_340px]">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.35),rgba(255,255,255,0.08)_38%,rgba(0,0,0,0.22))] text-6xl shadow-[0_18px_55px_rgba(255,255,255,0.12)]">
                        {countryFlag(latest.country_code)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${eventTone(chosenAction.event_type)}`}>
                            {prettyEventType(chosenAction.event_type)}
                          </span>
                          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                            scroll {journey.maxScroll}%
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                            {journey.events.length} signals
                          </span>
                          {journey.visibleMs ? (
                            <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-100">
                              visible {formatMs(journey.visibleMs)}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-4 break-words text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
                          {visitorName(latest)}
                        </h3>

                        <p className="mt-2 break-all font-mono text-lg font-semibold text-cyan-100">
                          {identityLine(latest)}
                        </p>

                        {location ? (
                          <p className="mt-1 text-base text-slate-300">
                            {location}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 rounded-[26px] border border-cyan-300/15 bg-cyan-300/[0.055] p-5">
                      <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/75">
                        Latest meaningful move
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {actionSentence(chosenAction)}
                      </p>
                      <p className="mt-2 break-all font-mono text-sm text-slate-300">
                        {chosenAction.path}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
                      <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          Route trail
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {paths.map((path) => (
                            <span
                              key={path}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-white/75"
                            >
                              {path}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          Quick read
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                          {journey.clicks > 0
                            ? `${visitorName(latest)} clicked ${journey.clicks} time${journey.clicks === 1 ? "" : "s"} and reached ${journey.maxScroll}% scroll depth.`
                            : `${visitorName(latest)} is browsing with ${journey.events.length} recent signal${journey.events.length === 1 ? "" : "s"}.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <aside className="border-t border-white/10 bg-black/25 p-5 xl:border-l xl:border-t-0">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                      Timeline
                    </p>

                    <div className="mt-4 space-y-3">
                      {journey.events.slice(0, 7).map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${eventTone(event.event_type)}`}>
                              {prettyEventType(event.event_type)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatShortTime(event.received_at)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {readableEvent(event)}
                          </p>
                          <p className="mt-1 break-all font-mono text-xs text-slate-500">
                            {event.path}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-slate-400">
                      <p className="text-white/85">{formatTimestamp(latest.received_at)}</p>
                      <p className="break-all">{displayIp(latest.ip)}</p>
                      <p>session {shortSession(latest.session_id)}</p>
                      <p>{latest.viewport_width || 0}×{latest.viewport_height || 0}</p>
                    </div>
                  </aside>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="mt-4 flex shrink-0 flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          {hasMore
            ? "More AoE2WAR visitor stories are available inside the previous 24 hours."
            : "You are caught up for the loaded 24-hour behavior window."}
        </p>
        <button
          type="button"
          onClick={loadMoreStories}
          disabled={!hasMore || loadingMore}
          className="w-full cursor-pointer rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35 sm:w-auto"
        >
          {loadingMore ? "Loading stories..." : hasMore ? "Load more stories" : "No more stories"}
        </button>
      </div>
    </section>
  );
}
