"use client";

import { useState } from "react";

export default function AdminLoginScreen({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "Could not unlock the admin cockpit.");
      }

      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock the admin cockpit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#06070a] px-4 py-10 text-slate-100 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-[32px] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.10),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:p-8">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Traffic Admin</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Notification cockpit
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              This is the control layer for visitor alerts. Traffic stays the system of record for
              who showed up, which page they hit, and whether they look human. The cockpit lets you
              arm the phone-notification faucet and tighten it over time.
            </p>
          </div>

          {!configured ? (
            <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-100">
              Traffic admin is not configured yet on this host. Set `TRAFFIC_ADMIN_PASSWORD` on the
              web app and `TRAFFIC_ADMIN_API_KEY` on both the web app and API, then reload this
              page.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-6 grid gap-4 rounded-3xl border border-white/10 bg-black/20 p-5 sm:grid-cols-[1fr_auto]"
            >
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Admin password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
                  placeholder="Enter the cockpit password"
                  autoComplete="current-password"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={busy || !password.trim()}
                  className="cursor-pointer rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Unlocking..." : "Unlock cockpit"}
                </button>
              </div>

              {error ? (
                <div className="sm:col-span-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
