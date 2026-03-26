export const dynamic = "force-dynamic";

import HomeOverviewScreen from "@/components/traffic/home-overview-screen";
import { fetchOverviewRange } from "@/components/traffic/api";
import type { OverviewResponse } from "@/components/traffic/types";

export default async function Home() {
  const overview: OverviewResponse | null = await fetchOverviewRange("24h").catch(() => null);

  if (!overview) {
    return (
      <main className="min-h-screen bg-[#06070a] px-4 py-8 text-slate-100 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-rose-200">Traffic observatory</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">API not reachable</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            The web shell loaded, but Traffic could not fetch overview data. The first thing to
            check is whether the FastAPI service is running and reachable from the web app.
          </p>
        </div>
      </main>
    );
  }

  return <HomeOverviewScreen initialOverview={overview} />;
}
