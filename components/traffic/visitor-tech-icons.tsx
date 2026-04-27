import type { ReactNode } from "react";
import {
  FaAndroid,
  FaApple,
  FaChrome,
  FaDesktop,
  FaEdge,
  FaFirefoxBrowser,
  FaLinux,
  FaMobileScreenButton,
  FaRobot,
  FaSafari,
  FaTabletScreenButton,
  FaWindows,
} from "react-icons/fa6";

type VisitorTechIconsProps = {
  device?: string;
  os?: string;
  browser?: string;
  compact?: boolean;
};

function normalized(value?: string) {
  return (value || "").trim().toLowerCase();
}

function iconShell(label: string, icon: ReactNode, compact = false) {
  return (
    <span
      title={label}
      aria-label={label}
      className={[
        "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        compact ? "h-6 w-6 text-[13px]" : "h-7 w-7 text-sm",
      ].join(" ")}
    >
      {icon}
    </span>
  );
}

function deviceIcon(device?: string, compact = false) {
  const value = normalized(device);

  if (value.includes("mobile") || value.includes("phone")) {
    return iconShell("Mobile", <FaMobileScreenButton />, compact);
  }
  if (value.includes("tablet") || value.includes("ipad")) {
    return iconShell("Tablet", <FaTabletScreenButton />, compact);
  }
  if (value.includes("bot") || value.includes("crawler") || value.includes("spider")) {
    return iconShell("Bot", <FaRobot />, compact);
  }

  return iconShell(device || "Desktop", <FaDesktop />, compact);
}

function osIcon(os?: string, compact = false) {
  const value = normalized(os);

  if (value.includes("win")) {
    return iconShell("Windows", <FaWindows />, compact);
  }
  if (value.includes("mac") || value.includes("ios")) {
    return iconShell(value.includes("ios") ? "iOS" : "macOS", <FaApple />, compact);
  }
  if (value.includes("android")) {
    return iconShell("Android", <FaAndroid />, compact);
  }
  if (value.includes("linux") || value.includes("ubuntu")) {
    return iconShell("Linux", <FaLinux />, compact);
  }

  return iconShell(os || "Unknown OS", <FaDesktop />, compact);
}

function browserIcon(browser?: string, compact = false) {
  const value = normalized(browser);

  if (value.includes("chrome") || value.includes("chromium")) {
    return iconShell("Chrome", <FaChrome />, compact);
  }
  if (value.includes("safari")) {
    return iconShell("Safari", <FaSafari />, compact);
  }
  if (value.includes("edge")) {
    return iconShell("Edge", <FaEdge />, compact);
  }
  if (value.includes("firefox")) {
    return iconShell("Firefox", <FaFirefoxBrowser />, compact);
  }

  return iconShell(browser || "Unknown browser", <FaDesktop />, compact);
}

export default function VisitorTechIcons({
  device,
  os,
  browser,
  compact = false,
}: VisitorTechIconsProps) {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      {deviceIcon(device, compact)}
      {osIcon(os, compact)}
      {browserIcon(browser, compact)}
    </span>
  );
}
