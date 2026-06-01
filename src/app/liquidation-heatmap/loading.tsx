/**
 * Loading skeleton for /liquidation-heatmap. Mirrors the page shape:
 * hero with refresh + timeframe controls, summary stats, grid.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function LiquidationHeatmapLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Hero skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-16 bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="h-9 w-64 bg-white/[0.06] rounded animate-pulse mb-2" />
            <div className="h-3 w-80 max-w-full bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-7 w-32 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-6 w-24 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-9 w-24 rounded-xl bg-white/[0.06] animate-pulse" />
          </div>
        </div>

        {/* Controls row skeleton */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="h-9 w-72 rounded-xl bg-white/[0.06] animate-pulse" />
          <div className="h-9 w-48 rounded-xl bg-white/[0.06] animate-pulse" />
        </div>

        {/* Summary stats — 4-cell */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        {/* Heatmap grid skeleton — time × price */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 overflow-hidden">
          <div className="space-y-1">
            {Array.from({ length: 16 }).map((_, r) => (
              <div key={r} className="flex gap-0.5">
                <div className="w-14 h-5 rounded bg-white/[0.06] animate-pulse shrink-0" />
                {Array.from({ length: 24 }).map((_, c) => (
                  <div
                    key={c}
                    className="flex-1 h-5 rounded bg-white/[0.06] animate-pulse"
                    style={{ animationDelay: `${(r * 24 + c) * 5}ms` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
