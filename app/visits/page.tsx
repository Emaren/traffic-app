import Link from "next/link";
import VisitsHistoryTable from "@/components/traffic/visits-history-table";

export default function VisitsPage() {
  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-[1700px] px-4 py-6 md:px-6 xl:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              Historical archive
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Visits History</h1>
            <p className="mt-2 text-sm text-white/60">
              Scrollable session log with live refreshing, clearer verdicts, better visitor context,
              and honest stored-history ranges.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80 transition hover:bg-black/30"
          >
            Back to Traffic
          </Link>
        </div>

        <VisitsHistoryTable />
      </div>
    </main>
  );
}
