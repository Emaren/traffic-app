import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Traffic Admin",
  description: "Operator cockpit for Traffic notifications and native web push.",
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Traffic Admin",
  },
};

export default function TrafficAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
