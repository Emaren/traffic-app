"use client";

import { useEffect, useState } from "react";
import ProjectHumanGraphs from "@/components/traffic/project-human-graphs";
import LiveVisitorScreen from "@/components/traffic/live-visitor-screen";
import type { ProjectGraphRangeKey } from "@/components/traffic/types";
import {
  TRAFFIC_HOME_VIEW_KEY,
  loadStoredString,
  storeString,
} from "@/components/traffic/view-preferences";

const DEFAULT_FEATURED_PROJECT_SLUG = "aoe2hdbets";
const DEFAULT_HOMEPAGE_VIEW = "view-a";

type HomepageView = "view-a" | "view-b";

export default function BuilderTopDeck({
  uniqueLivePeople,
  historyRangeKey = "7d",
}: {
  uniqueLivePeople: number;
  historyRangeKey?: ProjectGraphRangeKey;
}) {
  const [featuredProjectSlug, setFeaturedProjectSlug] = useState(DEFAULT_FEATURED_PROJECT_SLUG);
  const [homepageView, setHomepageView] = useState<HomepageView>(() =>
    loadStoredString(TRAFFIC_HOME_VIEW_KEY) === "view-b" ? "view-b" : DEFAULT_HOMEPAGE_VIEW,
  );

  useEffect(() => {
    storeString(TRAFFIC_HOME_VIEW_KEY, homepageView);
  }, [homepageView]);

  return (
    <section className="mt-6">
      <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(6,7,10,0.94))] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.38)] md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">
              Homepage Views
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Separate the pulse, the focus, and the live lane
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
              View A is the clean operator default: four mini project graphs first, one featured
              analytical surface next, then the full realtime visitor stream underneath. View B
              keeps the older split-screen composition close at hand.
            </p>
          </div>

          <div className="inline-flex rounded-[22px] border border-white/10 bg-black/25 p-1.5">
            <button
              type="button"
              aria-pressed={homepageView === "view-a"}
              onClick={() => setHomepageView("view-a")}
              className={`cursor-pointer rounded-[16px] px-4 py-2 text-left text-sm transition ${
                homepageView === "view-a"
                  ? "bg-amber-400/12 text-white shadow-[0_0_0_1px_rgba(251,191,36,0.22)]"
                  : "text-white/65 hover:text-white"
              }`}
            >
              <span className="block font-semibold">View A</span>
              <span className="block text-xs text-white/55">Default layout</span>
            </button>
            <button
              type="button"
              aria-pressed={homepageView === "view-b"}
              onClick={() => setHomepageView("view-b")}
              className={`cursor-pointer rounded-[16px] px-4 py-2 text-left text-sm transition ${
                homepageView === "view-b"
                  ? "bg-sky-400/12 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.22)]"
                  : "text-white/65 hover:text-white"
              }`}
            >
              <span className="block font-semibold">View B</span>
              <span className="block text-xs text-white/55">Legacy split</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
            Live now: {uniqueLivePeople}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
            Featured project defaults to AoE2HDBets
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
            {homepageView === "view-a"
              ? "View A keeps each analytical lane full width"
              : "View B keeps the older graph-plus-stream split"}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {homepageView === "view-a" ? (
          <div className="space-y-5">
            <ProjectHumanGraphs
              key={`stacked-${historyRangeKey}`}
              layout="stacked"
              pollMs={45000}
              uniqueLivePeople={uniqueLivePeople}
              initialRangeKey={historyRangeKey}
              selectedProjectSlug={featuredProjectSlug}
              onSelectProject={setFeaturedProjectSlug}
            />

            <LiveVisitorScreen
              pollMs={20000}
              mode="default"
              focusedProjectSlug={featuredProjectSlug}
            />
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
            <ProjectHumanGraphs
              key={`combined-${historyRangeKey}`}
              pollMs={45000}
              uniqueLivePeople={uniqueLivePeople}
              initialRangeKey={historyRangeKey}
              selectedProjectSlug={featuredProjectSlug}
              onSelectProject={setFeaturedProjectSlug}
            />

            <div className="xl:sticky xl:top-6">
              <LiveVisitorScreen
                pollMs={20000}
                mode="hero"
                focusedProjectSlug={featuredProjectSlug}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
