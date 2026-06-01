/**
 * Loading skeleton for /dashboard. Mirrors the command-center layout
 * (hero + 6-cell stats + 2-col panels) so the perceived load is the
 * shape of the real page, not a generic spinner.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        {/* ── Hero skeleton ────────────────────────────────────── */}
        <section className="border-b border-white/[0.04]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-7">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,360px)] gap-6 items-start">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-white/[0.04] animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-7 w-64 bg-white/[0.04] rounded animate-pulse" />
                  <div className="h-3 w-48 bg-white/[0.03] rounded animate-pulse" />
                  <div className="flex gap-2 mt-3">
                    <div className="h-7 w-16 bg-white/[0.04] rounded-lg animate-pulse" />
                    <div className="h-7 w-24 bg-white/[0.04] rounded-lg animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-24 animate-pulse" />
            </div>
          </div>
        </section>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* 6-cell stats skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
            ))}
          </div>

          {/* Equity + Plan skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
            <div className="h-56 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
            <div className="h-56 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          </div>

          {/* Positions + Exchanges skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
            <div className="h-64 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
            <div className="h-64 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
