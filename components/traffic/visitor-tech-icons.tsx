import {
  FaApple,
  FaDesktop,
  FaLinux,
  FaMobileScreenButton,
  FaRobot,
  FaTabletScreenButton,
} from "react-icons/fa6";
import {
  SiAndroid,
  SiFirefoxbrowser,
  SiGooglechrome,
  SiMicrosoftedge,
  SiSafari,
  SiWindows11,
} from "react-icons/si";

type VisitorTechIconsProps = {
  device?: string;
  os?: string;
  browser?: string;
  compact?: boolean;
};

function normalized(value?: string) {
  return (value || "").trim().toLowerCase();
}

function iconShell(label: string, icon: React.ReactNode, compact = false) {
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
    return iconShell("Windows", <SiWindows11 />, compact);
  }
  if (value.includes("mac") || value.includes("ios")) {
    return iconShell(value.includes("ios") ? "iOS" : "macOS", <FaApple />, compact);
  }
  if (value.includes("android")) {
    return iconShell("Android", <SiAndroid />, compact);
  }
  if (value.includes("linux") || value.includes("ubuntu")) {
    return iconShell("Linux", <FaLinux />, compact);
  }

  return iconShell(os || "Unknown OS", <FaDesktop />, compact);
}

function browserIcon(browser?: string, compact = false) {
  const value = normalized(browser);

  if (value.includes("chrome") || value.includes("chromium")) {
    return iconShell("Chrome", <SiGooglechrome />, compact);
  }
  if (value.includes("safari")) {
    return iconShell("Safari", <SiSafari />, compact);
  }
  if (value.includes("edge")) {
    return iconShell("Edge", <SiMicrosoftedge />, compact);
  }
  if (value.includes("firefox")) {
    return iconShell("Firefox", <SiFirefoxbrowser />, compact);
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
