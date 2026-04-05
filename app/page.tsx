export const dynamic = "force-dynamic";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#06070a] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="rounded-[32px] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">
            traffic.tokentap.ca
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            Traffic observatory
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            Traffic web is running in a lighter safe mode right now so the VPS stays responsive
            while we slim the heavier live dashboard surfaces.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/visits"
              className="rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-400/15"
            >
              Open visits history
            </Link>

            <Link
              href="/admin"
              className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
            >
              Open admin cockpit
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Status</p>
            <p className="mt-3 text-2xl font-semibold text-white">Homepage trimmed</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The heavy live overview stack has been removed from the landing page temporarily.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Safe path</p>
            <p className="mt-3 text-2xl font-semibold text-white">Use deeper pages</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Visits history and admin stay available without forcing the full observatory shell.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Next step</p>
            <p className="mt-3 text-2xl font-semibold text-white">Refactor live surfaces</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              We’ll bring the premium homepage back after slimming the API load shape.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
