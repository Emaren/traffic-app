import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Traffic Observatory",
    short_name: "Traffic",
    description:
      "Realtime visitor intelligence, analytics clarity, and threat-aware traffic reporting.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06070a",
    theme_color: "#06070a",
    categories: ["business", "productivity", "utilities"],
    shortcuts: [
      {
        name: "Admin cockpit",
        short_name: "Admin",
        description: "Open the Traffic notification cockpit.",
        url: "/admin",
        icons: [
          {
            src: "/icons/traffic-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
    icons: [
      {
        src: "/icons/traffic-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/traffic-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/traffic-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
