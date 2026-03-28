import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PwaRegistration from "@/components/traffic/pwa-registration";
import "./globals.css";

const SITE_URL = "https://traffic.tokentap.ca";
const TITLE = "Traffic Observatory";
const DESCRIPTION =
  "Realtime visitor intelligence, analytics clarity, and threat-aware traffic reporting.";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TITLE,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Traffic",
  },
  icons: {
    apple: "/icons/traffic-180.png",
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/traffic-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/traffic-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Traffic Observatory social card",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/twitter-image"],
  },
};

export const viewport: Viewport = {
  themeColor: "#06070a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
