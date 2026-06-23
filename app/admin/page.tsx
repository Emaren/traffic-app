export const dynamic = "force-dynamic";

import AdminLoginScreen from "@/components/traffic/admin-login-screen";
import AdminNotificationDashboard from "@/components/traffic/admin-notification-dashboard";
import {
  fetchAdminNotificationDashboard,
  hasAdminSession,
  trafficAdminConfigured,
} from "@/lib/traffic-admin";

export default async function TrafficAdminPage() {
  if (!(await hasAdminSession())) {
    return <AdminLoginScreen configured={trafficAdminConfigured()} />;
  }

  const initialData = await fetchAdminNotificationDashboard().catch(() => null);
  return (
    <main className="min-h-[100svh] overflow-y-auto overscroll-y-contain touch-pan-y bg-slate-950 pb-24 [-webkit-overflow-scrolling:touch]">
      <AdminNotificationDashboard initialData={initialData} />
    </main>
  );
}
