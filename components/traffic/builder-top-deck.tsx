"use client";

import { useEffect, useState } from "react";
import ProjectHumanGraphs from "@/components/traffic/project-human-graphs";
import LiveVisitorScreen from "@/components/traffic/live-visitor-screen";
import type { ProjectGraphRangeKey } from "@/components/traffic/types";
import {
  TRAFFIC_HOME_CHROME_OPEN_KEY,
  TRAFFIC_HOME_VIEW_KEY,
  loadStoredBoolean,
  loadStoredString,
  storeBoolean,
  storeString,
} from "@/components/traffic/view-preferences";

const DEFAULT_FEATURED_PROJECT_SLUG = "aoe2hdbets";
const DEFAULT_HOMEPAGE_VIEW = "view-a";

type HomepageView = "view-a" | "view-b";

function pillClass(active: boolean, tone: "amber" | "sky" | "emerald" = "amber") {
  const activeClass =
    tone === "sky"
      ? "border-sky-400/30 bg-sky-400/10 text-sky-100"
      : tone === "emerald"
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
        : "border-amber-400/30 bg-amber-400/10 text-amber-100";

  return active
    ? activeClass
    : "border-white/10 bg-black/20 text-white/65 hover:border-white/20 hover:text-white";
}

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
  const [showChrome, setShowChrome] = useState(() =>
    loadStoredBoolean(TRAFFIC_HOME_CHROME_OPEN_KEY, false),
  );

  useEffect(() => {
    storeString(TRAFFIC_HOME_VIEW_KEY, homepageView);
  }, [homepageView]);

  useEffect(() => {
    storeBoolean(TRAFFIC_HOME_CHROME_OPEN_KEY, showChrome);
  }, [showChrome]);

  return (
    <section className="mt-4">
      <div className="mb-3 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(6,7,10,0.9))] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.32)] sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200/75">
              Layout rail
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Graph first, live rows next
            </h2>
            {showChrome ? (
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
                Keep this rail open when tuning layout. Hide it for lean mode so the featured graph
                sits tight above Happening Now.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={homepageView === "view-a"}
              onClick={() => setHomepageView("view-a")}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${pillClass(
                homepageView === "view-a",
                "amber",
              )}`}
            >
              View A · stacked
            </button>

            <button
              type="button"
              aria-pressed={homepageView === "view-b"}
              onClick={() => setHomepageView("view-b")}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${pillClass(
                homepageView === "view-b",
                "sky",
              )}`}
            >
              View B · split
            </button>

            <button
              type="button"
              aria-pressed={!showChrome}
              onClick={() => setShowChrome((current) => !current)}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${pillClass(
                !showChrome,
                "emerald",
              )}`}
            >
              {showChrome ? "Lean mode" : "Show layout notes"}
            </button>
          </div>
        </div>

        {showChrome ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
              Live now: {uniqueLivePeople}
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
              Featured project defaults to AoE2 War
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
              {homepageView === "view-a"
                ? "Stacked graph above live movement"
                : "Legacy graph-plus-stream split"}
            </div>
          </div>
        ) : null}
      </div>

      {homepageView === "view-a" ? (
        <div className="space-y-3">
          <ProjectHumanGraphs
            key={`stacked-${historyRangeKey}`}
            layout="stacked"
            pollMs={180000}
            uniqueLivePeople={uniqueLivePeople}
            initialRangeKey={historyRangeKey}
            selectedProjectSlug={featuredProjectSlug}
            onSelectProject={setFeaturedProjectSlug}
          />

          <LiveVisitorScreen
            pollMs={120000}
            mode="default"
            focusedProjectSlug={featuredProjectSlug}
          />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
          <ProjectHumanGraphs
            key={`combined-${historyRangeKey}`}
            pollMs={180000}
            uniqueLivePeople={uniqueLivePeople}
            initialRangeKey={historyRangeKey}
            selectedProjectSlug={featuredProjectSlug}
            onSelectProject={setFeaturedProjectSlug}
          />

          <div className="xl:sticky xl:top-6">
            <LiveVisitorScreen
              pollMs={120000}
              mode="hero"
              focusedProjectSlug={featuredProjectSlug}
            />
          </div>
        </div>
      )}
    </section>
  );
}
