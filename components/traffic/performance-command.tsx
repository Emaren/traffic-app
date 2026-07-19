"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type MetricSummary = { count: number; p50: number | null; p75: number | null; p95: number | null; min: number | null; max: number | null };
type RouteSummary = { route_group: string; samples: number; slow_samples: number; ready: MetricSummary; lcp: MetricSummary };
type BuildSummary = { build_version: string; samples: number; slow_samples: number; ready: MetricSummary; lcp: MetricSummary };
type PerformanceOverview = {
  ok: boolean; generated_at: string; samples: number; valid_samples: number; invalid_samples: number; slow_samples: number;
  metrics: Record<string, MetricSummary>; routes: RouteSummary[]; builds: BuildSummary[];
  reports: { open: number; reviewed: number; resolved: number };
};
type PerformanceSample = {
  sample_id: string; received_at: string; occurred_at: string; route: string; route_group: string; build_version: string;
  traffic_visitor_id: string; traffic_session_id: string; journey_session_id: string; user_uid: string; user_display_name: string;
  navigation_kind: string; navigation_start_source: string; ready_source: string; ready_ms: number | null; ttfb_ms: number | null;
  fcp_ms: number | null; lcp_ms: number | null; inp_ms: number | null; cls: number | null; slowest_api_path: string; slowest_api_ms: number | null;
  effective_connection_type: string; connection_rtt_ms: number | null; downlink_mbps: number | null; valid_for_aggregation: boolean; invalid_reason: string;
  details?: { top_resources?: TimingItem[]; top_api_requests?: TimingItem[]; navigation_timing?: Record<string, number | null>; long_tasks?: Array<{ start_ms: number; duration_ms: number }> };
};
type TimingItem = { name: string; duration_ms: number | null; transfer_bytes: number | null; initiator_type: string };
type SpeedReport = {
  report_id: string; created_at: string; sample_id: string; route: string; build_version: string; user_uid: string; user_display_name: string; status: string;
  diagnostic_snapshot: Record<string, unknown>; recent_sample_ids: string[];
};

function duration(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)} s`;
}
function when(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(); }
async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.detail || `Request failed (${response.status})`);
  return payload as T;
}

export default function PerformanceCommand() {
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [samples, setSamples] = useState<PerformanceSample[]>([]);
  const [reports, setReports] = useState<SpeedReport[]>([]);
  const [selected, setSelected] = useState<PerformanceSample | null>(null);
  const [hours, setHours] = useState("24");
  const [userQuery, setUserQuery] = useState("");
  const [route, setRoute] = useState("");
  const [slowOnly, setSlowOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const sampleSearch = new URLSearchParams({ project_slug: "aoe2hdbets", since_hours: hours, limit: "120" });
      if (userQuery.trim()) sampleSearch.set("user_query", userQuery.trim());
      if (route.trim()) sampleSearch.set("route", route.trim());
      if (slowOnly) sampleSearch.set("slow_only", "true");
      const [nextOverview, nextSamples, nextReports] = await Promise.all([
        getJson<PerformanceOverview>(`/admin-api/performance/overview?project_slug=aoe2hdbets&since_hours=${hours}`),
        getJson<{ samples: PerformanceSample[] }>(`/admin-api/performance/samples?${sampleSearch}`),
        getJson<{ reports: SpeedReport[] }>("/admin-api/performance/reports?project_slug=aoe2hdbets&limit=60"),
      ]);
      setOverview(nextOverview); setSamples(nextSamples.samples || []); setReports(nextReports.reports || []);
      if (selected && !(nextSamples.samples || []).some((sample) => sample.sample_id === selected.sample_id)) setSelected(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load Performance Command"); }
    finally { setLoading(false); }
  }, [hours, route, selected, slowOnly, userQuery]);

  // Initial load intentionally uses mount-time defaults; later filter changes submit explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  const selectSample = useCallback(async (sampleId: string) => {
    try {
      const payload = await getJson<{ sample: PerformanceSample }>(`/admin-api/performance/samples/${encodeURIComponent(sampleId)}`);
      setSelected(payload.sample);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load sample detail"); }
  }, []);

  const updateReport = useCallback(async (reportId: string, status: "reviewed" | "resolved") => {
    try {
      await getJson(`/admin-api/performance/reports/${encodeURIComponent(reportId)}/status`, { method: "POST", body: JSON.stringify({ status }) });
      setReports((current) => current.map((report) => report.report_id === reportId ? { ...report, status } : report));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update report"); }
  }, []);

  const applyFilters = (event: FormEvent) => { event.preventDefault(); void load(); };
  const ready = overview?.metrics?.ready_ms;
  const openReports = overview?.reports?.open ?? reports.filter((report) => report.status === "open").length;
  const selectedApis = selected?.details?.top_api_requests || [];
  const selectedResources = selected?.details?.top_resources || [];
  const topRoutes = useMemo(() => overview?.routes?.slice(0, 12) || [], [overview]);

  return (
    <main className="traffic-admin-scroll-root min-h-screen overflow-x-clip bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
        <header className="rounded-[32px] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-200/75">Traffic · AoE2WAR</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Performance Command</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Search a real user, inspect exact route readiness, compare builds, open rich diagnostics, and triage one-click Speed Reports.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin" className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/15">Notification cockpit</Link>
              <Link href="/" className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70 transition hover:text-white">Traffic home</Link>
              <button type="button" onClick={() => void load()} disabled={loading} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80 transition hover:border-white/20 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
            </div>
          </div>
          {error ? <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</div> : null}
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Valid samples", overview?.valid_samples ?? "—", "Aggregation-eligible RUM"],
            ["Ready p50", duration(ready?.p50), "Median authoritative/fallback mix"],
            ["Ready p75", duration(ready?.p75), "Primary operator target"],
            ["Ready p95", duration(ready?.p95), "Tail experience"],
            ["Open reports", openReports, "User-submitted Speed Reports"],
          ].map(([label, value, helper]) => <div key={String(label)} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p><p className="mt-3 text-2xl font-semibold text-white">{String(value)}</p><p className="mt-2 text-xs leading-5 text-white/45">{helper}</p></div>)}
        </section>

        <form onSubmit={applyFilters} className="mt-6 grid gap-3 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1.2fr_1fr_auto_auto_auto] md:items-end">
          <label className="text-xs text-white/45"><span className="mb-2 block uppercase tracking-[0.16em]">User / visitor</span><input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Jim, Emaren, uid, visitor id" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-amber-300/35" /></label>
          <label className="text-xs text-white/45"><span className="mb-2 block uppercase tracking-[0.16em]">Route</span><input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="/rivalries" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-amber-300/35" /></label>
          <label className="text-xs text-white/45"><span className="mb-2 block uppercase tracking-[0.16em]">Window</span><select value={hours} onChange={(e) => setHours(e.target.value)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"><option value="24">24h</option><option value="72">3d</option><option value="168">7d</option><option value="336">14d</option></select></label>
          <label className="flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white/70"><input type="checkbox" checked={slowOnly} onChange={(e) => setSlowOnly(e.target.checked)} /> Slow only</label>
          <button type="submit" className="h-11 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-5 text-sm font-medium text-amber-100 transition hover:bg-amber-300/15">Apply</button>
        </form>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-semibold text-white">Route pressure</h2>
            <p className="mt-1 text-sm text-white/45">Sorted by the slowest p75 Ready paths in the selected window.</p>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="text-xs uppercase tracking-[0.13em] text-white/35"><tr><th className="pb-3">Route</th><th className="pb-3">Samples</th><th className="pb-3">p50</th><th className="pb-3">p75</th><th className="pb-3">p95</th><th className="pb-3">Slow</th></tr></thead><tbody className="divide-y divide-white/7">{topRoutes.map((item) => <tr key={item.route_group}><td className="py-3 font-medium text-white">{item.route_group}</td><td>{item.samples}</td><td>{duration(item.ready.p50)}</td><td>{duration(item.ready.p75)}</td><td>{duration(item.ready.p95)}</td><td>{item.slow_samples}</td></tr>)}</tbody></table></div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-semibold text-white">Build comparison</h2>
            <p className="mt-1 text-sm text-white/45">See immediately whether a deployment moved real-user readiness.</p>
            <div className="mt-4 space-y-3">{(overview?.builds || []).slice(0, 8).map((build) => <div key={build.build_version} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="break-all text-sm font-medium text-white">{build.build_version}</div><div className="mt-2 flex flex-wrap gap-3 text-xs text-white/50"><span>{build.samples} samples</span><span>p50 {duration(build.ready.p50)}</span><span>p75 {duration(build.ready.p75)}</span><span>p95 {duration(build.ready.p95)}</span></div></div>)}</div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">Real-user samples</h2><p className="mt-1 text-sm text-white/45">Click a row to open diagnostics. Search “Jim” here when he reports slowness.</p></div><span className="text-xs text-white/35">{samples.length} shown</span></div>
            <div className="mt-4 max-h-[720px] overflow-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="sticky top-0 bg-[#0a0c11] text-xs uppercase tracking-[0.12em] text-white/35"><tr><th className="p-3">When</th><th>User</th><th>Route</th><th>Kind</th><th>Ready</th><th>TTFB</th><th>Build</th></tr></thead><tbody className="divide-y divide-white/7">{samples.map((sample) => <tr key={sample.sample_id} onClick={() => void selectSample(sample.sample_id)} className="cursor-pointer transition hover:bg-white/[0.04]"><td className="p-3 text-white/45">{when(sample.received_at)}</td><td className="font-medium text-white">{sample.user_display_name || sample.user_uid || sample.traffic_visitor_id.slice(0, 14)}</td><td>{sample.route}</td><td>{sample.navigation_kind}</td><td>{duration(sample.ready_ms)}</td><td>{duration(sample.ttfb_ms)}</td><td className="max-w-[160px] truncate text-white/40">{sample.build_version}</td></tr>)}</tbody></table></div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-semibold text-white">Sample diagnostics</h2>
            {!selected ? <p className="mt-4 text-sm leading-6 text-white/45">Select a sample to inspect the exact user, session, network hints, slowest API call, resources, and long tasks.</p> : <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4"><p className="text-xs uppercase tracking-[0.15em] text-amber-100/60">{selected.user_display_name || selected.user_uid || "Anonymous visitor"}</p><p className="mt-2 text-lg font-semibold text-white">{selected.route} · {duration(selected.ready_ms)}</p><p className="mt-1 text-xs text-white/45">{selected.navigation_kind} · {selected.ready_source} · {selected.sample_id}</p></div>
              <div className="grid grid-cols-2 gap-3 text-sm">{[["TTFB", duration(selected.ttfb_ms)],["LCP", duration(selected.lcp_ms)],["INP", duration(selected.inp_ms)],["CLS", selected.cls == null ? "—" : selected.cls.toFixed(3)],["Slowest API", selected.slowest_api_path || "—"],["API time", duration(selected.slowest_api_ms)]].map(([label,value]) => <div key={label} className="rounded-2xl border border-white/8 bg-black/20 p-3"><p className="text-xs text-white/35">{label}</p><p className="mt-1 break-words text-white/80">{value}</p></div>)}</div>
              <div className="text-xs leading-5 text-white/45">Visitor {selected.traffic_visitor_id}<br/>Traffic session {selected.traffic_session_id}<br/>Journey {selected.journey_session_id}<br/>Network {selected.effective_connection_type || "unknown"} · RTT {selected.connection_rtt_ms ?? "—"} ms · {selected.downlink_mbps ?? "—"} Mbps</div>
              {selectedApis.length ? <div><p className="text-xs uppercase tracking-[0.14em] text-white/35">Top API requests</p><div className="mt-2 space-y-2">{selectedApis.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-xs"><span className="break-all text-white/65">{item.name}</span><span className="shrink-0 text-white/40">{duration(item.duration_ms)}</span></div>)}</div></div> : null}
              {selectedResources.length ? <div><p className="text-xs uppercase tracking-[0.14em] text-white/35">Top resources</p><div className="mt-2 space-y-2">{selectedResources.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-xs"><span className="break-all text-white/65">{item.name}</span><span className="shrink-0 text-white/40">{duration(item.duration_ms)}</span></div>)}</div></div> : null}
            </div>}
          </section>
        </div>

        <section className="mt-6 rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">Speed Report inbox</h2><p className="mt-1 text-sm text-white/45">One-click reports submitted from a user’s personal AoE2WAR Speed Observatory.</p></div><span className="text-xs text-white/35">{reports.length} loaded</span></div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">{reports.length ? reports.map((report) => <article key={report.report_id} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{report.user_display_name || report.user_uid || "Anonymous user"} · {report.route}</p><p className="mt-1 text-xs text-white/40">{when(report.created_at)} · {report.status} · {report.report_id}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/50">{report.build_version || "unknown build"}</span></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void updateReport(report.report_id, "reviewed")} className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-xs text-sky-100">Mark reviewed</button><button type="button" onClick={() => void updateReport(report.report_id, "resolved")} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-100">Resolve</button></div></article>) : <div className="text-sm text-white/40">No Speed Reports yet.</div>}</div>
        </section>
      </div>
    </main>
  );
}
