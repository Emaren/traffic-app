export const dynamic = "force-dynamic";

import HomeOverviewScreen from "@/components/traffic/home-overview-screen";
import { buildApiUrl } from "@/components/traffic/api";
import type { OverviewResponse } from "@/components/traffic/types";

async function loadInitialOverview(): Promise<OverviewResponse | null> {
  try {
    const response = await fetch(buildApiUrl("/api/overview?range_key=24h"), {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as OverviewResponse;
  } catch {
    return null;
  }
}

export default async function Home() {
  const initialOverview = await loadInitialOverview();
  return <HomeOverviewScreen initialOverview={initialOverview} />;
}