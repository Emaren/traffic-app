"use client";

import { useEffect, useRef, useState } from "react";

import AdminBrowserEventsCard from "@/components/traffic/admin-browser-events-card";

export default function AdminBrowserEventsLazy() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) return;

    const node = hostRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        setActive(true);
        observer.disconnect();
      },
      {
        rootMargin: "500px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [active]);

  return (
    <div ref={hostRef}>
      {active ? (
        <AdminBrowserEventsCard />
      ) : (
        <section className="mt-6 min-h-64 rounded-[34px] border border-cyan-300/15 bg-white/[0.025] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">
            AoE2WAR visitor stories
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">
            Who did what?
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Visitor stories load when this section approaches the viewport.
          </p>
        </section>
      )}
    </div>
  );
}
