"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import type { SessionActivityItem, SessionRecord } from "@/components/traffic/types";

type Props = {
  session: SessionRecord;
  density?: "full" | "compact";
  onHideIp?: (ip: string) => void;
  onHidePath?: (path: string) => void;
  onHideProject?: (slug: string, name: string) => void;
};

type ActivityGroup = {
  path: string;
  routeKind: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
};

function formatSeconds(total: number): string {
  if (total <= 0) return "0s";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function verdictClass(state: string) {
  switch (state) {
    case "human_confirmed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "likely_human":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "candidate":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "script_burst":
      return "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200";
    case "suspicious":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function routeKindClass(routeKind: string, count: number) {
  if (routeKind === "page") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (routeKind === "probe") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  if (routeKind === "api" && count >= 3) {
    return "border-amber-400/25 bg-amber-400/8 text-amber-100";
  }
  if (routeKind === "api") {
    return "border-sky-400/25 bg-sky-400/8 text-sky-100";
  }
  return "border-white/10 bg-white/5 text-white/65";
}

function buildActivityGroups(activity: SessionActivityItem[]): ActivityGroup[] {
  const grouped = new Map<string, ActivityGroup>();

  for (const step of activity) {
    const key = `${step.route_kind}:${step.path}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.count += 1;
      existing.lastSeen = step.timestamp_alberta;
      continue;
    }

    grouped.set(key, {
      path: step.path,
      routeKind: step.route_kind,
      count: 1,
      firstSeen: step.timestamp_alberta,
      lastSeen: step.timestamp_alberta,
    });
  }

  return [...grouped.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return right.lastSeen.localeCompare(left.lastSeen);
  });
}

function buildActivitySummary(activity: SessionActivityItem[], groups: ActivityGroup[]) {
  const pageHits = activity.filter((step) => step.route_kind === "page").length;
  const apiHits = activity.filter((step) => step.route_kind === "api").length;
  const probeHits = activity.filter((step) => step.route_kind === "probe").length;
  const pollingHits = groups
    .filter((group) => group.routeKind === "api" && group.count >= 3)
    .reduce((sum, group) => sum + group.count, 0);

  return {
    pageHits,
    apiHits,
    probeHits,
    pollingHits,
    uniqueRoutes: groups.length,
  };
}

function SessionMetaCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="mt-2 space-y-1 text-sm text-white/80">{children}</div>
    </div>
  );
}

function VisitorSessionCard({
  session,
  density = "full",
  onHideIp,
  onHidePath,
  onHideProject,
}: Props) {
  const activity = useMemo(() => session.activity_sequence ?? [], [session.activity_sequence]);
  const groupedActivity = useMemo(() => buildActivityGroups(activity), [activity]);
  const activitySummary = useMemo(
    () => buildActivitySummary(activity, groupedActivity),
    [activity, groupedActivity],
  );
  const activityPreviewCount = density === "compact" ? 6 : 10;
  const activityPreview = groupedActivity.slice(0, activityPreviewCount);
  const rawPreviewCount = density === "compact" ? 30 : 80;

  return (
    <article className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
              {session.project_name}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 font-medium ${verdictClass(
                session.classification_state,
              )}`}
            >
              {session.verdict_label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
              Started {session.first_seen_alberta}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/60">
              Last move {session.last_seen_alberta}
            </span>
            {session.active_now ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-medium text-emerald-200">
                Active now
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-lg font-semibold text-white">{session.classification_summary}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Traffic is showing grouped activity first so repeated polling does not drown out the
            actual session story. Raw activity is still available below.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs lg:justify-end">
          <Link
            href={`/projects/${session.project_slug}`}
            className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-medium text-sky-200 transition hover:bg-sky-400/15"
          >
            Open {session.project_name}
          </Link>
          {onHideIp ? (
            <button
              type="button"
              onClick={() => onHideIp(session.ip)}
              className="cursor-pointer rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-medium text-amber-200 transition hover:bg-amber-400/15"
            >
              Hide IP
            </button>
          ) : null}
          {onHideProject ? (
            <button
              type="button"
              onClick={() => onHideProject(session.project_slug, session.project_name)}
              className="cursor-pointer rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-medium text-sky-200 transition hover:bg-sky-400/15"
            >
              Hide project
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SessionMetaCard label="Session Summary">
          <div>{session.page_count} pages in the human path</div>
          <div>{session.event_count} raw trackable events</div>
          <div>{formatSeconds(session.total_seconds)} total</div>
          <div>{formatSeconds(session.engaged_seconds)} engaged</div>
        </SessionMetaCard>

        <SessionMetaCard label="Context">
          <div>Referrer: {session.referrer || "direct"}</div>
          <div>Source: {session.source || "direct"}</div>
          <div>{session.city || "Unknown city"}{session.area ? `, ${session.area}` : ""}{session.country ? `, ${session.country}` : ""}</div>
          <div>{session.device} • {session.os} • {session.browser}</div>
        </SessionMetaCard>

        <SessionMetaCard label="Activity Lens">
          <div>{activitySummary.pageHits} page steps</div>
          <div>{activitySummary.apiHits} API hits</div>
          <div>{activitySummary.pollingHits} repeated API polls</div>
          <div>{activitySummary.uniqueRoutes} unique routes</div>
        </SessionMetaCard>

        <SessionMetaCard label="Project Truth">
          <div>Returned {session.times_returned_in_project} times on this project</div>
          <div>{session.total_project_visits} total project visits</div>
          <div>{session.attention_label} attention</div>
          <div>IP {session.ip}</div>
        </SessionMetaCard>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-[#05070c]/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Grouped Path Activity</div>
            <div className="mt-1 text-sm text-white/65">
              Repeated API groups are intentionally de-emphasized so the human path stays readable.
            </div>
          </div>
          {activitySummary.probeHits > 0 ? (
            <div className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-200">
              {activitySummary.probeHits} probe-style hits
            </div>
          ) : null}
        </div>

        {activityPreview.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activityPreview.map((group) => (
              <div
                key={`${session.session_id}-${group.routeKind}-${group.path}`}
                className={`rounded-full border px-3 py-1 text-xs ${routeKindClass(
                  group.routeKind,
                  group.count,
                )}`}
              >
                <span className="font-mono">{group.path}</span>
                <span className="ml-2 font-semibold">× {group.count}</span>
                {onHidePath ? (
                  <button
                    type="button"
                    onClick={() => onHidePath(group.path)}
                    className="ml-2 cursor-pointer rounded-full border border-current/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]"
                  >
                    Hide
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            No grouped activity is available for this session yet.
          </div>
        )}
      </div>

      <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <summary className="cursor-pointer list-none text-sm font-medium text-white [&::-webkit-details-marker]:hidden">
          Raw activity drawer
          <span className="ml-2 text-xs font-normal text-white/55">
            {activity.length} events, showing first {Math.min(activity.length, rawPreviewCount)}
          </span>
        </summary>

        <div className="mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-2">
          {activity.slice(0, rawPreviewCount).map((step) => (
            <div
              key={`${session.session_id}-${step.id}`}
              className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/45">
                <span>{step.timestamp_alberta}</span>
                <span className={`rounded-full border px-2 py-0.5 ${routeKindClass(step.route_kind, 1)}`}>
                  {step.route_kind}
                </span>
              </div>
              <div className="mt-2 break-all font-mono text-xs text-white/80">{step.path}</div>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}

export default memo(VisitorSessionCard);
