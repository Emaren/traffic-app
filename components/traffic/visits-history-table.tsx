"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchVisitsHistory } from "@/components/traffic/api";
import type { SessionRecord, VisitsHistoryResponse } from "@/components/traffic/types";

const PAGE_SIZE = 25;

function formatSeconds(total: number): string {
  if (total <= 0) return "0s";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function stateClasses(state: string): string {
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

export default function VisitsHistoryTable() {
  const [data, setData] = useState<VisitsHistoryResponse | null>(null);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [classification, setClassification] = useState("");
  const [project, setProject] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await fetchVisitsHistory({
          limit: PAGE_SIZE,
          offset,
          classification: classification || undefined,
          project: project || undefined,
          windowHours: 24,
        });

        if (!mounted) return;
        setData(next);
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load visits history");
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [offset, classification, project]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  }, [data]);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const items: SessionRecord[] = data?.items ?? [];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Visits History</h2>
          <p className="text-sm text-white/60">
            Archive of human, candidate, bot, and suspicious visit sessions.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-white/55">
            Classification
            <select
              value={classification}
              onChange={(e) => {
                setOffset(0);
                setClassification(e.target.value);
              }}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All</option>
              <option value="human_confirmed">Human confirmed</option>
              <option value="likely_human">Likely human</option>
              <option value="candidate">Candidate</option>
              <option value="bot">Bot</option>
              <option value="suspicious">Suspicious</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-white/55">
            Project
            <select
              value={project}
              onChange={(e) => {
                setOffset(0);
                setProject(e.target.value);
              }}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">All</option>
              <option value="aoe2hdbets">AoE2HDBets</option>
              <option value="tokentap">TokenTap</option>
              <option value="wheatandstone">Wheat &amp; Stone</option>
              <option value="tmail">TMail</option>
              <option value="pulse">Pulse</option>
              <option value="vps-sentry">VPSSentry</option>
              <option value="traffic">Traffic</option>
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-white/45">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Journey</th>
              <th className="px-3 py-2">Human</th>
              <th className="px-3 py-2">Quality</th>
              <th className="px-3 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.session_id} className="rounded-2xl bg-black/20 text-sm text-white/85">
                <td className="rounded-l-2xl px-3 py-3 align-top text-white/70">
                  <div>{row.first_seen_alberta}</div>
                  <div className="mt-1 text-xs text-white/45">last: {row.last_seen_alberta}</div>
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="font-medium">{row.project_name}</div>
                  <div className="mt-1 text-xs text-white/45">{row.host}</div>
                </td>
                <td className="px-3 py-3 align-top">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${stateClasses(
                      row.classification_state,
                    )}`}
                  >
                    {row.classification_state.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="px-3 py-3 align-top text-white/70">
                  <div>{row.city || "Unknown city"}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {[row.area, row.country].filter(Boolean).join(", ")}
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="font-medium">
                    {row.entry_page} → {row.exit_page}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {row.page_count} pages • {row.event_count} events
                  </div>
                </td>
                <td className="px-3 py-3 align-top">{row.human_confidence}</td>
                <td className="px-3 py-3 align-top">{row.quality_score}</td>
                <td className="rounded-r-2xl px-3 py-3 align-top text-white/70">
                  <div>{formatSeconds(row.total_seconds)}</div>
                  <div className="mt-1 text-xs text-white/45">
                    engaged {formatSeconds(row.engaged_seconds)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-white/55">
          Page {currentPage} of {totalPages}
          {data ? ` • ${data.total} total sessions` : ""}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
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
            className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
