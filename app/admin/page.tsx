export const dynamic = "force-dynamic";

import AdminLoginScreen from "@/components/traffic/admin-login-screen";
import AdminNotificationDashboard from "@/components/traffic/admin-notification-dashboard";
import {
  hasAdminSession,
  trafficAdminConfigured,
} from "@/lib/traffic-admin";

export default async function TrafficAdminPage() {
  if (!(await hasAdminSession())) {
    return <AdminLoginScreen configured={trafficAdminConfigured()} />;
  }

  return <AdminNotificationDashboard initialData={null} />;
}
