"use client";

import Link from "next/link";
import { withFlag } from "@/components/traffic/display";
import type { LiveProjectCount, SessionRecord } from "@/components/traffic/types";

type Props = {
  session: SessionRecord;
  projectCount?: LiveProjectCount;
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

function maskIp(ip: string): string {
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  }
  return ip;
}

function verdictClass(state: SessionRecord["classification_state"]) {
  switch (state) {
    case "human_confirmed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "likely_human":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "candidate":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "bot":
      return "border-violet-400/30 bg-violet-400/10 text-violet-200";
    case "suspicious":
      return "border-red-400/30 bg-red-400/10 text-red-200";
    default:
      return "border-white/15 bg-white/10 text-white/70";
  }
}

function dataConfidenceClass(label: string) {
  switch (label) {
    case "High":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "Good":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "Limited":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  }
}

function attentionClass(label: string) {
  switch (label) {
    case "Investigate":
      return "border-red-400/30 bg-red-400/10 text-red-200";
    case "High":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "Medium":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  }
}

export default function LiveVisitorTile({ session, projectCount }: Props) {
  const projectLiveNow = projectCount?.active_now ?? 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
              {session.project_name}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${verdictClass(
                session.classification_state,
              )}`}
            >
              {session.verdict_label}
            </span>
            {session.active_now ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                Active now
              </span>
            ) : (
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs font-semibold text-white/65">
                Idle {formatSeconds(session.idle_seconds)}
              </span>
            )}
            {session.returning_visitor ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                Returning visitor
              </span>
            ) : null}
          </div>

          <h3 className="text-2xl font-semibold text-white">
            {withFlag(session.country_code, session.visitor_alias)}
          </h3>
          <p className="mt-1 text-sm text-white/55">
            {session.city || "Unknown city"}
            {session.area ? `, ${session.area}` : ""}
            {session.country ? `, ${session.country}` : ""} • {session.device} • {session.os} •{" "}
            {session.browser}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            {session.classification_summary}
          </p>
        </div>

        <div className="grid min-w-[240px] grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/45">
              Human likelihood
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{session.human_confidence}%</div>
            <div className="mt-1 text-xs text-white/45">{session.verdict_label}</div>
          </div>

          <div
            className={`rounded-2xl border p-3 ${dataConfidenceClass(session.data_confidence_label)}`}
          >
            <div className="text-[11px] uppercase tracking-wide opacity-70">Data confidence</div>
            <div className="mt-2 text-2xl font-semibold">{session.data_confidence_label}</div>
            <div className="mt-1 text-xs opacity-70">{session.quality_score}/100 signal</div>
          </div>

          <div className={`rounded-2xl border p-3 ${attentionClass(session.attention_label)}`}>
            <div className="text-[11px] uppercase tracking-wide opacity-70">Attention</div>
            <div className="mt-2 text-2xl font-semibold">{session.attention_label}</div>
            <div className="mt-1 text-xs opacity-70">{session.attention_summary}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/45">Visits in window</div>
            <div className="mt-2 text-2xl font-semibold text-white">{session.visits_in_window}</div>
            <div className="mt-1 text-xs text-white/45">
              {session.project_visits_in_window} on this project • {projectLiveNow} live here now
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/projects/${session.project_slug}`}
          className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:bg-sky-400/15"
        >
          Open {session.project_name}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-white/45">Time</div>
          <div className="space-y-1 text-sm text-white/80">
            <div>First: {session.first_seen_alberta}</div>
            <div>Last page: {session.last_seen_alberta}</div>
            <div>Total: {formatSeconds(session.total_seconds)}</div>
            <div>Engaged: {formatSeconds(session.engaged_seconds)}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-white/45">Source</div>
          <div className="space-y-1 text-sm text-white/80">
            <div>Source: {session.source || "—"}</div>
            <div>Medium: {session.medium || "—"}</div>
            <div>Campaign: {session.campaign || "—"}</div>
            <div>Referrer: {session.referrer || "—"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-white/45">Journey</div>
          <div className="space-y-1 text-sm text-white/80">
            <div>Entry: {session.entry_page}</div>
            <div>Current: {session.current_page}</div>
            <div>Exit: {session.exit_page}</div>
            <div>
              Pages: {session.page_count} • Events: {session.event_count}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-white/45">Identity</div>
          <div className="space-y-1 text-sm text-white/80">
            <div>Projects visited: {session.projects_visited_in_window}</div>
            <div>Host: {session.host}</div>
            <div>IP: {maskIp(session.ip)}</div>
            <div>Route kind: {session.route_kind}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 text-xs uppercase tracking-wide text-white/45">Page sequence</div>
        <div className="flex flex-wrap gap-2">
          {session.page_sequence.map((page, index) => (
            <span
              key={`${session.session_id}-${page}-${index}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
            >
              {index + 1}. {page}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-white/45">Why Traffic thinks this</div>
        <div className="flex flex-wrap gap-2">
          {session.classification_reason_labels.map((reason) => (
            <span
              key={`${session.session_id}-${reason}`}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
