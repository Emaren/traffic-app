"use client";

import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import type { BrowserEventRecord, BrowserEventsResponse } from "@/components/traffic/types";
import {
  TRAFFIC_ADMIN_BEHAVIOR_FULL_KEY,
  loadStoredBoolean,
  storeBoolean,
} from "@/components/traffic/view-preferences";

type StoryFilter = "all" | "known" | "unknown";
type StoryActorKind = "person" | "network" | "automation";

const DEFAULT_TIMELINE_VISIBLE_EVENTS = 6;
const TIMELINE_LOAD_STEP = 8;

type VisitorJourney = {
  key: string;
  latest: BrowserEventRecord;
  events: BrowserEventRecord[];
  uniquePaths: string[];
  maxScroll: number;
  clicks: number;
  visibleMs: number;
  known: boolean;
  isFoldedBurst?: boolean;
  foldedJourneyCount?: number;
  foldedIpCount?: number;
  foldedLocation?: string;
  actorKind?: StoryActorKind;
  actorLabel?: string;
  actorSummary?: string;
  networkFamily?: string;
  isNetworkActorCluster?: boolean;
};

function countryFlag(countryCode?: string): string {
  const code = (countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🌍";
  return String.fromCodePoint(...code.split("").map((char) => 127397 + char.charCodeAt(0)));
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatShortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMs(value: number | null | undefined): string {
  if (!value) return "—";
  if (value < 1000) return `${value}ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function shortSession(value?: string): string {
  const v = (value || "").trim();
  return v ? v.slice(0, 18) : "—";
}

function displayIp(ip?: string): string {
  return (ip || "").trim() || "unknown IP";
}

function locationLine(event: BrowserEventRecord): string {
  return [event.city, event.area, event.country].filter(Boolean).join(", ");
}

function visitorName(event: BrowserEventRecord): string {
  if (event.known_visitor_label) return event.known_visitor_label;
  if (event.city) return `${event.city} visitor`;
  if (event.country) return `${event.country} visitor`;
  return "Unknown visitor";
}

function identityLine(event: BrowserEventRecord): string {
  const parts = [displayIp(event.ip)];
  if (event.known_visitor_detail) parts.push(event.known_visitor_detail);
  return parts.join(" • ");
}

function isKnownHumanKind(kind?: string): boolean {
  return ["owner", "family", "known_player", "known_human"].includes(
    (kind || "").trim().toLowerCase(),
  );
}

function isKnownAutomationKind(kind?: string): boolean {
  return ["known_automation", "crawler"].includes(
    (kind || "").trim().toLowerCase(),
  );
}

function ipv4Octets(ip?: string): number[] | null {
  const parts = (ip || "").trim().split(".");
  if (parts.length !== 4) return null;

  const values = parts.map((part) => Number(part));
  if (
    values.some(
      (value) =>
        !Number.isInteger(value) ||
        value < 0 ||
        value > 255,
    )
  ) {
    return null;
  }

  return values;
}

function isSingaporeCloudEvent(event: BrowserEventRecord): boolean {
  const octets = ipv4Octets(event.ip);
  if (!octets) return false;

  const [first, second] = octets;

  const knownCloudRange =
    (first === 43 && second >= 160 && second <= 175) ||
    (first === 47 && (second === 79 || second === 82));

  if (!knownCloudRange) return false;

  const countryCode = (event.country_code || "").trim().toUpperCase();
  const country = (event.country || "").trim().toLowerCase();

  return countryCode === "SG" || country.includes("singapore");
}

function journeyHasMeaningfulHumanEngagement(
  journey: VisitorJourney,
): boolean {
  if (journey.clicks > 0) return true;
  if (journey.maxScroll >= 50) return true;
  if (journey.visibleMs >= 20_000) return true;
  if (journey.uniquePaths.length >= 2) return true;

  return journey.events.some((event) =>
    [
      "heartbeat",
      "scroll_milestone",
      "visibility_change",
      "click",
      "outbound_click",
    ].includes(event.event_type),
  );
}

function storyActorForJourney(journey: VisitorJourney): {
  actorKind: StoryActorKind;
  actorLabel: string;
  actorSummary: string;
  networkFamily?: string;
} {
  const latest = journey.latest;
  const knownKind = (latest.known_visitor_kind || "").trim().toLowerCase();
  const meaningfulEngagement = journeyHasMeaningfulHumanEngagement(journey);

  const knownAutomation =
    isKnownAutomationKind(knownKind) ||
    Boolean((latest.automation_family || "").trim()) ||
    ["bot", "suspicious"].includes(
      (latest.request_classification || "").trim().toLowerCase(),
    );

  const knownHuman =
    Boolean(latest.authenticated) ||
    isKnownHumanKind(knownKind) ||
    (journey.known && !knownAutomation);

  if (knownHuman) {
    return {
      actorKind: "person",
      actorLabel: latest.authenticated
        ? "Confirmed human"
        : "Known visitor",
      actorSummary: latest.authenticated
        ? "Authenticated AoE2WAR identity is authoritative."
        : "Known identity evidence keeps this journey in the people lane.",
    };
  }

  if (knownAutomation) {
    const family =
      (latest.automation_family || "").trim() ||
      latest.known_visitor_label ||
      "Known automation";

    return {
      actorKind: "automation",
      actorLabel: "Known automation",
      actorSummary:
        "Automation evidence is stronger than the browser-shaped request.",
      networkFamily: family,
    };
  }

  if (isSingaporeCloudEvent(latest)) {
    if (meaningfulEngagement) {
      return {
        actorKind: "person",
        actorLabel: "Cloud/VPN · possible human",
        actorSummary:
          "Cloud-hosted network, but this session shows enough browser engagement to keep it visible as an uncertain person.",
      };
    }

    return {
      actorKind: "network",
      actorLabel: "Cloud network · likely automation",
      actorSummary:
        "Recurring Singapore cloud-browser infrastructure with a thin journey. It may still be a proxy, VPN, or remote browser, so the raw evidence is preserved.",
      networkFamily: "Singapore Cloud Browser Fleet",
    };
  }

  if (journey.isFoldedBurst) {
    const location =
      journey.foldedLocation ||
      latest.city ||
      latest.area ||
      latest.country ||
      "Unknown";

    return {
      actorKind: "network",
      actorLabel: "Network burst · unclear",
      actorSummary:
        "Several thin server-observed visits were clustered together. They are preserved as network evidence rather than promoted as separate people.",
      networkFamily: `${location} server observations`,
    };
  }

  const serverObserved = (latest.session_id || "").startsWith("server:");

  if (serverObserved && !meaningfulEngagement) {
    const location =
      latest.city ||
      latest.area ||
      latest.country ||
      "Unknown";

    return {
      actorKind: "network",
      actorLabel: "Server-only · unclear",
      actorSummary:
        "Seen in the access log without enough browser engagement to call this a person. Could be a human with blocked telemetry, a proxy, or automation.",
      networkFamily: `${location} server observations`,
    };
  }

  if (meaningfulEngagement) {
    return {
      actorKind: "person",
      actorLabel: "Likely human",
      actorSummary:
        "Browser engagement gives this journey enough evidence to keep it in the people lane.",
    };
  }

  return {
    actorKind: "person",
    actorLabel: "Unclear browser",
    actorSummary:
      "Browser-shaped activity, but there is not enough evidence yet to confirm a person.",
  };
}

function storyActorTone(journey: VisitorJourney): string {
  if (journey.actorKind === "automation") {
    return "border-rose-300/30 bg-rose-300/10 text-rose-100";
  }

  if (journey.actorKind === "network") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }

  if ((journey.actorLabel || "").startsWith("Confirmed")) {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  }

  if (
    (journey.actorLabel || "").startsWith("Likely") ||
    (journey.actorLabel || "").startsWith("Cloud/VPN")
  ) {
    return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
  }

  return "border-white/15 bg-white/5 text-white/70";
}

function eventTone(eventType: string): string {
  if (eventType === "auth_presence") return "border-emerald-300/35 bg-emerald-300/12 text-emerald-100";
  if (eventType.includes("click")) return "border-cyan-300/35 bg-cyan-300/12 text-cyan-100";
  if (eventType === "scroll_milestone") return "border-emerald-300/35 bg-emerald-300/12 text-emerald-100";
  if (eventType === "heartbeat") return "border-violet-300/35 bg-violet-300/12 text-violet-100";
  if (eventType === "page_view") return "border-white/15 bg-white/10 text-white";
  return "border-amber-300/35 bg-amber-300/12 text-amber-100";
}

function prettyEventType(eventType: string): string {
  if (eventType === "auth_presence") return "Authenticated";
  if (eventType === "page_view") return "Opened";
  if (eventType === "scroll_milestone") return "Scrolled";
  if (eventType === "heartbeat") return "Still active";
  if (eventType === "visibility_change") return "Tab changed";
  if (eventType === "page_hide") return "Left page";
  if (eventType === "outbound_click") return "Outbound click";
  if (eventType === "click") return "Click";
  return eventType.replace(/_/g, " ");
}

function readableEvent(event: BrowserEventRecord): string {
  if (event.event_type === "auth_presence") {
    return `Authenticated as ${event.known_visitor_label || "player"}`;
  }
  if (event.click_label) return event.click_label;
  if (event.event_type === "scroll_milestone") {
    return `Scrolled to ${event.max_scroll_depth_pct ?? event.scroll_depth_pct ?? "?"}%`;
  }
  if (event.event_type === "heartbeat") return `Still reading ${event.path}`;
  if (event.event_type === "visibility_change") return "Switched tabs / returned";
  if (event.event_type === "page_hide") return "Left the page";
  if (event.event_type === "page_view") return event.title || `Opened ${event.path}`;
  return event.title || event.path;
}

function actionSentence(event: BrowserEventRecord): string {
  if (event.event_type === "auth_presence") return `authenticated as ${event.known_visitor_label || "a player"}`;
  if (event.event_type.includes("click")) return `clicked ${readableEvent(event)}`;
  if (event.event_type === "scroll_milestone") return readableEvent(event).toLowerCase();
  if (event.event_type === "heartbeat") return `is still reading ${event.path}`;
  if (event.event_type === "page_view") return `opened ${event.path}`;
  if (event.event_type === "visibility_change") return "changed browser visibility";
  return readableEvent(event);
}

function shouldHideFromStories(event: BrowserEventRecord): boolean {
  const ip = (event.ip || "").trim();
  const host = (event.host || "").trim().toLowerCase();
  const path = (event.path || "").trim().toLowerCase();

  if (!ip) return true;
  if (!event.authenticated && ["bot", "suspicious"].includes(event.request_classification || "")) {
    return true;
  }

  // obvious Google crawler/browser traffic
  if (ip.startsWith("66.249.")) return true;

  // chain/API endpoint traffic is useful data, but not a human AoE2WAR story
  if (host.startsWith("rpc-") || host.startsWith("rest-")) return true;
  if (
    path === "/rpc" ||
    path.startsWith("/rpc/") ||
    path.startsWith("/rpc-mainnet") ||
    path.startsWith("/rpc-testnet") ||
    path.startsWith("/rest-mainnet") ||
    path.startsWith("/rest-testnet") ||
    path.startsWith("/cosmos/") ||
    path.startsWith("/ibc/") ||
    path.startsWith("/abci_") ||
    path.startsWith("/blockchain") ||
    path.startsWith("/blocks") ||
    path.startsWith("/status") ||
    path.startsWith("/validators") ||
    path.startsWith("/tx_search") ||
    path.startsWith("/broadcast_tx")
  ) {
    return true;
  }

  // keep raw beacon noise out of hero stories
  if (path.startsWith("/_next/") || path.startsWith("/api/")) return true;

  return false;
}

function buildJourneys(events: BrowserEventRecord[]): VisitorJourney[] {
  const groups = new Map<string, BrowserEventRecord[]>();

  for (const event of events) {
    const key = event.session_id || event.visitor_id || event.ip || `event-${event.id}`;
    const existing = groups.get(key) ?? [];
    existing.push(event);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .map(([key, groupEvents]) => {
      const orderedEvents = [...groupEvents].sort((left, right) => {
        const timeDelta =
          new Date(right.received_at).getTime() - new Date(left.received_at).getTime();
        if (timeDelta !== 0) return timeDelta;
        return right.id - left.id;
      });

      const latest = orderedEvents[0];
      const uniquePaths = [...new Set(orderedEvents.map((event) => event.path).filter(Boolean))].slice(0, 5);

      return {
        key,
        latest,
        events: orderedEvents,
        uniquePaths,
        maxScroll: Math.max(
          0,
          ...orderedEvents.map((event) =>
            Number(event.max_scroll_depth_pct || event.scroll_depth_pct || 0),
          ),
        ),
        clicks: orderedEvents.filter((event) => event.event_type.includes("click")).length,
        visibleMs: Math.max(...orderedEvents.map((event) => Number(event.visible_ms || 0)), 0),
        known: Boolean(latest.known_visitor_label),
      };
    })
    .sort(
      (left, right) =>
        new Date(right.latest.received_at).getTime() -
        new Date(left.latest.received_at).getTime(),
    );
}

function foldSyntheticServerBursts(journeys: VisitorJourney[]): VisitorJourney[] {
  const singles: VisitorJourney[] = [];
  const groups = new Map<string, VisitorJourney[]>();

  for (const journey of journeys) {
    const sessionId = (journey.latest.session_id || "").trim();
    const syntheticServerStory = sessionId.startsWith("server:");

    const hasBrowserEngagement =
      journey.clicks > 0 ||
      journey.maxScroll > 0 ||
      journey.visibleMs >= 15_000 ||
      journey.events.some((event) => event.event_type !== "page_view");

    // Tony rule: never hide a known person or an actually engaged browser journey.
    if (!syntheticServerStory || journey.known || hasBrowserEngagement) {
      singles.push(journey);
      continue;
    }

    const city = (journey.latest.city || "").trim();
    const area = (journey.latest.area || "").trim();
    const country = (journey.latest.country || "").trim();
    const countryCode = (journey.latest.country_code || "").trim();

    // Without a meaningful geography, keep the visit individually visible.
    if (!city && !area) {
      singles.push(journey);
      continue;
    }

    const receivedAt = new Date(journey.latest.received_at).getTime();

    if (Number.isNaN(receivedAt)) {
      singles.push(journey);
      continue;
    }

    // Synthetic story IDs already use an hourly server-observation boundary.
    // Mirror that boundary while allowing different cloud IP ranges to collapse
    // into one readable location burst.
    const hourBucket = Math.floor(receivedAt / (60 * 60 * 1000));

    const key = [
      countryCode || country,
      area,
      city,
      hourBucket,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .join("|");

    const existing = groups.get(key) ?? [];
    existing.push(journey);
    groups.set(key, existing);
  }

  const folded: VisitorJourney[] = [];

  for (const [groupKey, group] of groups.entries()) {
    if (group.length < 2) {
      singles.push(...group);
      continue;
    }

    const orderedJourneys = [...group].sort(
      (left, right) =>
        new Date(right.latest.received_at).getTime() -
        new Date(left.latest.received_at).getTime(),
    );

    const latestJourney = orderedJourneys[0];

    const events = orderedJourneys
      .flatMap((journey) => journey.events)
      .sort(
        (left, right) =>
          new Date(right.received_at).getTime() -
            new Date(left.received_at).getTime() ||
          right.id - left.id,
      );

    const uniquePaths = [
      ...new Set(
        orderedJourneys.flatMap((journey) => journey.uniquePaths),
      ),
    ].slice(0, 8);

    const ips = new Set(
      orderedJourneys
        .map((journey) => (journey.latest.ip || "").trim())
        .filter(Boolean),
    );

    folded.push({
      key: `server-burst:${groupKey}`,
      latest: latestJourney.latest,
      events,
      uniquePaths,
      maxScroll: Math.max(...orderedJourneys.map((journey) => journey.maxScroll), 0),
      clicks: orderedJourneys.reduce((total, journey) => total + journey.clicks, 0),
      visibleMs: Math.max(...orderedJourneys.map((journey) => journey.visibleMs), 0),
      known: false,
      isFoldedBurst: true,
      foldedJourneyCount: orderedJourneys.length,
      foldedIpCount: ips.size,
      foldedLocation:
        latestJourney.latest.city ||
        latestJourney.latest.area ||
        latestJourney.latest.country ||
        "Unknown",
    });
  }

  return [...singles, ...folded].sort(
    (left, right) =>
      new Date(right.latest.received_at).getTime() -
      new Date(left.latest.received_at).getTime(),
  );
}


function classifyAndFoldNetworkActors(
  journeys: VisitorJourney[],
): VisitorJourney[] {
  const decorated = journeys.map((journey) => ({
    ...journey,
    ...storyActorForJourney(journey),
  }));

  const people = decorated.filter(
    (journey) => journey.actorKind === "person",
  );

  const networkGroups = new Map<string, VisitorJourney[]>();

  for (const journey of decorated) {
    if (journey.actorKind === "person") continue;

    const family =
      journey.networkFamily ||
      journey.actorLabel ||
      "Network activity";

    const key = family.trim().toLowerCase();
    const existing = networkGroups.get(key) ?? [];
    existing.push(journey);
    networkGroups.set(key, existing);
  }

  const foldedNetwork: VisitorJourney[] = [];

  for (const [groupKey, group] of networkGroups.entries()) {
    const ordered = [...group].sort(
      (left, right) =>
        new Date(right.latest.received_at).getTime() -
        new Date(left.latest.received_at).getTime(),
    );

    const latestJourney = ordered[0];
    const networkFamily =
      latestJourney.networkFamily ||
      latestJourney.actorLabel ||
      "Network activity";

    const events = ordered
      .flatMap((journey) => journey.events)
      .sort(
        (left, right) =>
          new Date(right.received_at).getTime() -
            new Date(left.received_at).getTime() ||
          right.id - left.id,
      );

    const uniquePaths = [
      ...new Set(
        ordered.flatMap((journey) => journey.uniquePaths),
      ),
    ].slice(0, 12);

    const ips = new Set(
      events
        .map((event) => (event.ip || "").trim())
        .filter(Boolean),
    );

    const rawJourneyCount = ordered.reduce(
      (total, journey) =>
        total + (journey.foldedJourneyCount || 1),
      0,
    );

    const automation = ordered.some(
      (journey) => journey.actorKind === "automation",
    );

    foldedNetwork.push({
      ...latestJourney,
      key: `network:${groupKey}`,
      events,
      uniquePaths,
      maxScroll: Math.max(
        ...ordered.map((journey) => journey.maxScroll),
        0,
      ),
      clicks: ordered.reduce(
        (total, journey) => total + journey.clicks,
        0,
      ),
      visibleMs: Math.max(
        ...ordered.map((journey) => journey.visibleMs),
        0,
      ),
      known: false,
      actorKind: automation ? "automation" : "network",
      actorLabel: automation
        ? "Known automation"
        : latestJourney.actorLabel || "Network activity",
      actorSummary:
        `${latestJourney.actorSummary || "Network evidence preserved separately from people."} ` +
        `${rawJourneyCount} journey${rawJourneyCount === 1 ? "" : "s"} folded across ${ips.size || 1} IP${ips.size === 1 ? "" : "s"}.`,
      networkFamily,
      isNetworkActorCluster: true,
      foldedJourneyCount: rawJourneyCount,
      foldedIpCount: ips.size || 1,
      foldedLocation:
        latestJourney.foldedLocation ||
        latestJourney.latest.city ||
        latestJourney.latest.area ||
        latestJourney.latest.country ||
        "Unknown",
    });
  }

  return [...people, ...foldedNetwork].sort(
    (left, right) =>
      new Date(right.latest.received_at).getTime() -
      new Date(left.latest.received_at).getTime(),
  );
}



function mostMeaningfulEvent(journey: VisitorJourney): BrowserEventRecord {
  return (
    journey.events.find((event) => event.event_type.includes("click")) ||
    journey.events.find((event) => event.event_type === "page_view") ||
    journey.events.find((event) => event.event_type === "scroll_milestone") ||
    journey.latest
  );
}

export default function AdminBrowserEventsCard() {
  const [events, setEvents] = useState<BrowserEventRecord[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const scrollHostRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [storyFilter, setStoryFilter] = useState<StoryFilter>("all");
  const [showNetworkActivity, setShowNetworkActivity] = useState(false);
  const [timelineDepthByJourney, setTimelineDepthByJourney] = useState<Record<string, number>>({});

  async function loadEvents(options?: { quiet?: boolean; append?: boolean; before?: string | null }) {
    const append = Boolean(options?.append);
    if (append) {
      setLoadingMore(true);
    } else if (!options?.quiet) {
      setBusy(true);
    }
    setError("");

    try {
      const search = new URLSearchParams({
        project_slug: "aoe2hdbets",
        since_hours: "24",
        limit: "80",
      });

      if (options?.before) {
        search.set("before_received_at", options.before);
      }

      const response = await fetch(`/admin-api/browser-events/recent?${search.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not load browser behavior events.");
      }

      const payload = (await response.json()) as BrowserEventsResponse;
      const payloadNextBefore = payload.next_before_received_at ?? null;

      setNextBefore((current) => {
        if (append) return payloadNextBefore;
        if (!options?.quiet) return payloadNextBefore;
        if (!current) return payloadNextBefore;
        if (!payloadNextBefore) return current;

        const currentTime = new Date(current).getTime();
        const payloadTime = new Date(payloadNextBefore).getTime();

        if (Number.isNaN(currentTime) || Number.isNaN(payloadTime)) {
          return current;
        }

        // Quiet refreshes pull the newest page. Keep the older cursor so scroll-back
        // pagination does not jump forward and forget already loaded older stories.
        return payloadTime < currentTime ? payloadNextBefore : current;
      });

      setHasMore(Boolean(payload.has_more || nextBefore));

      setEvents((current) => {
        const preserveExisting = append || Boolean(options?.quiet);
        const merged = preserveExisting ? [...current, ...payload.events] : payload.events;
        const byId = new Map<number, BrowserEventRecord>();
        for (const event of merged) {
          byId.set(event.id, event);
        }
        return Array.from(byId.values()).sort(
          (left, right) =>
            new Date(right.received_at).getTime() - new Date(left.received_at).getTime() ||
            right.id - left.id,
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load browser behavior events.");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else if (!options?.quiet) {
        setBusy(false);
      }
    }
  }

  function loadMoreStories() {
    if (!nextBefore || loadingMore) return;
    void loadEvents({ append: true, before: nextBefore });
  }

  function timelineVisibleCountFor(journeyKey: string): number {
    return timelineDepthByJourney[journeyKey] ?? DEFAULT_TIMELINE_VISIBLE_EVENTS;
  }

  function loadMoreJourneyTimeline(journey: VisitorJourney) {
    setTimelineDepthByJourney((current) => {
      const currentCount = current[journey.key] ?? DEFAULT_TIMELINE_VISIBLE_EVENTS;
      return {
        ...current,
        [journey.key]: currentCount + TIMELINE_LOAD_STEP,
      };
    });

    // If this card has consumed all currently loaded rows for this visitor,
    // ask the 24h story feed for the next older page too.
    if (hasMore && !loadingMore && !busy && nextBefore) {
      void loadEvents({ append: true, before: nextBefore });
    }
  }

  function handleJourneyTimelineScroll(
    event: UIEvent<HTMLDivElement>,
    journey: VisitorJourney,
  ) {
    const node = event.currentTarget;
    const nearBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 80;
    if (!nearBottom) return;

    const visibleCount = timelineVisibleCountFor(journey.key);
    const localHasMore = visibleCount < journey.events.length;

    if (localHasMore || hasMore) {
      loadMoreJourneyTimeline(journey);
    }
  }

  useEffect(() => {
    setShowFull(loadStoredBoolean(TRAFFIC_ADMIN_BEHAVIOR_FULL_KEY, false));
    void loadEvents();

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void loadEvents({ quiet: true });
    }, 60000);

    const onVisibility = () => {
      if (!document.hidden) void loadEvents({ quiet: true });
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    storeBoolean(TRAFFIC_ADMIN_BEHAVIOR_FULL_KEY, showFull);
  }, [showFull]);

  useEffect(() => {
    const root = scrollHostRef.current;
    const sentinel = loadMoreSentinelRef.current;

    if (!root || !sentinel || !hasMore || loadingMore || busy || !nextBefore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const shouldLoad = entries.some((entry) => entry.isIntersecting);
        if (shouldLoad && !loadingMore && !busy && nextBefore) {
          void loadEvents({ append: true, before: nextBefore });
        }
      },
      {
        root,
        rootMargin: "900px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loadingMore, busy, nextBefore]);

  const storyEvents = useMemo(
    () => events.filter((event) => !shouldHideFromStories(event)),
    [events],
  );

  const allJourneys = useMemo(
    () =>
      classifyAndFoldNetworkActors(
        foldSyntheticServerBursts(
          buildJourneys(storyEvents),
        ),
      ),
    [storyEvents],
  );

  const peopleJourneys = useMemo(
    () =>
      allJourneys.filter(
        (journey) => journey.actorKind === "person",
      ),
    [allJourneys],
  );

  const networkJourneys = useMemo(
    () =>
      allJourneys.filter(
        (journey) => journey.actorKind !== "person",
      ),
    [allJourneys],
  );

  const filteredJourneys = useMemo(() => {
    if (storyFilter === "known") {
      return peopleJourneys.filter((journey) => journey.known);
    }
    if (storyFilter === "unknown") {
      return peopleJourneys.filter((journey) => !journey.known);
    }
    return peopleJourneys;
  }, [peopleJourneys, storyFilter]);

  const visibleJourneys = showFull
    ? filteredJourneys.slice(0, 24)
    : filteredJourneys.slice(0, 10);

  const stats = useMemo(() => {
    const peopleEvents = peopleJourneys.flatMap(
      (journey) => journey.events,
    );

    const clicks = peopleEvents.filter(
      (event) => event.event_type.includes("click"),
    ).length;

    const maxScroll = Math.max(
      0,
      ...peopleEvents.map((event) =>
        Number(
          event.max_scroll_depth_pct ||
            event.scroll_depth_pct ||
            0,
        ),
      ),
    );

    const knownNames = peopleJourneys.filter(
      (journey) => journey.known,
    ).length;

    const networkSignals = networkJourneys.reduce(
      (total, journey) => total + journey.events.length,
      0,
    );

    const networkIps = new Set(
      networkJourneys.flatMap((journey) =>
        journey.events
          .map((event) => (event.ip || "").trim())
          .filter(Boolean),
      ),
    ).size;

    return {
      storyCount: filteredJourneys.length,
      knownNames,
      clicks,
      maxScroll,
      networkActors: networkJourneys.length,
      networkSignals,
      networkIps,
    };
  }, [
    peopleJourneys,
    filteredJourneys,
    networkJourneys,
  ]);

  return (
    <section className="mt-6 flex lg:max-h-[calc(100vh-6rem)] min-h-[40rem] flex-col lg:overflow-hidden rounded-[34px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_30%),rgba(255,255,255,0.035)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:p-6">
      <div className="flex shrink-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">
            AoE2WAR visitor stories
          </p>
          <h2 className="mt-1 text-4xl font-semibold tracking-tight text-white">
            Who did what?
          </h2>
          <p className="mt-2 max-w-3xl text-base leading-7 text-slate-300">
            People stay prominent. Cloud, server-only and automation-shaped traffic is preserved, labelled, grouped and folded below.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-medium text-white/70">
            {events.length} signals loaded • {stats.networkActors} network groups folded • 24h window
          </span>

          <button
            type="button"
            onClick={() => setShowFull((current) => !current)}
            className={`w-fit cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition ${
              showFull
                ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 bg-black/25 text-white/75 hover:border-cyan-300/35 hover:text-white"
            }`}
          >
            {showFull ? "Lean stories" : "More stories"}
          </button>

          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={busy}
            className="w-fit cursor-pointer rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-medium text-white/85 transition hover:border-cyan-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap gap-2">
        {([
          ["all", "People"],
          ["known", "Known people"],
          ["unknown", "Unclear people"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStoryFilter(value)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              storyFilter === value
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-white/10 bg-black/20 text-white/70 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["People stories", stats.storyCount],
          ["Known names", stats.knownNames],
          ["Clicks", stats.clicks],
          ["Max scroll", `${stats.maxScroll}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 shrink-0 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div ref={scrollHostRef} className="mt-5 min-h-0 lg:flex-1 space-y-4 lg:overflow-y-auto pr-1">
        {visibleJourneys.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-base text-slate-300">
            No visitor stories match this filter right now.
          </div>
        ) : (
          visibleJourneys.map((journey) => {
            const latest = journey.latest;
            const chosenAction = mostMeaningfulEvent(journey);
            const location = locationLine(latest);
            const timelineVisibleCount = timelineVisibleCountFor(journey.key);
            const timelineEvents = journey.events.slice(0, timelineVisibleCount);
            const timelineHasMore = timelineVisibleCount < journey.events.length || hasMore;

            return (
              <article
                key={journey.key}
                className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] shadow-[0_14px_50px_rgba(0,0,0,0.28)]"
              >
                <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.35),rgba(255,255,255,0.08)_38%,rgba(0,0,0,0.22))] text-4xl shadow-[0_14px_40px_rgba(255,255,255,0.12)]">
                        {countryFlag(latest.country_code)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${storyActorTone(journey)}`}
                          >
                            {journey.actorLabel || "Unclear browser"}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${eventTone(chosenAction.event_type)}`}>
                            {prettyEventType(chosenAction.event_type)}
                          </span>
                          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                            scroll {journey.maxScroll}%
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                            {journey.events.length} signals
                          </span>
                          {journey.visibleMs ? (
                            <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
                              visible {formatMs(journey.visibleMs)}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-2 break-words text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
                          {journey.isFoldedBurst
                            ? `${journey.foldedLocation || "Unknown"} burst`
                            : visitorName(latest)}
                        </h3>

                        <p className="mt-1 break-all font-mono text-sm font-semibold text-cyan-100 sm:text-base">
                          {journey.isFoldedBurst
                            ? `${journey.foldedJourneyCount || journey.events.length} server-observed visits • ${journey.foldedIpCount || 1} IPs`
                            : identityLine(latest)}
                        </p>

                        {location ? (
                          <p className="mt-1 text-sm text-slate-300 sm:text-base">
                            {location}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 rounded-[22px] border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/75">
                        Latest meaningful move
                      </p>
                      <p className="mt-1 text-xl font-semibold text-white">
                        {actionSentence(chosenAction)}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-300">
                        {chosenAction.path}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          Route trail
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {journey.uniquePaths.map((path) => (
                            <span
                              key={path}
                              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-white/75"
                            >
                              {path}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          Quick read
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {journey.isFoldedBurst
                            ? `${journey.foldedLocation || "This location"} produced ${journey.foldedJourneyCount || journey.events.length} server-observed visits across ${journey.foldedIpCount || 1} IPs and ${journey.uniquePaths.length} route${journey.uniquePaths.length === 1 ? "" : "s"}. Individual hits remain available in the timeline.`
                            : journey.clicks > 0
                              ? `${visitorName(latest)} clicked ${journey.clicks} time${journey.clicks === 1 ? "" : "s"} and reached ${journey.maxScroll}% scroll depth.`
                              : `${visitorName(latest)} is browsing with ${journey.events.length} recent signal${journey.events.length === 1 ? "" : "s"}.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <aside className="flex max-h-[34rem] flex-col border-t border-white/10 bg-black/25 p-4 xl:border-l xl:border-t-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                        Timeline
                      </p>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          {formatTimestamp(latest.received_at)}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-600">
                          {Math.min(timelineVisibleCount, journey.events.length)} / {journey.events.length} shown
                        </p>
                      </div>
                    </div>

                    <div
                      onScroll={(event) => handleJourneyTimelineScroll(event, journey)}
                      className="mt-3 min-h-0 lg:flex-1 space-y-2 lg:overflow-y-auto lg:overscroll-contain pr-1"
                    >
                      {timelineEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize ${eventTone(event.event_type)}`}>
                              {prettyEventType(event.event_type)}
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-sm font-medium text-white/80">
                              {formatShortTime(event.received_at)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-5 text-white">
                            {readableEvent(event)}
                          </p>
                          <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                            {event.path}
                          </p>
                        </div>
                      ))}

                      {timelineHasMore ? (
                        <button
                          type="button"
                          onClick={() => loadMoreJourneyTimeline(journey)}
                          disabled={loadingMore}
                          className="w-full rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loadingMore ? "Loading older signals..." : "Load more of this journey"}
                        </button>
                      ) : (
                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-2 text-center text-xs text-slate-500">
                          Full loaded journey shown
                        </div>
                      )}
                    </div>

                    <div className="mt-3 shrink-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-slate-400">
                      <p className="text-white/85">{displayIp(latest.ip)}</p>
                      <p>session {shortSession(latest.session_id)}</p>
                      <p>{latest.viewport_width || 0}×{latest.viewport_height || 0}</p>
                    </div>
                  </aside>
                </div>
              </article>
            );
          })
        )}

        {networkJourneys.length > 0 ? (
          <div className="overflow-hidden rounded-[26px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.07),rgba(255,255,255,0.025))]">
            <button
              type="button"
              onClick={() =>
                setShowNetworkActivity(
                  (current) => !current,
                )
              }
              aria-expanded={showNetworkActivity}
              className="flex w-full cursor-pointer flex-col gap-3 p-4 text-left transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.26em] text-amber-200/75">
                  Network & automation activity
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {stats.networkActors} folded actor group{stats.networkActors === 1 ? "" : "s"} · {stats.networkSignals} signals · {stats.networkIps} IP{stats.networkIps === 1 ? "" : "s"}
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                  Preserved evidence that is too uncertain, server-only, cloud-hosted or automation-shaped to present as separate people.
                </p>
              </div>

              <span className="shrink-0 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100">
                {showNetworkActivity
                  ? "Hide activity"
                  : "Show activity"}
              </span>
            </button>

            {showNetworkActivity ? (
              <div className="border-t border-amber-300/15 p-3 sm:p-4">
                <div className="grid gap-3 xl:grid-cols-2">
                  {networkJourneys
                    .slice(0, 12)
                    .map((journey) => {
                      const latest = journey.latest;
                      const chosenAction =
                        mostMeaningfulEvent(journey);
                      const location =
                        locationLine(latest);
                      const memberCount =
                        journey.foldedJourneyCount || 1;
                      const ipCount =
                        journey.foldedIpCount || 1;

                      return (
                        <div
                          key={journey.key}
                          className="rounded-[20px] border border-white/10 bg-black/25 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${storyActorTone(journey)}`}
                            >
                              {journey.actorLabel ||
                                "Network activity"}
                            </span>

                            <span className="text-xs text-slate-500">
                              latest{" "}
                              {formatShortTime(
                                latest.received_at,
                              )}
                            </span>
                          </div>

                          <h4 className="mt-2 text-lg font-semibold text-white">
                            {journey.networkFamily ||
                              journey.foldedLocation ||
                              visitorName(latest)}
                          </h4>

                          <p className="mt-1 text-sm leading-6 text-slate-400">
                            {journey.actorSummary}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/65">
                              {memberCount} journey{memberCount === 1 ? "" : "s"}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/65">
                              {ipCount} IP{ipCount === 1 ? "" : "s"}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/65">
                              {journey.events.length} signals
                            </span>
                          </div>

                          {location ? (
                            <p className="mt-3 text-xs text-slate-500">
                              {location}
                            </p>
                          ) : null}

                          <p className="mt-2 break-all font-mono text-[11px] text-slate-500">
                            {chosenAction.path}
                          </p>
                        </div>
                      );
                    })}
                </div>

                {networkJourneys.length > 12 ? (
                  <p className="mt-3 text-center text-xs text-slate-500">
                    {networkJourneys.length - 12} additional folded network groups remain outside this compact preview.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={loadMoreSentinelRef} className="h-8 rounded-full border border-white/5 bg-white/[0.02]" />
      </div>

      <div className="mt-4 flex shrink-0 flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          {hasMore
            ? "Scroll to the bottom to auto-load older AoE2WAR visitor stories from the previous 24 hours."
            : "You are caught up for the loaded 24-hour behavior window."}
        </p>
        <button
          type="button"
          onClick={loadMoreStories}
          disabled={!hasMore || loadingMore}
          className="w-full cursor-pointer rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35 sm:w-auto"
        >
          {loadingMore ? "Loading stories..." : hasMore ? "Load more stories" : "No more stories"}
        </button>
      </div>
    </section>
  );
}
