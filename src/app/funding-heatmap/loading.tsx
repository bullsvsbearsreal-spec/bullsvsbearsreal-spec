/**
 * Loading skeleton for /funding-heatmap. Matches the page layout
 * (hero + day selector + stats strip + heatmap grid + legend).
 *
 * The heatmap renders ~symbols × days cells which can take a beat
 * to fetch + paint on cold load — skeleton makes the wait feel
 * intentional.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function FundingHeatmapLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="min-h-screen bg-hub-dark text-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          {/* Hero skeleton */}
          <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse" />
              </div>
              <div className="h-9 w-56 bg-white/[0.06] rounded animate-pulse mb-2" />
              <div className="h-3 w-80 max-w-full bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-40 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-9 w-36 rounded-lg bg-white/[0.06] animate-pulse" />
            </div>
          </header>

          {/* Stats strip skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
            ))}
          </div>

          {/* Heatmap grid skeleton — emulates a 12-row × 14-col table of cells */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4 overflow-hidden">
            <div className="space-y-1">
              {Array.from({ length: 12 }).map((_, r) => (
                <div key={r} className="flex gap-1">
                  <div className="w-16 h-6 rounded bg-white/[0.06] animate-pulse shrink-0" />
                  {Array.from({ length: 14 }).map((_, c) => (
                    <div
                      key={c}
                      className="flex-1 h-6 rounded bg-white/[0.06] animate-pulse"
                      style={{ animationDelay: `${(r * 14 + c) * 8}ms` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend skeleton */}
          <div className="h-8 w-72 max-w-full bg-white/[0.06] rounded animate-pulse" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
