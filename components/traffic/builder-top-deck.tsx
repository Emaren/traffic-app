"use client";

import Link from "next/link";
import ProjectHumanGraphs from "@/components/traffic/project-human-graphs";
import LiveVisitorScreen from "@/components/traffic/live-visitor-screen";

export default function BuilderTopDeck() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
          <div className="mb-3 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
            Builder mode
          </div>

          <h2 className="text-2xl font-semibold text-white">
            Live Human Intake Layer
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-white/60">
            This is the new Traffic layer we are building on top of the existing
            command center, not instead of it. Human graphs sit up top, the
            25-card live visitor tower sits below, and the legacy analytics
            surface continues underneath unchanged.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/visits"
              className="rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-400/15"
            >
              Open visits history
            </Link>

            <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200">
              Additive build only
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-white/45">
                New surface
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                Human visitor graphs
              </div>
              <div className="mt-1 text-sm text-white/55">
                Human-confirmed visitor flow by project.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-white/45">
                New surface
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                25-card live tower
              </div>
              <div className="mt-1 text-sm text-white/55">
                Thick dossiers for real humans, ranked by signal.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-white/45">
                Archive
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                Visits history page
              </div>
              <div className="mt-1 text-sm text-white/55">
                Older sessions roll off the tower into a searchable log.
              </div>
            </div>
          </div>
        </div>

        <ProjectHumanGraphs pollMs={30000} />
      </section>

      <LiveVisitorScreen pollMs={15000} />
    </div>
  );
}
