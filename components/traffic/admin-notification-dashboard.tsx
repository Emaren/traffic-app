"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import AdminWebPushCard from "@/components/traffic/admin-web-push-card";
import { withFlag } from "@/components/traffic/display";
import PwaInstallCard from "@/components/traffic/pwa-install-card";
import type {
  NotificationDashboardResponse,
  NotificationEventRecord,
  NotificationMuteRule,
  NotificationProviderKey,
  NotificationSettings,
  VisibilityRule,
} from "@/components/traffic/types";

type Props = {
  initialData: NotificationDashboardResponse | null;
};

type MuteDraft = {
  rule_type: NotificationMuteRule["rule_type"];
  match_value: string;
  label: string;
  reason: string;
};

type NotificationEventBurstGroup = {
  key: string;
  latestEvent: NotificationEventRecord;
  primaryEvent: NotificationEventRecord;
  dominantStatus: NotificationEventRecord["status"];
  events: NotificationEventRecord[];
  stackCount: number;
  deliveredCount: number;
  suppressedCount: number;
  errorCount: number;
  uniquePaths: string[];
  suppressionReasons: string[];
};

const NOTIFICATION_BURST_WINDOW_MS = 75_000;

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function humanizeReason(value: string): string {
  if (!value) return "Allowed";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeRuleType(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseEventTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function loopTone(mode?: string): string {
  switch (mode) {
    case "running":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "disabled":
    case "provider_not_configured":
      return "border-amber-400/30 bg-amber-400/10 text-amber-100";
    case "error":
      return "border-rose-400/30 bg-rose-400/10 text-rose-100";
    default:
      return "border-white/10 bg-black/20 text-white/70";
  }
}

function eventTone(status: NotificationEventRecord["status"]): string {
  switch (status) {
    case "delivered":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
    case "suppressed":
      return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    default:
      return "border-rose-400/20 bg-rose-400/10 text-rose-100";
  }
}

function isGreenHumanEvent(event: NotificationEventRecord): boolean {
  return (
    event.status === "delivered" &&
    (event.classification_state === "human_confirmed" ||
      event.classification_state === "likely_human")
  );
}

function cloneSettings(settings: NotificationSettings): NotificationSettings {
  return JSON.parse(JSON.stringify(settings)) as NotificationSettings;
}

function defaultMuteDraft(): MuteDraft {
  return {
    rule_type: "person_key",
    match_value: "",
    label: "",
    reason: "Muted from the notification cockpit",
  };
}

function visibilityRuleLabel(rule: VisibilityRule): string {
  switch (rule.rule_type) {
    case "ip":
      return "Shared hidden IP";
    case "path":
      return "Shared hidden path";
    case "project_slug":
      return "Shared hidden project";
    case "host":
      return "Shared hidden host";
    default:
      return "Shared hidden rule";
  }
}

function burstGroupKey(event: NotificationEventRecord): string {
  return `${event.visitor_profile_id}:${event.session_id}:${event.project_slug}`;
}

function buildNotificationEventBurstGroups(
  events: NotificationEventRecord[],
): NotificationEventBurstGroup[] {
  const groups: Array<{
    key: string;
    newestTimestamp: number;
    events: NotificationEventRecord[];
  }> = [];

  for (const event of events) {
    const key = burstGroupKey(event);
    const eventTimestamp = parseEventTimestamp(event.event_timestamp);
    const matchingGroup = groups.find(
      (group) =>
        group.key === key &&
        group.newestTimestamp >= eventTimestamp &&
        group.newestTimestamp - eventTimestamp <= NOTIFICATION_BURST_WINDOW_MS,
    );

    if (matchingGroup) {
      matchingGroup.events.push(event);
      continue;
    }

    groups.push({
      key,
      newestTimestamp: eventTimestamp,
      events: [event],
    });
  }

  return groups
    .map((group) => {
      const orderedEvents = [...group.events].sort((left, right) => {
        const timeDelta =
          parseEventTimestamp(right.event_timestamp) - parseEventTimestamp(left.event_timestamp);
        if (timeDelta !== 0) return timeDelta;
        return right.id - left.id;
      });
      const latestEvent = orderedEvents[0];
      const primaryEvent =
        orderedEvents.find((event) => event.status === "delivered") ??
        orderedEvents.find((event) => event.status === "error") ??
        latestEvent;
      const deliveredCount = orderedEvents.filter((event) => event.status === "delivered").length;
      const suppressedCount = orderedEvents.filter((event) => event.status === "suppressed").length;
      const errorCount = orderedEvents.filter((event) => event.status === "error").length;
      const dominantStatus: NotificationEventBurstGroup["dominantStatus"] =
        deliveredCount > 0 ? "delivered" : errorCount > 0 ? "error" : "suppressed";
      const uniquePaths = [...new Set(orderedEvents.map((event) => event.path).filter(Boolean))];
      const suppressionReasons = [
        ...new Set(
          orderedEvents
            .map((event) => event.suppression_reason)
            .filter(Boolean)
            .map((value) => humanizeReason(value)),
        ),
      ];

      return {
        key: `${group.key}:${latestEvent.id}`,
        latestEvent,
        primaryEvent,
        dominantStatus,
        events: orderedEvents,
        stackCount: orderedEvents.length,
        deliveredCount,
        suppressedCount,
        errorCount,
        uniquePaths,
        suppressionReasons,
      };
    })
    .sort(
      (left, right) =>
        parseEventTimestamp(right.latestEvent.event_timestamp) -
        parseEventTimestamp(left.latestEvent.event_timestamp),
    );
}

export default function AdminNotificationDashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [settings, setSettings] = useState<NotificationSettings | null>(
    initialData?.settings ? cloneSettings(initialData.settings) : null,
  );
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [muteDraft, setMuteDraft] = useState<MuteDraft>(defaultMuteDraft());
  const [busy, setBusy] = useState<string | null>(null);
  const [showOnlyHumanEvents, setShowOnlyHumanEvents] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );
  const visibleRecentEvents = useMemo(
    () =>
      (data?.recent_events ?? []).filter((event) =>
        showOnlyHumanEvents ? isGreenHumanEvent(event) : true,
      ),
    [data?.recent_events, showOnlyHumanEvents],
  );
  const visibleRecentEventGroups = useMemo(
    () => buildNotificationEventBurstGroups(visibleRecentEvents),
    [visibleRecentEvents],
  );

  useEffect(() => {
    setData(initialData);
    setSettings(initialData?.settings ? cloneSettings(initialData.settings) : null);
    setHasLocalEdits(false);
  }, [initialData]);

  async function refreshDashboard(options?: { quiet?: boolean; mounted?: boolean }) {
    try {
      const response = await fetch("/admin-api/notifications/dashboard", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not refresh the notification cockpit.");
      }

      const next = (await response.json()) as NotificationDashboardResponse;
      if (options?.mounted === false) return;
      const preserveLocalEdits = busy === "save" || hasLocalEdits;

      startTransition(() => {
        setData(next);
        setSettings((current) => (preserveLocalEdits ? current : cloneSettings(next.settings)));
      });

      if (!options?.quiet) {
        setMessage({
          tone: "success",
          text: preserveLocalEdits
            ? "Live stats refreshed. Your unsaved notification edits were kept."
            : "Notification cockpit refreshed.",
        });
      }
    } catch (err) {
      if (!options?.quiet) {
        setMessage({
          tone: "error",
          text: err instanceof Error ? err.message : "Could not refresh the notification cockpit.",
        });
      }
    }
  }

  const refreshDashboardInEffect = useEffectEvent(
    async (options?: { quiet?: boolean; mounted?: boolean }) => {
      await refreshDashboard(options);
    },
  );

  useEffect(() => {
    let mounted = true;
    const timer = window.setInterval(() => {
      void refreshDashboardInEffect({ quiet: true, mounted });
    }, 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  async function saveSettings() {
    if (!settings) return;
    setBusy("save");
    setMessage(null);

    try {
      const response = await fetch("/admin-api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not save notification settings.");
      }

      const payload = (await response.json()) as { settings: NotificationSettings };
      setSettings(cloneSettings(payload.settings));
      setHasLocalEdits(false);
      await refreshDashboard({ quiet: true });
      setMessage({ tone: "success", text: "Notification settings saved." });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not save notification settings.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    setMessage(null);
    try {
      const response = await fetch("/admin-api/notifications/test", {
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not send a test notification.");
      }
      setMessage({
        tone: "success",
        text: "Test notification sent. The title includes the flag emoji path.",
      });
      await refreshDashboard({ quiet: true });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not send a test notification.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    setBusy("logout");
    await fetch("/admin-api/session", { method: "DELETE" }).catch(() => null);
    window.location.href = "/admin";
  }

  async function createMute(draft: MuteDraft) {
    setBusy("mute");
    setMessage(null);
    try {
      const response = await fetch("/admin-api/notifications/mutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not create mute.");
      }

      setMuteDraft(defaultMuteDraft());
      await refreshDashboard({ quiet: true });
      setMessage({ tone: "success", text: "Mute rule added." });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not create mute.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function deleteMute(muteId: number) {
    setBusy(`delete-mute-${muteId}`);
    setMessage(null);
    try {
      const response = await fetch(`/admin-api/notifications/mutes/${muteId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not delete mute.");
      }
      await refreshDashboard({ quiet: true });
      setMessage({ tone: "success", text: "Mute rule removed." });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not delete mute.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function deleteVisibilityRule(ruleId: number) {
    setBusy(`delete-visibility-${ruleId}`);
    setMessage(null);
    try {
      const response = await fetch(`/admin-api/visibility-rules/${ruleId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not remove visibility rule.");
      }
      await refreshDashboard({ quiet: true });
      setMessage({ tone: "success", text: "Visibility rule removed." });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not remove visibility rule.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function quickMute(
    ruleType: MuteDraft["rule_type"],
    matchValue: string,
    label: string,
    reason: string,
  ) {
    await createMute({
      rule_type: ruleType,
      match_value: matchValue,
      label,
      reason,
    });
  }

  async function deleteOperatorIdentity(operatorId: number) {
    setBusy(`delete-operator-${operatorId}`);
    setMessage(null);
    try {
      const response = await fetch(`/admin-api/notifications/operators/${operatorId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not remove operator identity.");
      }
      await refreshDashboard({ quiet: true });
      setMessage({ tone: "success", text: "Operator identity removed." });
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Could not remove operator identity.",
      });
    } finally {
      setBusy(null);
    }
  }

  if (!data || !settings) {
    return (
      <main className="min-h-screen bg-[#06070a] px-4 py-8 text-slate-100 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6">
          Traffic could not load the notification cockpit yet.
        </div>
      </main>
    );
  }

  const allProjectSlugs = data.projects.map((project) => project.slug);
  const projectScopeIsWideOpen = settings.policy.selected_projects.length === 0;
  const selectedProjects = new Set(
    projectScopeIsWideOpen
      ? allProjectSlugs
      : settings.policy.selected_projects.filter((slug) => allProjectSlugs.includes(slug)),
  );
  const allProjectsSelected = selectedProjects.size === allProjectSlugs.length;
  const hiddenRecentEventCount = data.recent_events.length - visibleRecentEvents.length;

  function updateSelectedProjects(next: Set<string>) {
    const ordered = allProjectSlugs.filter((slug) => next.has(slug));
    setSettings((current) =>
      current
        ? {
            ...current,
            policy: {
              ...current.policy,
              selected_projects: ordered.length === allProjectSlugs.length ? [] : ordered,
            },
          }
        : current,
    );
  }

  function renderDeliveryActions(event: NotificationEventRecord) {
    return (
      <>
        <Link
          href={`/visitors/${event.visitor_profile_id}`}
          className="inline-flex justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15"
        >
          Open visitor
        </Link>
        {event.operator_identity ? (
          <button
            type="button"
            onClick={() => void deleteOperatorIdentity(event.operator_identity!.id)}
            disabled={busy === `delete-operator-${event.operator_identity.id}`}
            className="cursor-pointer rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove self tag
          </button>
        ) : null}
        <button
          type="button"
          onClick={() =>
            void quickMute(
              "person_key",
              event.person_key,
              `${event.visitor_alias} fingerprint`,
              "Muted from a delivery-log quick action",
            )
          }
          disabled={busy === "mute"}
          className="cursor-pointer rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/75 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mute visitor
        </button>
        <button
          type="button"
          onClick={() =>
            void quickMute(
              "ip",
              event.ip,
              `${event.ip}`,
              "Muted IP from a delivery-log quick action",
            )
          }
          disabled={busy === "mute"}
          className="cursor-pointer rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/75 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mute IP
        </button>
        <button
          type="button"
          onClick={() =>
            void quickMute(
              "path",
              event.path,
              `${event.path}`,
              "Muted path from a delivery-log quick action",
            )
          }
          disabled={busy === "mute"}
          className="cursor-pointer rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/75 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mute path
        </button>
        <button
          type="button"
          onClick={() =>
            void quickMute(
              "project_slug",
              event.project_slug,
              `${event.project_name}`,
              "Muted project from a delivery-log quick action",
            )
          }
          disabled={busy === "mute"}
          className="cursor-pointer rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/75 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mute project
        </button>
      </>
    );
  }

  function renderBurstBadge(group: NotificationEventBurstGroup) {
    if (group.stackCount <= 1) {
      return null;
    }

    return (
      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/75">
        Stack x{group.stackCount}
      </span>
    );
  }

  function renderStackedDeliveryGroup(group: NotificationEventBurstGroup) {
    const event = group.latestEvent;
    const actionEvent = group.primaryEvent;
    const toneClass = eventTone(group.dominantStatus);
    const pathSummary =
      group.uniquePaths.length > 1
        ? `${event.path} • +${group.uniquePaths.length - 1} more paths`
        : event.path;
    const suppressionSummary =
      group.suppressionReasons.length === 0
        ? ""
        : group.suppressionReasons.length === 1
          ? group.suppressionReasons[0]
          : `${group.suppressionReasons[0]} +${group.suppressionReasons.length - 1} more`;

    return (
      <details
        key={group.key}
        className={`group relative rounded-3xl border p-4 ${toneClass}`}
      >
        {group.stackCount > 1 ? (
          <>
            <div className="pointer-events-none absolute inset-x-3 top-2 h-full rounded-3xl border border-white/8 bg-black/10 opacity-60" />
            <div className="pointer-events-none absolute inset-x-5 top-4 h-full rounded-3xl border border-white/6 bg-black/10 opacity-40" />
          </>
        ) : null}

        <summary className="relative z-10 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                {group.dominantStatus}
              </span>
              {event.operator_identity ? (
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                  Operator
                </span>
              ) : null}
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                {event.project_name}
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                {event.verdict_label}
              </span>
              {renderBurstBadge(group)}
              {group.deliveredCount > 0 && group.stackCount > 1 ? (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                  {group.deliveredCount} delivered
                </span>
              ) : null}
              {group.suppressedCount > 0 && group.stackCount > 1 ? (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100">
                  {group.suppressedCount} suppressed
                </span>
              ) : null}
              {group.errorCount > 0 && group.stackCount > 1 ? (
                <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-100">
                  {group.errorCount} errors
                </span>
              ) : null}
            </div>

            <h3 className="mt-3 break-words text-lg font-semibold text-white">
              {withFlag(event.country_code, event.visitor_alias)}
            </h3>
            <p className="mt-1 break-all font-mono text-sm text-slate-300">{pathSummary}</p>
            <p className="mt-2 break-words text-sm text-slate-400">
              {event.event_timestamp_alberta} • IP {event.ip} •{" "}
              {event.returning_visitor ? "Returning" : "New"} • Total Project Visits{" "}
              {event.total_project_visits}
            </p>
            {suppressionSummary ? (
              <p className="mt-2 text-sm text-white/80">Burst reasons: {suppressionSummary}</p>
            ) : null}
          </div>
        </summary>

        <div className="relative z-10 mt-4 border-t border-white/10 pt-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/80">
            <p className="font-medium text-white">{actionEvent.notification_title}</p>
            <p className="mt-2 whitespace-pre-line break-words text-slate-300">
              {actionEvent.notification_body}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {group.events.map((burstEvent) => (
              <div
                key={`${group.key}-${burstEvent.id}`}
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                    {burstEvent.status}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                    {burstEvent.event_timestamp_alberta}
                  </span>
                  {burstEvent.suppression_reason ? (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-amber-100">
                      {humanizeReason(burstEvent.suppression_reason)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 break-all font-mono text-xs text-slate-300">{burstEvent.path}</div>
              </div>
            ))}
          </div>

          {group.errorCount > 0 && actionEvent.delivery_error ? (
            <p className="mt-3 text-sm text-white/80">
              Error: {actionEvent.delivery_error || "Unknown delivery failure"}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">{renderDeliveryActions(actionEvent)}</div>
        </div>
      </details>
    );
  }

  function renderSingleEvent(event: NotificationEventRecord) {
    return event.status === "suppressed" ? (
      <details
        key={`${event.traffic_event_id}-${event.id}`}
        className={`group rounded-2xl border p-3 ${eventTone(event.status)}`}
      >
        <summary className="flex cursor-pointer list-none flex-col gap-3 [&::-webkit-details-marker]:hidden xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex flex-1 flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              {event.status}
            </span>
            {event.operator_identity ? (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                Operator
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              {event.project_name}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              {event.verdict_label}
            </span>
            <span className="min-w-0 max-w-full truncate text-sm font-medium text-white">
              {withFlag(event.country_code, event.visitor_alias)}
            </span>
            <span className="hidden text-white/30 xl:inline">/</span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-amber-100/80">
              {event.path}
            </span>
          </div>

          <div className="min-w-0 flex flex-wrap items-center gap-2 text-xs text-amber-100/80">
            <span className="truncate">
              Suppressed: {humanizeReason(event.suppression_reason)}
            </span>
            <span>{event.event_timestamp_alberta}</span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-medium uppercase tracking-[0.16em] text-white/65">
              More
            </span>
          </div>
        </summary>

        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-white/70">
            <span>IP {event.ip}</span>
            <span>{event.returning_visitor ? "Returning" : "New"}</span>
            <span>Total Project Visits {event.total_project_visits}</span>
            <span>Host {event.host}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">{renderDeliveryActions(event)}</div>
        </div>
      </details>
    ) : (
      <article
        key={`${event.traffic_event_id}-${event.id}`}
        className={`rounded-3xl border p-4 ${eventTone(event.status)}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              {event.status}
            </span>
            {event.operator_identity ? (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                Operator
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              {event.project_name}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              {event.verdict_label}
            </span>
          </div>

          <h3 className="mt-3 break-words text-lg font-semibold text-white">
            {withFlag(event.country_code, event.visitor_alias)}
          </h3>
          <p className="mt-1 break-all font-mono text-sm text-slate-300">
            {event.path}
          </p>
          <p className="mt-2 break-words text-sm text-slate-400">
            {event.event_timestamp_alberta} • IP {event.ip} •{" "}
            {event.returning_visitor ? "Returning" : "New"} • Total Project Visits{" "}
            {event.total_project_visits}
          </p>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/80">
            <p className="font-medium text-white">{event.notification_title}</p>
            <p className="mt-2 whitespace-pre-line break-words text-slate-300">
              {event.notification_body}
            </p>
          </div>

          {event.status !== "delivered" ? (
            <p className="mt-3 text-sm text-white/80">
              Error: {event.delivery_error || "Unknown delivery failure"}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">{renderDeliveryActions(event)}</div>
        </div>
      </article>
    );
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Traffic Admin</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                Visitor notification cockpit
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Start wide open, then tighten the faucet yourself. Traffic decides who hit which
                page, whether they look human, and what got delivered, suppressed, or muted.
              </p>
            </div>

            <div className="min-w-0 flex flex-wrap items-center gap-2">
              <div className={`rounded-full border px-3 py-1 text-xs font-medium ${loopTone(data.loop.mode)}`}>
                Loop: {data.loop.mode || "booting"}
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                Armed {settings.armed_at ? formatTimestamp(settings.armed_at) : "not yet"}
              </div>
              <button
                type="button"
                onClick={() => void refreshDashboard()}
                disabled={Boolean(busy)}
                className="cursor-pointer rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/80 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                disabled={busy === "logout"}
                className="cursor-pointer rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "logout" ? "Logging out..." : "Lock cockpit"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Delivered", data.stats.delivered, "Notifications that actually hit your phone lane."],
              ["Suppressed", data.stats.suppressed, "Traffic saw the event, but policy or mutes blocked it."],
              ["Errors", data.stats.errors, "Provider or transport failures that need attention."],
              ["Loop checked", data.loop.checked ?? 0, "How many fresh events the worker looked at last run."],
              [
                "Last delivered",
                data.stats.last_delivered_at ? formatTimestamp(data.stats.last_delivered_at) : "Never",
                "Most recent successful push out of Traffic.",
              ],
            ].map(([label, value, helper]) => (
              <div
                key={label}
                className="rounded-3xl border border-white/10 bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
              >
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{String(value)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{helper}</p>
              </div>
            ))}
          </div>

          {message ? (
            <div
              className={`mt-5 rounded-2xl border p-4 text-sm ${
                message.tone === "error"
                  ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                  : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
              }`}
            >
              {message.text}
            </div>
          ) : null}
        </header>

        <PwaInstallCard className="mt-6" />

        <section
          className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"
          onChangeCapture={() => setHasLocalEdits(true)}
        >
          <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Provider</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Delivery lane</h2>
              </div>
              <div className="min-w-0 flex flex-wrap items-center gap-2">
                {hasLocalEdits ? (
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                    Unsaved edits held locally
                  </div>
                ) : null}
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                  {data.provider_ready ? "Provider ready" : "Provider needs setup"}
                </div>
              </div>
            </div>

            {hasLocalEdits ? (
              <p className="mt-3 text-sm text-cyan-100/80">
                You can tab out of fields safely now. Save delivery settings when you want these
                values written to Traffic.
              </p>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid min-w-0 gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Provider</span>
                <select
                  value={settings.provider}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      provider: event.target.value as NotificationProviderKey,
                    })
                  }
                  className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                >
                  <option value="pushover">Pushover</option>
                  <option value="ntfy">ntfy</option>
                  <option value="web_push">Traffic web push</option>
                </select>
              </label>

              <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      enabled: event.target.checked,
                    })
                  }
                />
                <span className="text-sm text-white">Notifications armed</span>
              </label>

              {settings.provider === "pushover" ? (
                <>
                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">App token</span>
                    <input
                      value={settings.providers.pushover.app_token}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          providers: {
                            ...settings.providers,
                            pushover: {
                              ...settings.providers.pushover,
                              app_token: event.target.value,
                            },
                          },
                        })
                      }
                      className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                      placeholder="Your Pushover app token"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">User key</span>
                    <input
                      value={settings.providers.pushover.user_key}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          providers: {
                            ...settings.providers,
                            pushover: {
                              ...settings.providers.pushover,
                              user_key: event.target.value,
                            },
                          },
                        })
                      }
                      className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                      placeholder="Your Pushover user key"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Device</span>
                    <input
                      value={settings.providers.pushover.device}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          providers: {
                            ...settings.providers,
                            pushover: {
                              ...settings.providers.pushover,
                              device: event.target.value,
                            },
                          },
                        })
                      }
                      className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                      placeholder="Optional device name"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Priority</span>
                    <input
                      type="number"
                      min={-2}
                      max={2}
                      value={settings.providers.pushover.priority}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          providers: {
                            ...settings.providers,
                            pushover: {
                              ...settings.providers.pushover,
                              priority: Number(event.target.value || 0),
                            },
                          },
                        })
                      }
                      className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                    />
                  </label>
                </>
              ) : settings.provider === "ntfy" ? (
                <>
                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Base URL</span>
                    <input
                      value={settings.providers.ntfy.base_url}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          providers: {
                            ...settings.providers,
                            ntfy: {
                              ...settings.providers.ntfy,
                              base_url: event.target.value,
                            },
                          },
                        })
                      }
                      className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                      placeholder="https://ntfy.sh"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Topic</span>
                    <input
                      value={settings.providers.ntfy.topic}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          providers: {
                            ...settings.providers,
                            ntfy: {
                              ...settings.providers.ntfy,
                              topic: event.target.value,
                            },
                          },
                        })
                      }
                      className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                      placeholder="traffic-tony"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Bearer token</span>
                    <input
                      value={settings.providers.ntfy.token}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          providers: {
                            ...settings.providers,
                            ntfy: {
                              ...settings.providers.ntfy,
                              token: event.target.value,
                            },
                          },
                        })
                      }
                      className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                      placeholder="Optional ntfy bearer token"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Tags</span>
                    <input
                      value={settings.providers.ntfy.tags}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          providers: {
                            ...settings.providers,
                            ntfy: {
                              ...settings.providers.ntfy,
                              tags: event.target.value,
                            },
                          },
                        })
                      }
                      className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                      placeholder="traffic,eyes"
                    />
                  </label>
                </>
              ) : (
                <div className="md:col-span-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-medium text-white">Traffic-native delivery</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Server VAPID keys stay on the API host. What you manage here are the devices
                      allowed to receive direct-open Traffic web push.
                    </p>
                  </div>
                </div>
              )}

              <label className="grid min-w-0 gap-2 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Base link in notifications</span>
                <input
                  value={settings.site_base_url}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      site_base_url: event.target.value,
                    })
                  }
                  className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                  placeholder="https://traffic.tokentap.ca"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={busy === "save"}
                className="w-full cursor-pointer rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {busy === "save" ? "Saving..." : "Save delivery settings"}
              </button>
              <button
                type="button"
                onClick={() => void sendTest()}
                disabled={busy === "test"}
                className="w-full cursor-pointer rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {busy === "test" ? "Sending..." : "Send test notification"}
              </button>
            </div>

            <AdminWebPushCard
              webPush={data.web_push}
              selected={settings.provider === "web_push"}
              busy={Boolean(busy)}
              onRefresh={() => refreshDashboard({ quiet: true })}
            />
          </div>

          <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Policy</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Tighten the faucet</h2>

            <div className="mt-5 grid gap-3">
              {[
                ["page_hits_only", "Only notify for real page hits, not API/background noise"],
                ["suppress_operator_traffic", "Suppress operator/self traffic"],
                ["filter_exploit_probes", "Filter obvious exploit or scanner-style page probes"],
                [
                  "filter_known_automation",
                  "Filter known crawler, preview, and proxy automation like GoogleOther",
                ],
                ["include_human_confirmed", "Include confirmed humans"],
                ["include_likely_human", "Include likely humans"],
                ["include_unclear", "Include unclear sessions while you are learning the flow"],
                ["include_suspicious", "Include suspicious traffic"],
                ["include_bots", "Include known bots until you decide otherwise"],
                ["include_returning", "Include returning visitors"],
                ["new_visitors_only", "Only send for new visitors"],
              ].map(([key, label]) => {
                const policyKey = key as keyof NotificationSettings["policy"];
                return (
                  <label
                    key={key}
                    className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(settings.policy[policyKey])}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          policy: {
                            ...settings.policy,
                            [policyKey]: event.target.checked,
                          },
                        })
                      }
                    />
                    <span className="text-sm text-white">{label}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <label className="grid min-w-0 gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Per visitor / hour</span>
                <input
                  type="number"
                  min={0}
                  value={settings.policy.max_notifications_per_visitor_per_hour}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      policy: {
                        ...settings.policy,
                        max_notifications_per_visitor_per_hour: Number(event.target.value || 0),
                      },
                    })
                  }
                  className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                />
              </label>

              <label className="grid min-w-0 gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Per session</span>
                <input
                  type="number"
                  min={0}
                  value={settings.policy.max_notifications_per_session}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      policy: {
                        ...settings.policy,
                        max_notifications_per_session: Number(event.target.value || 0),
                      },
                    })
                  }
                  className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                />
              </label>

              <label className="grid min-w-0 gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Same path / hour</span>
                <input
                  type="number"
                  min={0}
                  value={settings.policy.max_notifications_per_path_per_visitor_per_hour}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      policy: {
                        ...settings.policy,
                        max_notifications_per_path_per_visitor_per_hour: Number(
                          event.target.value || 0,
                        ),
                      },
                    })
                  }
                  className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                />
              </label>
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Project scope</p>
                  <p className="text-sm text-slate-400">
                    Leave everything selected for wide-open mode, or trim it to a few projects.
                  </p>
                </div>
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                    {projectScopeIsWideOpen
                      ? "Wide-open mode: every project is currently included."
                      : `${selectedProjects.size} of ${allProjectSlugs.length} projects included.`}
                  </div>
                  {!projectScopeIsWideOpen ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          policy: {
                            ...settings.policy,
                            selected_projects: [],
                          },
                        })
                      }
                      className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/75 transition hover:bg-white/10"
                    >
                      Include every project
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="mt-3 text-xs leading-6 text-slate-500">
                Project scope changes are saved with the rest of the notification settings. In
                wide-open mode, Traffic stores an empty project list internally, but every project
                stays visually selected here.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.projects.map((project) => (
                  <label
                    key={project.slug}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.slug)}
                      onChange={(event) => {
                        const next = new Set(projectScopeIsWideOpen ? allProjectSlugs : selectedProjects);
                        if (event.target.checked) {
                          next.add(project.slug);
                        } else {
                          next.delete(project.slug);
                        }
                        updateSelectedProjects(next);
                      }}
                    />
                    <span className="min-w-0 break-words text-sm text-white">{project.name}</span>
                  </label>
                ))}
              </div>

              {!allProjectsSelected ? (
                <button
                  type="button"
                  onClick={() => updateSelectedProjects(new Set(allProjectSlugs))}
                  className="mt-4 cursor-pointer rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/75 transition hover:bg-white/10"
                >
                  Select every listed project
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Mutes</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Kill switches</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Operator identities stay visible here so Traffic can recognize self traffic, and hard
              mutes handle bots, scanners, or background noise you never want to hear about.
            </p>

            <div className="mt-5 overflow-hidden rounded-3xl border border-cyan-300/15 bg-cyan-300/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Operator identities</p>
                  <p className="text-sm text-slate-400">
                    Self-traffic fingerprints that should suppress phone pushes as operator activity.
                  </p>
                </div>
                <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                  {data.operators.length} tagged
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {data.operators.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                    No operator identities are tagged right now.
                  </div>
                ) : (
                  data.operators.map((operator) => (
                    <div
                      key={operator.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                              Operator
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                              {humanizeRuleType(operator.rule_type)}
                            </span>
                            <span className="break-words text-sm font-medium text-white">
                              {operator.label}
                            </span>
                          </div>
                          <p className="mt-2 break-all font-mono text-xs text-slate-400">
                            {operator.match_value}
                          </p>
                          <p className="mt-2 break-words text-sm text-slate-300">{operator.notes}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void deleteOperatorIdentity(operator.id)}
                          disabled={busy === `delete-operator-${operator.id}`}
                          className="w-full cursor-pointer rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                          Remove self tag
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
                {settings.policy.suppress_operator_traffic
                  ? "Operator suppression is on. Tagged self traffic will stay quiet until you turn it off."
                  : "Operator suppression is off. Tagged self traffic keeps its Operator badge, but real page hits can still notify while you test."}
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid min-w-0 gap-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Rule type</span>
                  <select
                    value={muteDraft.rule_type}
                    onChange={(event) =>
                      setMuteDraft({
                        ...muteDraft,
                        rule_type: event.target.value as MuteDraft["rule_type"],
                      })
                    }
                    className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                  >
                    <option value="person_key">Visitor fingerprint</option>
                    <option value="visitor_profile_id">Visitor profile</option>
                    <option value="ip">IP address</option>
                    <option value="path">Path</option>
                    <option value="project_slug">Project</option>
                    <option value="host">Host</option>
                  </select>
                </label>

                <label className="grid min-w-0 gap-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Match value</span>
                  <input
                    value={muteDraft.match_value}
                    onChange={(event) =>
                      setMuteDraft({
                        ...muteDraft,
                        match_value: event.target.value,
                      })
                    }
                    className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                    placeholder="Exact value to mute"
                  />
                </label>

                <label className="grid min-w-0 gap-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Label</span>
                  <input
                    value={muteDraft.label}
                    onChange={(event) =>
                      setMuteDraft({
                        ...muteDraft,
                        label: event.target.value,
                      })
                    }
                    className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                    placeholder="What you want to call this mute"
                  />
                </label>

                <label className="grid min-w-0 gap-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Reason</span>
                  <input
                    value={muteDraft.reason}
                    onChange={(event) =>
                      setMuteDraft({
                        ...muteDraft,
                        reason: event.target.value,
                      })
                    }
                    className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                    placeholder="Why this should stay quiet"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => void createMute(muteDraft)}
                disabled={busy === "mute" || !muteDraft.match_value.trim()}
                className="cursor-pointer rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "mute" ? "Adding mute..." : "Add mute rule"}
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {data.mutes.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  No mute rules yet. Wide-open mode is still alive.
                </div>
              ) : (
                data.mutes.map((mute) => (
                  <div
                    key={mute.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                            {mute.rule_type}
                          </span>
                          <span className="break-words text-sm font-medium text-white">{mute.label}</span>
                        </div>
                        <p className="mt-2 break-all font-mono text-xs text-slate-400">
                          {mute.match_value}
                        </p>
                        <p className="mt-2 break-words text-sm text-slate-300">{mute.reason}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void deleteMute(mute.id)}
                        disabled={busy === `delete-mute-${mute.id}`}
                        className="w-full cursor-pointer rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-amber-300/15 bg-amber-300/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Shared observatory hides</p>
                  <p className="text-sm text-slate-400">
                    Server-backed visibility rules that remove noisy IPs, paths, hosts, or projects
                    from Traffic surfaces across devices.
                  </p>
                </div>
                <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                  {data.visibility_rules.length} shared rules
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {data.visibility_rules.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                    No shared observatory hides yet. Add one from the live feed or visits history.
                  </div>
                ) : (
                  data.visibility_rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                              {visibilityRuleLabel(rule)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                              {humanizeRuleType(rule.rule_type)}
                            </span>
                            <span className="break-words text-sm font-medium text-white">{rule.label}</span>
                          </div>
                          <p className="mt-2 break-all font-mono text-xs text-slate-400">
                            {rule.match_value}
                          </p>
                          <p className="mt-2 break-words text-sm text-slate-300">{rule.reason}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void deleteVisibilityRule(rule.id)}
                          disabled={busy === `delete-visibility-${rule.id}`}
                          className="w-full cursor-pointer rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Delivery log</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">What Traffic just did</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOnlyHumanEvents((current) => !current)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
                    showOnlyHumanEvents
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {showOnlyHumanEvents ? "Showing only green humans" : "Only show green humans"}
                </button>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                  {visibleRecentEventGroups.length} tiles • {visibleRecentEvents.length} events
                  {hiddenRecentEventCount > 0 ? ` • ${hiddenRecentEventCount} hidden` : ""}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {visibleRecentEventGroups.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                  {showOnlyHumanEvents
                    ? "Traffic has not delivered any green human events in this recent window yet."
                    : "No notifications have been processed yet."}
                </div>
              ) : (
                visibleRecentEventGroups.map((group) =>
                  group.stackCount > 1
                    ? renderStackedDeliveryGroup(group)
                    : renderSingleEvent(group.latestEvent),
                )
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
