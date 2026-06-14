"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrowserEventRecord, BrowserEventsResponse } from "@/components/traffic/types";
import {
  TRAFFIC_ADMIN_BEHAVIOR_FULL_KEY,
  loadStoredBoolean,
  storeBoolean,
} from "@/components/traffic/view-preferences";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function countryFlag(countryCode?: string): string {
  const code = (countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

function locationLine(event: BrowserEventRecord): string {
  return [event.city, event.area, event.country].filter(Boolean).join(", ");
}

function shortIp(ip: string): string {
  return ip || "unknown IP";
}

function formatMs(value: number | null | undefined): string {
  if (!value) return "—";
  if (value < 1000) return `${value}ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function eventTone(eventType: string): string {
  if (eventType.includes("click")) return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  if (eventType === "scroll_milestone") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (eventType === "heartbeat") return "border-violet-300/25 bg-violet-300/10 text-violet-100";
  if (eventType === "page_view") return "border-white/15 bg-white/10 text-white";
  return "border-amber-300/25 bg-amber-300/10 text-amber-100";
}

function readableEvent(event: BrowserEventRecord): string {
  if (event.click_label) return event.click_label;
  if (event.event_type === "scroll_milestone") {
    return `Scrolled to ${event.max_scroll_depth_pct ?? event.scroll_depth_pct ?? "?"}%`;
  }
  if (event.event_type === "heartbeat") return "Still active";
  if (event.event_type === "visibility_change") return "Visibility changed";
  if (event.event_type === "page_hide") return "Exited page";
  return event.title || event.path;
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
    <section className="mt-6 flex max-h-[calc(100vh-7rem)] min-h-[34rem] flex-col overflow-hidden rounded-[32px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),rgba(255,255,255,0.035)] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.35)] sm:p-5">
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/80">
            AoE2WAR behavior feed
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Scrolls, clicks, heartbeats
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Viewport-fit cockpit panel. The card stays contained while behavior events scroll inside it.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowFull((current) => !current)}
            className={`w-fit cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition ${
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
            className="w-fit cursor-pointer rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-cyan-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Refreshing..." : "Refresh behavior"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Events", events.length],
          ["Page views", stats.pageViews],
          ["Clicks", stats.clicks],
          ["Max scroll", `${stats.maxScroll}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 shrink-0 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {visibleEvents.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
            No browser behavior events yet. Visit AoE2WAR, scroll, click, then refresh.
          </div>
        ) : (
          visibleEvents.map((event) => (
            <article
              key={event.id}
              className="rounded-2xl border border-white/10 bg-black/25 p-3"
            >
              <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${eventTone(event.event_type)}`}>
                      {event.event_type}
                    </span>
                    <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[10px] font-semibold text-sky-100">
                      {(countryFlag(event.country_code) ? `${countryFlag(event.country_code)} ` : "") + shortIp(event.ip)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/65">
                      scroll {event.max_scroll_depth_pct ?? event.scroll_depth_pct ?? 0}%
                    </span>
                    {event.visible_ms ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/65">
                        visible {formatMs(event.visible_ms)}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-2 break-words text-sm font-semibold text-white">
                    {readableEvent(event)}
                  </h3>
                  <p className="mt-1 break-all font-mono text-xs text-slate-400">
                    {event.path}
                  </p>
                  {locationLine(event) ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {locationLine(event)}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 text-left text-[10px] leading-4 text-slate-500 xl:text-right">
                  <p>{formatTimestamp(event.received_at)}</p>
                  <p>{(countryFlag(event.country_code) ? `${countryFlag(event.country_code)} ` : "")}{event.country_code || "—"} · {shortIp(event.ip)}</p>
                  <p>session {event.session_id.slice(0, 14) || "—"}</p>
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
