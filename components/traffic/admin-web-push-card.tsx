"use client";

import { useEffect, useMemo, useState } from "react";
import type { NotificationDashboardResponse } from "@/components/traffic/types";

type Props = {
  webPush: NotificationDashboardResponse["web_push"];
  selected: boolean;
  busy: boolean;
  onRefresh: () => Promise<void>;
};

type DeviceState = {
  supported: boolean;
  installed: boolean;
  permission: NotificationPermission | "unsupported";
  currentEndpoint: string | null;
  currentSubscriptionId: number | null;
};

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function looksLikeIphoneFamily(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

function describeCurrentDevice(): string {
  if (typeof navigator === "undefined") return "Traffic device";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("iphone")) return "Traffic on iPhone";
  if (ua.includes("ipad")) return "Traffic on iPad";
  if (ua.includes("mac")) return "Traffic on Mac";
  if (ua.includes("android")) return "Traffic on Android";
  if (ua.includes("windows")) return "Traffic on Windows";
  return "Traffic device";
}

export default function AdminWebPushCard({ webPush, selected, busy, onRefresh }: Props) {
  const [deviceState, setDeviceState] = useState<DeviceState>({
    supported: false,
    installed: false,
    permission: "unsupported",
    currentEndpoint: null,
    currentSubscriptionId: null,
  });
  const [working, setWorking] = useState<"enable" | "disable" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const iphoneLike = useMemo(() => looksLikeIphoneFamily(), []);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) {
          setDeviceState({
            supported: false,
            installed: isStandaloneMode(),
            permission: "unsupported",
            currentEndpoint: null,
            currentSubscriptionId: null,
          });
        }
        return;
      }

      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const subscription = registration
        ? await registration.pushManager.getSubscription().catch(() => null)
        : null;
      const endpoint = subscription?.endpoint || null;
      const currentRecord = endpoint
        ? webPush.subscriptions.find((candidate) => candidate.endpoint === endpoint) || null
        : null;

      if (!cancelled) {
        setDeviceState({
          supported: true,
          installed: isStandaloneMode(),
          permission: Notification.permission,
          currentEndpoint: endpoint,
          currentSubscriptionId: currentRecord?.id ?? null,
        });
      }
    }

    void detect();

    return () => {
      cancelled = true;
    };
  }, [webPush.subscriptions]);

  async function enableCurrentDevice() {
    if (!webPush.configured || !webPush.public_key) {
      setMessage({
        tone: "error",
        text: "Traffic web-push keys are not configured on the server yet.",
      });
      return;
    }

    if (!deviceState.supported) {
      setMessage({
        tone: "error",
        text: "This browser cannot register for Traffic web push from here.",
      });
      return;
    }

    setWorking("enable");
    setMessage(null);

    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("Browser permission for notifications was not granted.");
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(webPush.public_key) as BufferSource,
        });
      }

      const response = await fetch("/admin-api/web-push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          device_label: describeCurrentDevice(),
          user_agent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not register this device for Traffic web push.");
      }

      await onRefresh();
      setMessage({
        tone: "success",
        text: "This device is now registered for direct Traffic web push.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not enable native Traffic notifications on this device.",
      });
    } finally {
      setWorking(null);
    }
  }

  async function disableCurrentDevice() {
    setWorking("disable");
    setMessage(null);

    try {
      if (deviceState.currentSubscriptionId) {
        const response = await fetch(
          `/admin-api/web-push/subscriptions/${deviceState.currentSubscriptionId}`,
          {
            method: "DELETE",
          },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.detail || "Could not remove this device from Traffic web push.");
        }
      }

      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        const subscription = registration
          ? await registration.pushManager.getSubscription().catch(() => null)
          : null;
        if (subscription) {
          await subscription.unsubscribe().catch(() => false);
        }
      }

      await onRefresh();
      setMessage({
        tone: "success",
        text: "This device was removed from Traffic web push.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not disable native Traffic notifications on this device.",
      });
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Traffic native web push</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            This is the direct-open lane. When the Traffic app is installed and subscribed, taps
            can go straight into the visitor page instead of detouring through Pushover.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
          {selected ? "Selected provider" : "Available provider"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Server keys</p>
          <p className="mt-2 text-sm font-medium text-white">
            {webPush.configured ? "Configured" : "Missing"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">This device</p>
          <p className="mt-2 text-sm font-medium text-white">
            {deviceState.currentSubscriptionId ? "Subscribed" : "Not subscribed"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Permission</p>
          <p className="mt-2 text-sm font-medium text-white">{deviceState.permission}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Active devices</p>
          <p className="mt-2 text-sm font-medium text-white">{webPush.active_count}</p>
        </div>
      </div>

      {iphoneLike && !deviceState.installed ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          On iPhone, native web push only works from the installed Traffic app. Add Traffic to your
          Home Screen first, then open the installed app and come back here to enable alerts.
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void enableCurrentDevice()}
          disabled={
            busy ||
            working === "enable" ||
            !webPush.configured ||
            !deviceState.supported ||
            (iphoneLike && !deviceState.installed)
          }
          className="cursor-pointer rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {working === "enable" ? "Enabling native alerts..." : "Enable on this device"}
        </button>
        <button
          type="button"
          onClick={() => void disableCurrentDevice()}
          disabled={busy || working === "disable" || !deviceState.currentSubscriptionId}
          className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {working === "disable" ? "Removing device..." : "Remove this device"}
        </button>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-2xl border p-4 text-sm ${
            message.tone === "error"
              ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {webPush.subscriptions.length ? (
          webPush.subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {subscription.device_label || "Traffic device"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Endpoint tail: {subscription.endpoint_tail || "unknown"}
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                  {subscription.active ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-400">
                <p>Updated {new Date(subscription.updated_at).toLocaleString()}</p>
                {subscription.last_success_at ? (
                  <p>Last success {new Date(subscription.last_success_at).toLocaleString()}</p>
                ) : null}
                {subscription.last_error ? <p>Last error: {subscription.last_error}</p> : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            No Traffic-native devices are registered yet. Pushover is still useful as the fallback
            bell until this list has at least one active device.
          </div>
        )}
      </div>
    </div>
  );
}
