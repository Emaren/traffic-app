"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { fetchVisitorProfile } from "@/components/traffic/api";
import { withFlag } from "@/components/traffic/display";
import LiveVisitorStreamRow from "@/components/traffic/live-visitor-stream-row";
import VisitorActivityReel from "@/components/traffic/visitor-activity-reel";
import type { SessionRecord, VisitorProfileResponse } from "@/components/traffic/types";

type Props = {
  initialProfile: VisitorProfileResponse;
  pollMs?: number;
  visitorId: string;
};

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{helper}</p>
    </div>
  );
}

function pickWatchedSession(sessions: SessionRecord[]) {
  return sessions.find((session) => session.active_now) ?? sessions[0] ?? null;
}

export default function VisitorProfileScreen({
  initialProfile,
  pollMs = 5000,
  visitorId,
}: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await fetchVisitorProfile(visitorId);
        if (!mounted || !next.ok) return;
        startTransition(() => {
          setProfile(next);
          setError("");
        });
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to refresh visitor profile");
      }
    };

    const timer = window.setInterval(() => void load(), pollMs);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [pollMs, visitorId]);

  const watchedSession = useMemo(
    () => pickWatchedSession(profile.sessions),
    [profile.sessions],
  );

  return (
    <main className="min-h-screen bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="rounded-[32px] border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/80">Visitor profile</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                {withFlag(profile.visitor.country_code, profile.visitor.alias)}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Current 24-hour visitor profile for this fingerprint. This view now live-refreshes so
                you can watch path movement without reloading, but the underlying truth is still the
                current window until persistence lands.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-xs text-white/75">
                  IP {profile.visitor.ip}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
                  {profile.visitor.city || "Unknown city"}
                  {profile.visitor.area ? `, ${profile.visitor.area}` : ""}
                  {profile.visitor.country ? `, ${profile.visitor.country}` : ""}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
                  {profile.visitor.device} • {profile.visitor.os} • {profile.visitor.browser}
                </span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  Refreshes every {Math.round(pollMs / 1000)}s
                </span>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">First seen:</span>{" "}
                <span className="text-white">{profile.visitor.first_seen_alberta}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="text-slate-400">Last movement:</span>{" "}
                <span className="text-white">{profile.visitor.last_seen_alberta}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Link href="/" className="text-emerald-200 transition hover:text-emerald-100">
                  Back to observatory
                </Link>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            Live refresh hit a snag, so you are seeing the last good visitor snapshot: {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Sessions"
            value={String(profile.visitor.total_sessions)}
            helper="Sessions tied to this visitor fingerprint in the current 24-hour window."
          />
          <StatCard
            label="Projects"
            value={String(profile.visitor.projects_visited)}
            helper="How many projects this visitor touched in the current window."
          />
          <StatCard
            label="Status"
            value={profile.visitor.active_now ? "Active" : "Quiet"}
            helper="Whether at least one session from this visitor is active right now."
          />
          <StatCard
            label="Profile ID"
            value={profile.visitor.id.slice(0, 8)}
            helper="Stable visitor profile key used for this autogenerated visitor page."
          />
        </section>

        <div className="mt-6">
          <VisitorActivityReel
            key={watchedSession?.session_id ?? "no-session"}
            session={watchedSession}
            pollMs={pollMs}
          />
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Projects</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Where this visitor showed up</h2>

            <div className="mt-5 space-y-3">
              {profile.projects.map((project) => (
                <div
                  key={project.slug}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{project.name}</div>
                    <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
                      {project.visits} visits
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">Last seen {project.last_seen_at}</div>
                  <div className="mt-3">
                    <Link
                      href={`/projects/${project.slug}`}
                      className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/15"
                    >
                      Open {project.name}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Sessions</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Full session paths</h2>
            <p className="mt-2 text-sm text-slate-300">
              Newest session first. Expand a row to see the unlimited full page path and why Traffic
              thinks it belongs to this visitor.
            </p>

            <div className="mt-5 space-y-3">
              {profile.sessions.map((session) => (
                <LiveVisitorStreamRow
                  key={session.session_id}
                  session={session}
                  showVisitorLink={false}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
