"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchVisitsHistory } from "@/components/traffic/api";
import { withFlag } from "@/components/traffic/display";
import type {
  HistoryRangeKey,
  ProjectFilterOption,
  SessionRecord,
  VisitsHistoryResponse,
} from "@/components/traffic/types";
import {
  TRAFFIC_HIDDEN_IPS_KEY,
  loadStoredString,
  loadStoredStringArray,
  reconcileSelectedValues,
  storeString,
  storeStringArray,
  TRAFFIC_HISTORY_CLASSIFICATION_KEY,
  TRAFFIC_SHARED_PROJECT_FILTER_KEY,
} from "@/components/traffic/view-preferences";

const PAGE_SIZE = 25;
const POLL_MS = 15000;
const RANGE_OPTIONS: Array<{ key: HistoryRangeKey; label: string }> = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "1 Week" },
  { key: "30d", label: "1 Month" },
  { key: "all", label: "All Time" },
];

function formatSeconds(total: number): string {
  if (total <= 0) return "0s";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function verdictClass(state: string): string {
  switch (state) {
    case "human_confirmed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "likely_human":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "candidate":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "bot":
      return "border-violet-400/30 bg-violet-400/10 text-violet-200";
    case "suspicious":
      return "border-red-400/30 bg-red-400/10 text-red-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function dataConfidenceClass(label: string): string {
  switch (label) {
    case "High":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "Good":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    case "Limited":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  }
}

function pillClass(isActive: boolean): string {
  return isActive
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : "border-white/10 bg-black/20 text-white/65 hover:border-white/20 hover:text-white";
}

function MobileVisitCard({
  row,
  isFresh,
  onHideIp,
}: {
  row: SessionRecord;
  isFresh: boolean;
  onHideIp: (ip: string) => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        isFresh
          ? "border-amber-400/35 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.3)]"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
          {row.first_seen_alberta}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 font-medium ${verdictClass(
            row.classification_state,
          )}`}
        >
          {row.verdict_label}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 ${dataConfidenceClass(
            row.data_confidence_label,
          )}`}
        >
          {row.data_confidence_label}
        </span>
        {isFresh ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-semibold text-amber-200">
            New
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        <div className="font-medium text-white">{withFlag(row.country_code, row.visitor_alias)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <div className="font-mono text-xs text-sky-200/80 break-all">IP {row.ip}</div>
          <button
            type="button"
            onClick={() => onHideIp(row.ip)}
            className="cursor-pointer rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition hover:bg-amber-400/15"
          >
            Hide IP
          </button>
        </div>
        <div className="mt-1 text-xs text-white/45">
          {row.city || "Unknown city"}
          {row.area ? `, ${row.area}` : ""}
          {row.country ? `, ${row.country}` : ""}
        </div>
        <div className="mt-1 text-xs text-white/45">
          {row.device} • {row.os} • {row.browser}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="text-xs uppercase tracking-wide text-white/45">Project</div>
        <div className="mt-2 text-sm font-medium text-white">{row.project_name}</div>
        <div className="mt-1 break-all text-xs text-white/45">{row.host}</div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="text-xs uppercase tracking-wide text-white/45">Why</div>
        <div className="mt-2 text-sm text-white/80">{row.classification_summary}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {row.classification_reason_labels.slice(0, 3).map((reason) => (
            <span
              key={`${row.session_id}-${reason}`}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60"
            >
              {reason}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="text-xs uppercase tracking-wide text-white/45">Journey</div>
          <div className="mt-2 break-all text-sm text-white/80">
            {row.entry_page} → {row.exit_page}
          </div>
          <div className="mt-2 text-xs text-white/45">
            {row.page_count} pages • {row.event_count} events
          </div>
          <div className="mt-1 text-xs text-white/45">source: {row.source || "direct"}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="text-xs uppercase tracking-wide text-white/45">Visits and time</div>
          <div className="mt-2 text-sm text-white/80">
            Times Returned: {row.times_returned_in_project}
          </div>
          <div className="mt-1 text-xs text-white/45">
            Total Project Visits: {row.total_project_visits}
          </div>
          <div className="mt-1 text-xs text-white/45">Traffic Visits: {row.visits_in_window}</div>
          <div className="mt-2 text-sm text-white/80">{formatSeconds(row.total_seconds)} total</div>
          <div className="mt-1 text-xs text-white/45">
            engaged {formatSeconds(row.engaged_seconds)} • {row.attention_label} attention
          </div>
          <div className="mt-2 text-xs text-white/45">last movement {row.last_seen_alberta}</div>
        </div>
      </div>
    </div>
  );
}

export default function VisitsHistoryTable() {
  const [data, setData] = useState<VisitsHistoryResponse | null>(null);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [rangeKey, setRangeKey] = useState<HistoryRangeKey>("all");
  const [classification, setClassification] = useState(() =>
    loadStoredString(TRAFFIC_HISTORY_CLASSIFICATION_KEY),
  );
  const [selectedProjects, setSelectedProjects] = useState<string[]>(() =>
    loadStoredStringArray(TRAFFIC_SHARED_PROJECT_FILTER_KEY),
  );
  const [hiddenIps, setHiddenIps] = useState<string[]>(() =>
    loadStoredStringArray(TRAFFIC_HIDDEN_IPS_KEY),
  );
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const previousIdsRef = useRef<string[]>([]);
  const clearFreshTimerRef = useRef<number | null>(null);

  const availableProjects = useMemo<ProjectFilterOption[]>(
    () => data?.available_projects ?? [],
    [data?.available_projects],
  );
  const availableProjectSlugs = useMemo(
    () => availableProjects.map((project) => project.slug),
    [availableProjects],
  );
  const effectiveSelectedProjects = useMemo(
    () => reconcileSelectedValues(selectedProjects, availableProjectSlugs),
    [availableProjectSlugs, selectedProjects],
  );
  const appliedProjects = useMemo(() => {
    if (availableProjectSlugs.length === 0) return undefined;
    if (
      effectiveSelectedProjects.length === 0 ||
      effectiveSelectedProjects.length === availableProjectSlugs.length
    ) {
      return undefined;
    }
    return effectiveSelectedProjects;
  }, [availableProjectSlugs.length, effectiveSelectedProjects]);
  const allProjectsSelected =
    availableProjectSlugs.length > 0 &&
    effectiveSelectedProjects.length === availableProjectSlugs.length;

  useEffect(() => {
    storeString(TRAFFIC_HISTORY_CLASSIFICATION_KEY, classification);
  }, [classification]);

  useEffect(() => {
    if (availableProjectSlugs.length === 0) return;
    storeStringArray(TRAFFIC_SHARED_PROJECT_FILTER_KEY, effectiveSelectedProjects);
  }, [availableProjectSlugs.length, effectiveSelectedProjects]);

  useEffect(() => {
    storeStringArray(TRAFFIC_HIDDEN_IPS_KEY, hiddenIps);
  }, [hiddenIps]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await fetchVisitsHistory({
          limit: PAGE_SIZE,
          offset,
          classification: classification || undefined,
          projects: appliedProjects,
          rangeKey,
        });

        if (!mounted) return;

        if (offset === 0) {
          const previousIds = new Set(previousIdsRef.current);
          const nextFreshIds = next.items
            .map((item) => item.session_id)
            .filter((id) => previousIds.size > 0 && !previousIds.has(id));

          setFreshIds(nextFreshIds);
          if (clearFreshTimerRef.current) {
            window.clearTimeout(clearFreshTimerRef.current);
          }
          if (nextFreshIds.length > 0) {
            clearFreshTimerRef.current = window.setTimeout(() => setFreshIds([]), 5000);
          }
          previousIdsRef.current = next.items.map((item) => item.session_id);
        }

        setData(next);
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load visits history");
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      if (clearFreshTimerRef.current) {
        window.clearTimeout(clearFreshTimerRef.current);
      }
    };
  }, [appliedProjects, classification, offset, rangeKey]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  }, [data]);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const visibleItems = useMemo(
    () => (data?.items ?? []).filter((row) => !hiddenIps.includes(row.ip)),
    [data?.items, hiddenIps],
  );

  const toggleProject = (slug: string) => {
    setOffset(0);
    previousIdsRef.current = [];
    setFreshIds([]);
    setSelectedProjects((current) => {
      const currentSet = new Set(reconcileSelectedValues(current, availableProjectSlugs));
      if (currentSet.has(slug)) {
        currentSet.delete(slug);
      } else {
        currentSet.add(slug);
      }
      return reconcileSelectedValues([...currentSet], availableProjectSlugs);
    });
  };

  const hideIp = (ip: string) => {
    setHiddenIps((current) => (current.includes(ip) ? current : [...current, ip]));
  };

  const unhideIp = (ip: string) => {
    setHiddenIps((current) => current.filter((value) => value !== ip));
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            Live refresh every 15s
          </div>
          <h2 className="text-2xl font-semibold text-white">Visits History</h2>
          <p className="text-sm text-white/60">
            Newest sessions stay at the top. This archive now reaches through stored history instead
            of pretending everything older than a day is gone.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto">
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => {
              const isActive = (data?.range_key ?? rangeKey) === option.key;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setOffset(0);
                    previousIdsRef.current = [];
                    setFreshIds([]);
                    setRangeKey(option.key);
                  }}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex w-full flex-col gap-1 text-xs text-white/55 sm:w-auto">
              Verdict
              <select
                value={classification}
                onChange={(e) => {
                  setOffset(0);
                  previousIdsRef.current = [];
                  setFreshIds([]);
                  setClassification(e.target.value);
                }}
                className="w-full cursor-pointer rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none sm:w-auto"
              >
                <option value="">All</option>
                <option value="human_confirmed">Likely human</option>
                <option value="likely_human">Probably human</option>
                <option value="candidate">Unclear</option>
                <option value="bot">Known bot</option>
                <option value="suspicious">Suspicious</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Project Filter</div>
            <div className="mt-1 text-sm text-white/60">
              All projects stay selected by default, and these choices are shared with the live feed.
            </div>
          </div>
          <div className="text-xs text-white/50">
            {effectiveSelectedProjects.length || availableProjectSlugs.length} of {availableProjectSlugs.length || 0} selected
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setOffset(0);
              previousIdsRef.current = [];
              setFreshIds([]);
              setSelectedProjects([...availableProjectSlugs]);
            }}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
              allProjectsSelected,
            )}`}
          >
            All projects
          </button>
          {availableProjects.map((project) => {
            const active = effectiveSelectedProjects.includes(project.slug);

            return (
              <button
                key={project.slug}
                type="button"
                onClick={() => toggleProject(project.slug)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${pillClass(
                  active,
                )}`}
              >
                {project.name}
              </button>
            );
          })}
        </div>

        {hiddenIps.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.22em] text-amber-200/80">Hidden IPs</div>
              <button
                type="button"
                onClick={() => setHiddenIps([])}
                className="cursor-pointer rounded-full border border-amber-400/30 bg-black/20 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-black/30"
              >
                Clear all
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {hiddenIps.map((ip) => (
                <button
                  key={ip}
                  type="button"
                  onClick={() => unhideIp(ip)}
                  className="cursor-pointer rounded-full border border-amber-400/30 bg-black/20 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-black/30"
                >
                  {ip} ×
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
          {data?.coverage_mode === "durable_store" ? "Durable history" : "Live log fallback"}
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
          {data?.range_label ?? "All Time"}
        </div>
        {data?.coverage_started_alberta ? (
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/70">
            Stored since {data.coverage_started_alberta}
          </div>
        ) : null}
        {hiddenIps.length > 0 ? (
          <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-medium text-amber-200">
            {hiddenIps.length} hidden IPs
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {data?.note ? (
        <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
          {data.note}
        </div>
      ) : null}

      <div className="space-y-3 md:hidden">
        {visibleItems.map((row) => {
          const isFresh = freshIds.includes(row.session_id);

          return <MobileVisitCard key={row.session_id} row={row} isFresh={isFresh} onHideIp={hideIp} />;
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-white/45">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Visitor</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Verdict</th>
              <th className="px-3 py-2">Why</th>
              <th className="px-3 py-2">Journey</th>
              <th className="px-3 py-2">Visits</th>
              <th className="px-3 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((row) => {
              const isFresh = freshIds.includes(row.session_id);

              return (
                <tr
                  key={row.session_id}
                  className={`rounded-2xl text-white/85 transition ${
                    isFresh
                      ? "bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
                      : "bg-black/20"
                  }`}
                >
                  <td className="rounded-l-2xl px-3 py-3 align-top text-white/70">
                    <div>{row.first_seen_alberta}</div>
                    <div className="mt-1 text-xs text-white/45">last: {row.last_seen_alberta}</div>
                    {isFresh ? (
                      <div className="mt-2 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        New
                      </div>
                    ) : null}
                  </td>

                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-white">
                      {withFlag(row.country_code, row.visitor_alias)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <div className="font-mono text-xs text-sky-200/80">IP {row.ip}</div>
                      <button
                        type="button"
                        onClick={() => hideIp(row.ip)}
                        className="cursor-pointer rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition hover:bg-amber-400/15"
                      >
                        Hide IP
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {row.city || "Unknown city"}
                      {row.area ? `, ${row.area}` : ""}
                      {row.country ? `, ${row.country}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {row.device} • {row.os} • {row.browser}
                    </div>
                  </td>

                  <td className="px-3 py-3 align-top">
                    <div className="font-medium">{row.project_name}</div>
                    <div className="mt-1 text-xs text-white/45">{row.host}</div>
                  </td>

                  <td className="px-3 py-3 align-top">
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${verdictClass(
                        row.classification_state,
                      )}`}
                    >
                      {row.verdict_label}
                    </div>
                    <div className="mt-2 text-xs text-white/60">
                      Human likelihood {row.human_confidence}%
                    </div>
                    <div
                      className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] ${dataConfidenceClass(
                        row.data_confidence_label,
                      )}`}
                    >
                      Data confidence: {row.data_confidence_label}
                    </div>
                  </td>

                  <td className="px-3 py-3 align-top">
                    <div className="max-w-[320px] text-sm text-white/80">{row.classification_summary}</div>
                    <div className="mt-2 flex max-w-[340px] flex-wrap gap-1.5">
                      {row.classification_reason_labels.slice(0, 3).map((reason) => (
                        <span
                          key={`${row.session_id}-${reason}`}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-3 py-3 align-top">
                    <div className="font-medium">
                      {row.entry_page} → {row.exit_page}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {row.page_count} pages • {row.event_count} events
                    </div>
                    <div className="mt-1 text-xs text-white/45">source: {row.source || "direct"}</div>
                  </td>

                  <td className="px-3 py-3 align-top text-white/70">
                    <div>Times Returned: {row.times_returned_in_project}</div>
                    <div className="mt-1 text-xs text-white/45">
                      Total Project Visits: {row.total_project_visits}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      Traffic Visits: {row.visits_in_window}
                    </div>
                  </td>

                  <td className="rounded-r-2xl px-3 py-3 align-top text-white/70">
                    <div>{formatSeconds(row.total_seconds)}</div>
                    <div className="mt-1 text-xs text-white/45">
                      engaged {formatSeconds(row.engaged_seconds)}
                    </div>
                    <div className="mt-1 text-xs text-white/45">{row.attention_label} attention</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-white/55">
          Page {currentPage} of {totalPages}
          {data ? ` • ${visibleItems.length} visible on this page • ${data.total} total sessions in this ${data.range_label.toLowerCase()}` : ""}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="cursor-pointer rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => {
              if (data && offset + PAGE_SIZE < data.total) {
                setOffset(offset + PAGE_SIZE);
              }
            }}
            disabled={!data || offset + PAGE_SIZE >= data.total}
            className="cursor-pointer rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
