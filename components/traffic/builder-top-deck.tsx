"use client";

import { useState } from "react";
import ProjectHumanGraphs from "@/components/traffic/project-human-graphs";
import LiveVisitorScreen from "@/components/traffic/live-visitor-screen";
import type { ProjectGraphRangeKey } from "@/components/traffic/types";

const DEFAULT_FEATURED_PROJECT_SLUG = "aoe2hdbets";

export default function BuilderTopDeck({
  uniqueLivePeople,
  historyRangeKey = "7d",
}: {
  uniqueLivePeople: number;
  historyRangeKey?: ProjectGraphRangeKey;
}) {
  const [featuredProjectSlug, setFeaturedProjectSlug] = useState(DEFAULT_FEATURED_PROJECT_SLUG);

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(6,7,10,0.92))] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.38)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
          Featured graph + live stream stay in one working lane
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
            Live now: {uniqueLivePeople}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
            Defaults to AoE2HDBets
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
        <ProjectHumanGraphs
          key={historyRangeKey}
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
    </section>
  );
}
