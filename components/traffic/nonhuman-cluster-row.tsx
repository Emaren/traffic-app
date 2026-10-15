"use client";

import type { SessionRecord } from "@/components/traffic/types";

type Props = {
  session: SessionRecord;
  density?: "full" | "compact";
};

export function isNonhumanCluster(session: SessionRecord): boolean {
  return (
    (session.is_burst_cluster === true || session.is_network_actor_cluster === true) &&
    (session.burst_member_count ?? session.network_actor_member_count ?? 0) > 1 &&
    !session.authenticated &&
    !session.human_confirmed &&
    !(session.known_visitor_confirmed && !["known_automation", "crawler"].includes(String(session.known_visitor_kind ?? ""))) &&
    ["bot", "browser_script", "script_burst", "suspicious"].includes(session.classification_state)
  );
}

export default function NonhumanClusterRow({ session, density = "full" }: Props) {
  const members = session.burst_member_count ?? session.network_actor_member_count ?? 0;
  const ips = session.burst_ip_count ?? session.network_actor_ip_count ?? 0;
  const sampleIps = session.burst_sample_ips ?? session.network_actor_sample_ips ?? [];
  const paths = session.burst_paths ?? session.network_actor_paths ?? session.page_sequence ?? [];
  const name = session.visitor_alias || session.automation_family || "Automated traffic";
  const hasSamples = sampleIps.length > 0 || paths.length > 0;

  return (
    <details className="group rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.035] open:border-fuchsia-400/35">
      <summary className={"flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 marker:hidden [&::-webkit-details-marker]:hidden " + (density === "compact" ? "px-3 py-2.5" : "px-4 py-3")}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">{name}</span>
            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-0.5 text-xs font-semibold text-fuchsia-100">
              {members.toLocaleString()} sessions grouped
            </span>
            {ips > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/65">
                {ips.toLocaleString()} IPs
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-white/55">
            {session.classification_state.replaceAll("_", " ")}
            {session.city ? " · " + session.city : ""}
            {session.country ? ", " + session.country : ""}
            {session.last_seen_alberta ? " · Last seen " + session.last_seen_alberta : ""}
          </p>
          {density === "full" && session.classification_summary ? (
            <p className="mt-2 text-sm leading-5 text-white/65">{session.classification_summary}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-white/75 group-open:border-fuchsia-400/30 group-open:text-fuchsia-200">
          Inspect samples <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="border-t border-white/10 px-4 py-3 text-xs text-white/65">
        <p>
          Aggregated display only. Individual requests are retained in Traffic history.
          {session.burst_window_seconds !== undefined
            ? " Observed span: " + Math.round(session.burst_window_seconds / 60) + " minutes."
            : ""}
        </p>
        {sampleIps.length > 0 ? (
          <div className="mt-3">
            <div className="font-semibold text-white/80">Representative IPs ({sampleIps.length} shown)</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {sampleIps.map((ip) => (
                <span key={ip} className="rounded-md border border-white/10 bg-black/25 px-2 py-1 font-mono break-all">{ip}</span>
              ))}
            </div>
          </div>
        ) : null}
        {paths.length > 0 ? (
          <div className="mt-3">
            <div className="font-semibold text-white/80">Representative routes ({paths.length} shown)</div>
            <ul className="mt-1 space-y-1">
              {paths.map((path) => (
                <li key={path} className="break-all rounded-md bg-black/20 px-2 py-1 font-mono">{path}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!hasSamples ? <p className="mt-2">No member samples available in this bounded live preview.</p> : null}
      </div>
    </details>
  );
}
