"use client"

import { useEffect, useState } from "react"
import type { ComponentProps } from "react"

import AdminNotificationDashboard from "./admin-notification-dashboard"

type Props = ComponentProps<typeof AdminNotificationDashboard>

export default function AdminNotificationDashboardClientOnly(props: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <main className="traffic-admin-scroll-root min-h-screen overflow-x-clip bg-[#06070a] text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <section className="rounded-[32px] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Traffic Admin</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Loading cockpit…
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Preparing the live notification dashboard.
            </p>
          </section>
        </div>
      </main>
    )
  }

  return <AdminNotificationDashboard {...props} />
}
