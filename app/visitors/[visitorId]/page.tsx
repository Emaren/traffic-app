export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { fetchVisitorProfile } from "@/components/traffic/api";
import VisitorProfileScreen from "@/components/traffic/visitor-profile-screen";

export default async function VisitorPage({
  params,
}: {
  params: Promise<{ visitorId: string }>;
}) {
  const { visitorId } = await params;
  let profile = await fetchVisitorProfile(visitorId, { rangeKey: "30d" }).catch(() => null);

  if (!profile?.ok) {
    profile = await fetchVisitorProfile(visitorId, { rangeKey: "all" }).catch(() => null);
  }

  if (!profile?.ok) {
    notFound();
  }

  return <VisitorProfileScreen initialProfile={profile} visitorId={visitorId} pollMs={15000} />;
}
