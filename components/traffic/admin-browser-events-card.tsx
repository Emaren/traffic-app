"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrowserEventRecord, BrowserEventsResponse } from "@/components/traffic/types";

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

  async function loadEvents(options?: { quiet?: boolean }) {
    if (!options?.quiet) setBusy(true);
    setError("");

    try {
      const response = await fetch(
        "/admin-api/browser-events/recent?project_slug=aoe2hdbets&limit=80",
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

  const events = data?.events ?? [];

  const stats = useMemo(() => {
    const clicks = events.filter((event) => event.event_type.includes("click")).length;
    const pageViews = events.filter((event) => event.event_type === "page_view").length;
    const maxScroll = Math.max(
      0,
      ...events.map((event) => Number(event.max_scroll_depth_pct || event.scroll_depth_pct || 0)),
    );
    const activeSessions = new Set(events.map((event) => event.session_id).filter(Boolean)).size;

    return { clicks, pageViews, maxScroll, activeSessions };
  }, [events]);

  return (
    <section className="mt-6 overflow-hidden rounded-[32px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),rgba(255,255,255,0.035)] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.35)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.26em] text-cyan-200/80">
            AoE2WAR behavior feed
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Scrolls, clicks, heartbeats
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            This is the new live signal: what real visitors actually touched, how deep they read,
            and whether they stayed active after landing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadEvents()}
          disabled={busy}
          className="w-fit cursor-pointer rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-cyan-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Refreshing..." : "Refresh behavior"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Events", events.length],
          ["Page views", stats.pageViews],
          ["Clicks", stats.clicks],
          ["Max scroll", `${stats.maxScroll}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {events.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
            No browser behavior events yet. Visit AoE2WAR, scroll, click, then refresh.
          </div>
        ) : (
          events.slice(0, 30).map((event) => (
            <article
              key={event.id}
              className="rounded-3xl border border-white/10 bg-black/25 p-4"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${eventTone(event.event_type)}`}>
                      {event.event_type}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                      {event.project_name}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                      scroll {event.max_scroll_depth_pct ?? event.scroll_depth_pct ?? 0}%
                    </span>
                    {event.visible_ms ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                        visible {formatMs(event.visible_ms)}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-3 break-words text-lg font-semibold text-white">
                    {readableEvent(event)}
                  </h3>
                  <p className="mt-1 break-all font-mono text-sm text-slate-300">
                    {event.path}
                  </p>

                  {event.click_href ? (
                    <p className="mt-2 break-all text-xs text-cyan-100/80">
                      href: {event.click_href}
                    </p>
                  ) : null}
                </div>

                <div className="text-left text-xs leading-5 text-slate-400 xl:text-right">
                  <p>{formatTimestamp(event.received_at)}</p>
                  <p>session {event.session_id.slice(0, 16) || "—"}</p>
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
