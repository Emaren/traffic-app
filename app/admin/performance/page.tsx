export const dynamic = "force-dynamic";

import AdminLoginScreen from "@/components/traffic/admin-login-screen";
import PerformanceCommand from "@/components/traffic/performance-command";
import { hasAdminSession, trafficAdminConfigured } from "@/lib/traffic-admin";

export default async function TrafficPerformancePage() {
  if (!(await hasAdminSession())) return <AdminLoginScreen configured={trafficAdminConfigured()} />;
  return <PerformanceCommand />;
}
