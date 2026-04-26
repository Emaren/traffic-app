"use client";

import Link from "next/link";
import { withFlag } from "@/components/traffic/display";
import type { SessionRecord } from "@/components/traffic/types";

type Props = {
  session: SessionRecord;
  showProjectBadge?: boolean;
  showProjectLink?: boolean;
  showVisitorLink?: boolean;
  density?: "full" | "compact";
  primaryTime?: "last_seen" | "first_seen";
  onHideIp?: (ip: string) => void;
  onHidePath?: (path: string) => void;
  onHideProject?: (slug: string, name: string) => void;
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
    case "browser_script":
    case "script_burst":
      return "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200";
    case "candidate":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function automationClass(session: SessionRecord): string {
  const state = session.classification_state as string;

  if (state === "script_burst") {
    return "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200";
  }
  if (state === "suspicious") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  if (session.known_automation) {
    return "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200";
  }
  if (state === "bot") {
    return "border-violet-400/30 bg-violet-400/10 text-violet-200";
  }
  return "border-white/10 bg-white/5 text-white/70";
}

function automationLabel(session: SessionRecord): string | null {
  const state = session.classification_state as string;

  if (state === "script_burst") {
    return "Script burst";
  }
  if (session.known_automation) {
    return session.automation_family || "Known automation";
  }
  if (state === "suspicious") {
    return "Security watch";
  }
  if (state === "bot") {
    return "Other bot";
  }
  return null;
}

export default function LiveVisitorStreamRow({
  session,
  showProjectBadge = true,
  showProjectLink = true,
  showVisitorLink = true,
  density = "full",
  primaryTime = "last_seen",
  onHideIp,
  onHidePath,
  onHideProject,
}: Props) {
  const burstSummary = session.is_burst_cluster
    ? `${session.burst_ip_count ?? 0} IPs · ${session.burst_path_count ?? session.page_count} routes · ${session.burst_window_seconds ?? session.total_seconds}s`
    : null;
  const journey =
    burstSummary ??
    (session.entry_page === session.current_page
      ? session.current_page
      : `${session.entry_page} -> ${session.current_page}`);
  const actionPath = session.current_page || session.exit_page || session.entry_page;

  const visitorLabel = withFlag(session.country_code, session.visitor_alias);
  const metaLine = session.geo_resolved
    ? `${session.city || "Unknown city"}${session.area ? `, ${session.area}` : ""}${
        session.country ? `, ${session.country}` : ""
      }`
    : "Unknown location";
  const automationPill = automationLabel(session);
  const primaryTimestamp =
    primaryTime === "first_seen"
      ? `Started ${session.first_seen_alberta}`
      : session.last_seen_alberta;
  const secondaryTimestamp =
    primaryTime === "first_seen" && session.last_seen_alberta !== session.first_seen_alberta
      ? `Last move ${session.last_seen_alberta}`
      : null;
  const warningChips = [
    !session.geo_resolved ? "Geo unresolved" : null,
    session.classification_reasons.includes("thin_direct_browser") ? "Thin direct session" : null,
    session.classification_reasons.includes("player_page_hop") ? "Player-page hop" : null,
    session.route_bundle_spam ? "Route bundle spam" : null,
    session.is_burst_cluster ? "Collapsed burst" : null,
  ].filter(Boolean) as string[];

  return (
    <details className="group rounded-2xl border border-white/10 bg-black/20 transition open:bg-black/30">
      <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
        {density === "compact" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-white/70">
                {primaryTimestamp}
              </span>
              {secondaryTimestamp ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-white/55">
                  {secondaryTimestamp}
                </span>
              ) : null}
              {showProjectBadge ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                  {session.project_name}
                </span>
              ) : null}
              <span
                className={`rounded-full border px-2.5 py-1 font-medium ${verdictClass(
                  session.classification_state,
                )}`}
              >
                {session.verdict_label}
              </span>
              {automationPill ? (
                <span
                  className={`rounded-full border px-2.5 py-1 font-medium ${automationClass(session)}`}
                >
                  {automationPill}
                </span>
              ) : null}
              {session.active_now ? (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-medium text-emerald-200">
                  Active now
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-white">{visitorLabel}</span>
              <span className="font-mono text-[11px] text-white/50">
                {session.is_burst_cluster ? `${session.burst_ip_count ?? 0} IPs collapsed` : session.ip}
              </span>
              <span className="text-white/50">{metaLine}</span>
              <span className="text-white/50">
                {session.device} • {session.browser}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/60">
              <span className="font-mono text-sky-100/70">{journey}</span>
              <span>{session.page_count} pages</span>
              <span>{session.event_count} events</span>
              <span>Returned {session.times_returned_in_project}</span>
              <span>Total visits {session.total_project_visits}</span>
            </div>

            {warningChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                {warningChips.map((chip) => (
                  <span
                    key={`${session.session_id}-${chip}`}
                    className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/60"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-white/70">
                  {primaryTimestamp}
                </span>
                {secondaryTimestamp ? (
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-white/55">
                    {secondaryTimestamp}
                  </span>
                ) : null}
                {showProjectBadge ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                    {session.project_name}
                  </span>
                ) : null}
                <span
                  className={`rounded-full border px-2.5 py-1 font-medium ${verdictClass(
                    session.classification_state,
                  )}`}
                >
                  {session.verdict_label}
                </span>
                {automationPill ? (
                  <span
                    className={`rounded-full border px-2.5 py-1 font-medium ${automationClass(session)}`}
                  >
                    {automationPill}
                  </span>
                ) : null}
                {session.active_now ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-medium text-emerald-200">
                    Active now
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-base font-semibold text-white">{visitorLabel}</span>
                <span className="font-mono text-xs text-white/55">
                  {session.is_burst_cluster ? `${session.burst_ip_count ?? 0} IPs collapsed` : `IP ${session.ip}`}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/55">
                <span>{metaLine}</span>
                <span>
                  {session.device} • {session.os} • {session.browser}
                </span>
              </div>

              <div className="mt-2 font-mono text-xs text-sky-100/70 break-all">
                {journey}
              </div>

              {warningChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/60">
                  {warningChips.map((chip) => (
                    <span
                      key={`${session.session_id}-${chip}`}
                      className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/60"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 text-xs lg:justify-end">
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-medium text-amber-200">
                Times Returned: {session.times_returned_in_project}
              </span>
              <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-medium text-sky-200">
                Total Project Visits: {session.total_project_visits}
              </span>
            </div>
          </div>
        )}
      </summary>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/45">Why</div>
            <div className="mt-2 text-sm text-white/80">{session.classification_summary}</div>
            {automationPill ? (
              <div
                className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${automationClass(
                  session,
                )}`}
              >
                {automationPill}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/45">Session</div>
            <div className="mt-2 space-y-1 text-sm text-white/80">
              <div>First seen: {session.first_seen_alberta}</div>
              <div>Last movement: {session.last_seen_alberta}</div>
              <div>Engaged: {formatSeconds(session.engaged_seconds)}</div>
              <div>Total: {formatSeconds(session.total_seconds)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/45">Context</div>
            <div className="mt-2 space-y-1 text-sm text-white/80">
              {session.is_burst_cluster ? (
                <div>Burst members: {session.burst_member_count ?? 0}</div>
              ) : (
                <div>Traffic visits: {session.visits_in_window}</div>
              )}
              <div>Projects visited: {session.projects_visited_in_window}</div>
              <div>Source: {session.source || "direct"}</div>
              <div>Referrer: {session.referrer || "direct"}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/45">Open</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {showProjectLink ? (
                <Link
                  href={`/projects/${session.project_slug}`}
                  className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:bg-sky-400/15"
                >
                  Open {session.project_name}
                </Link>
              ) : null}
              {showVisitorLink ? (
                <Link
                  href={`/visitors/${session.visitor_profile_id}`}
                  className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/15"
                >
                  Open visitor profile
                </Link>
              ) : null}
              {onHideIp ? (
                <button
                  type="button"
                  onClick={() => onHideIp(session.ip)}
                  className="cursor-pointer rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-400/15"
                >
                  Hide IP
                </button>
              ) : null}
              {onHidePath ? (
                <button
                  type="button"
                  onClick={() => onHidePath(actionPath)}
                  className="cursor-pointer rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-400/15"
                >
                  Hide path
                </button>
              ) : null}
              {onHideProject ? (
                <button
                  type="button"
                  onClick={() => onHideProject(session.project_slug, session.project_name)}
                  className="cursor-pointer rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:bg-sky-400/15"
                >
                  Hide project
                </button>
              ) : null}
            </div>
            {!showProjectLink ? <div className="mt-2 text-sm text-white/80">{session.project_name}</div> : null}
            <div className="mt-3 text-xs text-white/50">
              Route kind {session.route_kind} • {session.page_count} pages • {session.event_count} events
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-[11px] uppercase tracking-wide text-white/45">Full Path</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {session.page_sequence.map((page, index) => (
              <span
                key={`${session.session_id}-${page}-${index}`}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-[11px] text-white/70"
              >
                {index + 1}. {page}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {session.classification_reason_labels.slice(0, 5).map((reason) => (
            <span
              key={`${session.session_id}-${reason}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>
    </details>
  );
}
