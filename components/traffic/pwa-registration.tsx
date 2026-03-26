"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/traffic-sw.js").catch(() => {
      // Keep the app resilient even if service worker registration fails.
    });
  }, []);

  return null;
}
