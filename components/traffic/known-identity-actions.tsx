"use client";

import { useMemo, useState, useTransition } from "react";
import { createKnownIdentity } from "@/components/traffic/api";
import type { KnownIdentityKind, SessionRecord } from "@/components/traffic/types";

type Props = {
  session: SessionRecord;
  compact?: boolean;
};

const KIND_OPTIONS: Array<{ value: KnownIdentityKind; label: string; detail: string }> = [
  { value: "known_human", label: "Known human", detail: "known human" },
  { value: "known_player", label: "Known player", detail: "known player" },
  { value: "family", label: "Family", detail: "family" },
  { value: "owner", label: "My traffic", detail: "owner" },
  { value: "known_automation", label: "Known bot", detail: "known automation" },
  { value: "crawler", label: "Crawler", detail: "crawler" },
];

function defaultLabelFor(session: SessionRecord, kind: KnownIdentityKind): string {
  if (kind === "owner") return "Tony";
  return (
    session.known_visitor_label?.trim() ||
    session.visitor_alias?.replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, "").trim() ||
    session.ip
  );
}

function defaultDetailFor(session: SessionRecord, kind: KnownIdentityKind): string {
  if (session.known_visitor_detail?.trim()) return session.known_visitor_detail.trim();
  return KIND_OPTIONS.find((option) => option.value === kind)?.detail ?? "known visitor";
}

export default function KnownIdentityActions({ session, compact = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<KnownIdentityKind>(
    (session.known_visitor_kind as KnownIdentityKind | undefined) || "known_human",
  );
  const [label, setLabel] = useState(() => defaultLabelFor(session, kind));
  const [detail, setDetail] = useState(() => defaultDetailFor(session, kind));
  const [message, setMessage] = useState<string | null>(null);

  const baseNotes = useMemo(
    () =>
      `Saved from Traffic UI. Alias=${session.visitor_alias}; Project=${session.project_name}; Verdict=${session.verdict_label}; Session=${session.session_id}`,
    [session.project_name, session.session_id, session.verdict_label, session.visitor_alias],
  );

  function saveIdentity(nextKind: KnownIdentityKind, nextLabel?: string, nextDetail?: string) {
    const cleanLabel = (nextLabel || defaultLabelFor(session, nextKind)).trim();
    const cleanDetail = (nextDetail || defaultDetailFor(session, nextKind)).trim();

    setMessage(null);

    startTransition(async () => {
      try {
        await createKnownIdentity({
          rule_type: "ip",
          match_value: session.ip,
          label: cleanLabel,
          detail: cleanDetail,
          identity_kind: nextKind,
          confidence: "confirmed",
          notes: baseNotes,
        });

        setMessage(`Saved ${cleanLabel} · ${cleanDetail}. Refreshing shortly.`);
        window.setTimeout(() => window.location.reload(), 650);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save known identity.");
      }
    });
  }

  function submitCustom() {
    saveIdentity(kind, label, detail);
  }

  const buttonClass =
    "cursor-pointer rounded-full border px-3 py-1 font-medium transition disabled:cursor-wait disabled:opacity-60";

  return (
    <div className={compact ? "flex flex-wrap gap-1.5 text-[11px]" : "flex flex-wrap gap-2 text-xs"}>
      <button
        type="button"
        disabled={isPending}
        onClick={() => saveIdentity("known_human")}
        className={`${buttonClass} border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15`}
      >
        Confirm human
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() => saveIdentity("owner", "Tony", "owner")}
        className={`${buttonClass} border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15`}
      >
        My traffic
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() => saveIdentity("known_automation")}
        className={`${buttonClass} border-zinc-400/30 bg-zinc-400/10 text-zinc-200 hover:bg-zinc-400/15`}
      >
        Mark bot
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() => saveIdentity("crawler")}
        className={`${buttonClass} border-zinc-400/30 bg-zinc-400/10 text-zinc-200 hover:bg-zinc-400/15`}
      >
        Mark crawler
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() => setFormOpen((open) => !open)}
        className={`${buttonClass} border-sky-400/30 bg-sky-400/10 text-sky-200 hover:bg-sky-400/15`}
      >
        Label visitor
      </button>

      {formOpen ? (
        <div className="w-full rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Name, e.g. Julio"
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-sky-300/40"
            />

            <select
              value={kind}
              onChange={(event) => {
                const nextKind = event.target.value as KnownIdentityKind;
                setKind(nextKind);
                setDetail(defaultDetailFor(session, nextKind));
                if (!label.trim() || label === session.ip) setLabel(defaultLabelFor(session, nextKind));
              }}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/40"
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Detail"
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-sky-300/40"
            />

            <button
              type="button"
              disabled={isPending || !label.trim()}
              onClick={submitCustom}
              className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/15 disabled:cursor-wait disabled:opacity-60 md:col-span-3"
            >
              Save identity for {session.ip}
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70">
          {message}
        </div>
      ) : null}
    </div>
  );
}
