export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProjectDetail } from "@/components/traffic/api";
import ProjectDeepDivePanel from "@/components/traffic/project-deep-dive-panel";
import ProjectLiveFeed from "@/components/traffic/project-live-feed";
import { withFlag } from "@/components/traffic/display";
import ProjectDetailGraph from "@/components/traffic/project-detail-graph";
import type { SessionRecord } from "@/components/traffic/types";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSeconds(value: number) {
  if (value < 60) return `${value}s`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

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

function SessionHighlightCard({
  session,
  tone,
}: {
  session: SessionRecord;
  tone: "human" | "suspicious";
}) {
  const accentClass =
    tone === "human"
      ? "border-emerald-400/20 bg-emerald-400/[0.05]"
      : "border-rose-400/20 bg-rose-400/[0.05]";
  const noiseHits = Math.max(session.event_count - session.page_count, 0);

  return (
    <div className={`rounded-2xl border p-4 ${accentClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium text-white">
            <Link
              href={`/visitors/${session.visitor_profile_id}`}
              className="transition hover:text-sky-200"
            >
              {withFlag(session.country_code, session.visitor_alias)}
            </Link>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {session.verdict_label} • {session.data_confidence_label} data confidence •{" "}
            {session.attention_label} attention
          </div>
          <div className="mt-2 text-sm text-slate-300">{session.classification_summary}</div>
        </div>

        <div className="text-xs text-slate-400 sm:text-right">
          <div>{session.last_seen_alberta}</div>
          <div className="mt-1">{formatSeconds(session.total_seconds)} total</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-white/75">
          IP {session.ip}
        </span>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-200">
          Pages {session.page_count}
        </span>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
          Events {session.event_count}
        </span>
        {noiseHits > 0 ? (
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-white/70">
            Background hits {noiseHits}
          </span>
        ) : null}
        <Link
          href={`/visitors/${session.visitor_profile_id}`}
          className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-400/15"
        >
          Open visitor profile
        </Link>
      </div>
    </div>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await fetchProjectDetail(slug, { includeDeep: false }).catch(() => null);

  if (!detail?.ok) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="rounded-[32px] border border-sky-500/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-sky-200/80">Project page</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {detail.project.name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Focused view for {detail.project.name}. This is the first real project-specific
                surface, with honest live and 24-hour visibility instead of vague ecosystem-wide blur.
              </p>
            </div>

            <div className="grid w-full gap-3 text-sm text-slate-300 lg:w-auto">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Window:</span>{" "}
                <span className="text-white">{detail.window_hours} hours</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Generated:</span>{" "}
                <span className="text-white">{formatTimestamp(detail.generated_at)}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Link
                  href="/"
                  className="text-sky-200 transition hover:text-sky-100"
                >
                  Back to observatory
                </Link>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Sessions"
            value={formatNumber(detail.project.sessions)}
            helper="Session truth matters more here than raw hit volume."
          />
          <StatCard
            label="Real Humans"
            value={formatNumber(detail.project.real_humans)}
            helper="Likely real people Traffic can defend in this window."
          />
          <StatCard
            label="Live Now"
            value={formatNumber(detail.project.live_now)}
            helper="Human-ish visitors still active right now on this project."
          />
          <StatCard
            label="Returning"
            value={formatNumber(detail.project.returning_visitors)}
            helper="Visitors seen more than once on this project in this window."
          />
          <StatCard
            label="Engaged"
            value={formatNumber(detail.project.engaged_sessions)}
            helper="Sessions with real dwell instead of one-off chatter."
          />
          <StatCard
            label="Raw Requests"
            value={formatNumber(detail.project.requests)}
            helper="Still available, but includes polling and API noise."
          />
          <StatCard
            label="Avg Session"
            value={formatSeconds(detail.project.avg_session_seconds)}
            helper="Average session duration across this project window."
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ProjectDetailGraph projectSlug={detail.project.slug} initialGraph={detail.graph} />

          <ProjectLiveFeed
            projectName={detail.project.name}
            projectSlug={detail.project.slug}
            initialItems={detail.live_feed}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Top Humans</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Strongest human sessions</h2>
            <p className="mt-2 text-sm text-slate-300">
              Prioritizing session quality over raw request count keeps AoE2-style polling from
              pretending to be user volume.
            </p>

            <div className="mt-5 space-y-3">
              {detail.top_humans.length > 0 ? (
                detail.top_humans.map((session) => (
                  <SessionHighlightCard
                    key={`human-${session.session_id}`}
                    session={session}
                    tone="human"
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                  No strong human sessions stood out in this project window yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Suspicious Watch</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Top suspicious sessions</h2>
            <p className="mt-2 text-sm text-slate-300">
              Suspicious and probe-like sessions are separated from human highlights so they stay
              visible without polluting the human story.
            </p>

            <div className="mt-5 space-y-3">
              {detail.top_suspicious_sessions.length > 0 ? (
                detail.top_suspicious_sessions.map((session) => (
                  <SessionHighlightCard
                    key={`suspicious-${session.session_id}`}
                    session={session}
                    tone="suspicious"
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                  No suspicious sessions are standing out on this project right now.
                </div>
              )}
            </div>
          </div>
        </section>

        <ProjectDeepDivePanel
          projectName={detail.project.name}
          projectSlug={detail.project.slug}
          windowHours={detail.window_hours}
        />
      </div>
    </main>
  );
}
