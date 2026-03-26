export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProjectDetail } from "@/components/traffic/api";
import ProjectLiveFeed from "@/components/traffic/project-live-feed";
import { withFlag } from "@/components/traffic/display";
import ProjectDetailGraph from "@/components/traffic/project-detail-graph";

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

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await fetchProjectDetail(slug).catch(() => null);

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
            label="Requests"
            value={formatNumber(detail.project.requests)}
            helper="Every request Traffic kept for this project in the current window."
          />
          <StatCard
            label="Visitors"
            value={formatNumber(detail.project.unique_visitors)}
            helper="Distinct visitor fingerprints seen on this project."
          />
          <StatCard
            label="Real Humans"
            value={formatNumber(detail.project.real_humans)}
            helper="Visitors Traffic currently believes are probably real."
          />
          <StatCard
            label="Live Now"
            value={formatNumber(detail.project.live_now)}
            helper="Human-ish visitors still active right now."
          />
          <StatCard
            label="Returning"
            value={formatNumber(detail.project.returning_visitors)}
            helper="Visitors seen more than once on this project in this window."
          />
          <StatCard
            label="Avg Session"
            value={formatSeconds(detail.project.avg_session_seconds)}
            helper="Average session duration for this project."
          />
        </section>

        <div className="mt-6">
          <ProjectDetailGraph projectSlug={detail.project.slug} initialGraph={detail.graph} />
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <ProjectLiveFeed
            projectName={detail.project.name}
            projectSlug={detail.project.slug}
            initialItems={detail.live_feed}
          />

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Top Pages</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Where people went</h2>

              <div className="mt-5 space-y-3">
                {detail.top_pages.map((page) => (
                  <div
                    key={page.path}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="break-all font-mono text-sm text-white">{page.path}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      {formatNumber(page.views)} views • {formatNumber(page.entries)} entries •{" "}
                      {formatSeconds(page.avg_seconds)} avg
                    </div>
                    <div className="mt-2 break-all text-xs text-slate-400">
                      Next: {page.top_next_paths[0]?.path || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Hosts</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Project hosts</h2>

              <div className="mt-5 space-y-3">
                {detail.hosts.map((host) => (
                  <div
                    key={host.host}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="break-all font-medium text-white">{host.host}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      {formatNumber(host.requests)} requests • {formatNumber(host.unique_visitors)} visitors
                    </div>
                    <div className="mt-2 break-all text-xs text-slate-400">
                      Entry {host.top_entry_page} • Exit {host.top_exit_page}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Recent Sessions</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Recent named visitors</h2>

            <div className="mt-5 space-y-3">
              {detail.recent_sessions.map((session) => (
                <div
                  key={session.session_id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
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
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-white/75">
                          IP {session.ip}
                        </span>
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-200">
                          Times Returned: {session.times_returned_in_project}
                        </span>
                        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
                          Total Project Visits: {session.total_project_visits}
                        </span>
                        <Link
                          href={`/visitors/${session.visitor_profile_id}`}
                          className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-400/15"
                        >
                          Open visitor profile
                        </Link>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 sm:text-right">
                      Last movement {session.last_seen_alberta} • {formatSeconds(session.total_seconds)}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-slate-300">{session.classification_summary}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Geo Mix</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Top countries</h2>

              <div className="mt-5 space-y-3">
                {detail.geo.countries.map((row) => (
                  <div
                    key={row.country}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 break-words text-sm text-white">{row.country}</span>
                    <span className="text-sm font-semibold text-sky-300">
                      {formatNumber(row.sessions)} sessions
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Threat Surface</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Suspicious traffic</h2>

              <div className="mt-5 space-y-3">
                {detail.suspicious.top_paths.length > 0 ? (
                  detail.suspicious.top_paths.map((row) => (
                    <div
                      key={row.path}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3"
                    >
                      <span className="min-w-0 flex-1 break-all font-mono text-sm text-rose-100">
                        {row.path}
                      </span>
                      <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-semibold text-rose-200">
                        {formatNumber(row.count)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                    No notable suspicious paths in this project window.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
