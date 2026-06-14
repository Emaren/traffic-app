"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrowserEventRecord, BrowserEventsResponse } from "@/components/traffic/types";
import {
  TRAFFIC_ADMIN_BEHAVIOR_FULL_KEY,
  loadStoredBoolean,
  storeBoolean,
} from "@/components/traffic/view-preferences";

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

function formatMs(value: number | null | undefined): string {
  if (!value) return "—";
  if (value < 1000) return `${value}ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function shortSession(value?: string): string {
  const v = (value || "").trim();
  return v ? v.slice(0, 14) : "—";
}

function shortIp(ip?: string): string {
  return (ip || "").trim() || "unknown IP";
}

function locationLine(event: BrowserEventRecord): string {
  return [event.city, event.area, event.country].filter(Boolean).join(", ");
}

function eventTone(eventType: string): string {
  if (eventType.includes("click")) return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
  if (eventType === "scroll_milestone") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (eventType === "heartbeat") return "border-violet-300/30 bg-violet-300/10 text-violet-100";
  if (eventType === "page_view") return "border-white/15 bg-white/10 text-white";
  return "border-amber-300/30 bg-amber-300/10 text-amber-100";
}

function prettyEventType(eventType: string): string {
  if (eventType === "page_view") return "Page view";
  if (eventType === "scroll_milestone") return "Scrolled";
  if (eventType === "heartbeat") return "Still active";
  if (eventType === "visibility_change") return "Visibility changed";
  if (eventType === "page_hide") return "Exited page";
  if (eventType === "outbound_click") return "Outbound click";
  return eventType.replace(/_/g, " ");
}

function readableEvent(event: BrowserEventRecord): string {
  if (event.click_label) return event.click_label;
  if (event.event_type === "scroll_milestone") {
    return `Scrolled to ${event.max_scroll_depth_pct ?? event.scroll_depth_pct ?? "?"}%`;
  }
  if (event.event_type === "heartbeat") return "Visitor is still active on the page";
  if (event.event_type === "visibility_change") return "Browser tab visibility changed";
  if (event.event_type === "page_hide") return "Visitor exited the page";
  return event.title || event.path;
}

function heroName(event: BrowserEventRecord): string {
  return (
    event.known_visitor_label ||
    event.click_label ||
    shortIp(event.ip)
  );
}

function subIdentityLine(event: BrowserEventRecord): string {
  const parts = [];
  if (event.known_visitor_label) {
    parts.push(shortIp(event.ip));
    if (event.known_visitor_detail) parts.push(event.known_visitor_detail);
  } else {
    parts.push(shortIp(event.ip));
  }
  return parts.join(" · ");
}

export default function AdminBrowserEventsCard() {
  const [data, setData] = useState<BrowserEventsResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFull, setShowFull] = useState(false);

  async function loadEvents(options?: { quiet?: boolean }) {
    if (!options?.quiet) setBusy(true);
    setError("");

    try {
      const response = await fetch(
        "/admin-api/browser-events/recent?project_slug=aoe2hdbets&limit=100",
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not load browser behavior events.");
      }
      setData((await response.json()) as BrowserEventsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load browser behavior events.");
    } finally {
      if (!options?.quiet) setBusy(false);
    }
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

  const events = data?.events ?? [];
  const visibleEvents = showFull ? events.slice(0, 80) : events.slice(0, 12);

  const stats = useMemo(() => {
    const clicks = events.filter((event) => event.event_type.includes("click")).length;
    const pageViews = events.filter((event) => event.event_type === "page_view").length;
    const maxScroll = Math.max(
      0,
      ...events.map((event) => Number(event.max_scroll_depth_pct || event.scroll_depth_pct || 0)),
    );
    return { clicks, pageViews, maxScroll };
  }, [events]);

  return (
    <section className="mt-6 flex max-h-[calc(100vh-7rem)] min-h-[38rem] flex-col overflow-hidden rounded-[36px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),rgba(255,255,255,0.035)] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.35)] sm:p-6">
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">
            AoE2WAR behavior feed
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">
            Scrolls, clicks, heartbeats
          </h2>
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-300">
            Big, human-friendly readout: who this is, where they are, and what they just did.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowFull((current) => !current)}
            className={`w-fit cursor-pointer rounded-full border px-5 py-2.5 text-sm font-medium transition ${
              showFull
                ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 bg-black/25 text-white/75 hover:border-cyan-300/35 hover:text-white"
            }`}
          >
            {showFull ? "Lean list" : "Show more"}
          </button>

          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={busy}
            className="w-fit cursor-pointer rounded-full border border-white/10 bg-black/25 px-5 py-2.5 text-sm font-medium text-white/85 transition hover:border-cyan-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Refreshing..." : "Refresh behavior"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Events", events.length],
          ["Page views", stats.pageViews],
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

      <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {visibleEvents.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-base text-slate-300">
            No browser behavior events yet. Visit AoE2WAR, scroll, click, then refresh.
          </div>
        ) : (
          visibleEvents.map((event) => (
            <article
              key={event.id}
              className="rounded-[28px] border border-white/10 bg-black/25 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.2)]"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-4xl shadow-[0_8px_30px_rgba(255,255,255,0.08)]">
                      {countryFlag(event.country_code)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${eventTone(event.event_type)}`}>
                          {prettyEventType(event.event_type)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                          scroll {event.max_scroll_depth_pct ?? event.scroll_depth_pct ?? 0}%
                        </span>
                        {event.visible_ms ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                            visible {formatMs(event.visible_ms)}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-3 break-words text-2xl font-semibold text-white">
                        {heroName(event)}
                      </h3>

                      <p className="mt-1 text-base font-medium text-cyan-100">
                        {subIdentityLine(event)}
                      </p>

                      {locationLine(event) ? (
                        <p className="mt-1 text-sm text-slate-400">
                          {locationLine(event)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                      What happened
                    </p>
                    <p className="mt-2 text-lg font-medium text-white">
                      {readableEvent(event)}
                    </p>
                    <p className="mt-2 break-all font-mono text-sm text-slate-400">
                      {event.path}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm leading-6 text-slate-400 xl:w-[260px] xl:text-right">
                  <p className="text-white/85">{formatTimestamp(event.received_at)}</p>
                  <p className="mt-1">
                    {event.country_code || "—"} · {shortIp(event.ip)}
                  </p>
                  <p>session {shortSession(event.session_id)}</p>
                  <p>{event.viewport_width || 0}×{event.viewport_height || 0}</p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
