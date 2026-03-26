"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  className?: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PwaInstallCard({ className = "" }: Props) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneMode());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIphoneLike = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <section
      className={`rounded-3xl border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.03))] p-5 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Traffic PWA</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Install Traffic on your phone</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Pushover will always open its own message first. The true one-tap path into Traffic
            comes from the installed Traffic web app and its own web-push lane.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
          {installed ? "Installed app shell ready" : "PWA lane being prepared"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-white">What this unlocks</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-300">
            <p>Installable app shell on iPhone and desktop.</p>
            <p>Standalone Traffic window instead of a generic browser tab.</p>
            <p>Future direct-tap notifications that open right into Traffic.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-white">Install guidance</p>

          {installed ? (
            <p className="mt-3 text-sm leading-6 text-emerald-200">
              This device is already running Traffic in standalone mode.
            </p>
          ) : installPrompt ? (
            <>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                This browser can install Traffic directly.
              </p>
              <button
                type="button"
                onClick={() => void handleInstall()}
                disabled={installing}
                className="mt-4 cursor-pointer rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {installing ? "Opening install prompt..." : "Install Traffic"}
              </button>
            </>
          ) : isIphoneLike ? (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              On iPhone, open Traffic in Safari, tap <span className="font-medium text-white">Share</span>,
              then choose <span className="font-medium text-white">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Install prompts are browser-controlled. If you do not see one yet, keep using
              Traffic normally while we finish the native web-push lane.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
