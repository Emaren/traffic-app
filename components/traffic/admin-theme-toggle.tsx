"use client";

import { useEffect, useState } from "react";

type TrafficTheme = "dark" | "white" | "sepia";

const THEME_KEY = "traffic.admin.theme";

const THEMES: Array<{
  key: TrafficTheme;
  label: string;
  className: string;
}> = [
  {
    key: "dark",
    label: "Dark",
    className: "bg-[#06070a] shadow-[inset_0_0_0_2px_rgba(34,211,238,0.45)]",
  },
  {
    key: "white",
    label: "White",
    className: "bg-[#f8fafc] shadow-[inset_0_0_0_2px_rgba(15,23,42,0.35)]",
  },
  {
    key: "sepia",
    label: "Sepia",
    className: "bg-[#c49a6c] shadow-[inset_0_0_0_2px_rgba(80,44,18,0.5)]",
  },
];

function applyTheme(theme: TrafficTheme) {
  document.documentElement.dataset.trafficTheme = theme;
}

export default function AdminThemeToggle() {
  const [theme, setTheme] = useState<TrafficTheme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as TrafficTheme | null;
    const next = stored === "white" || stored === "sepia" || stored === "dark" ? stored : "dark";
    setTheme(next);
    applyTheme(next);
  }, []);

  function choose(next: TrafficTheme) {
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return (
    <div className="traffic-theme-toggle-root fixed right-5 top-5 z-[80] flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      {THEMES.map((item) => (
        <button
          key={item.key}
          type="button"
          title={`${item.label} view`}
          aria-label={`${item.label} view`}
          onClick={() => choose(item.key)}
          className={`h-7 w-7 rounded-full border transition hover:scale-110 ${
            item.className
          } ${theme === item.key ? "border-cyan-200" : "border-white/25 opacity-75"}`}
        />
      ))}
    </div>
  );
}
