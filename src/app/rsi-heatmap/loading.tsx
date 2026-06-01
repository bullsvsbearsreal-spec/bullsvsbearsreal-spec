/**
 * Loading skeleton for /rsi-heatmap. Mirrors the page shape: hero,
 * 4-cell stats strip, filter chips, RSI table rows.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function RsiHeatmapLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Hero skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="h-9 w-48 bg-white/[0.06] rounded animate-pulse mb-2" />
            <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-7 w-32 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-9 w-9 rounded-lg bg-white/[0.06] animate-pulse" />
          </div>
        </div>

        {/* Stats — 4-cell */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-white/[0.06] animate-pulse" />
          ))}
        </div>

        {/* RSI table */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-white/[0.04] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
