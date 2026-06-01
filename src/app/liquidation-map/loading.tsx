/**
 * Loading skeleton for /liquidation-map. Mirrors: hero + symbol +
 * timeframe toggles + main heatmap canvas + per-bucket detail.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function LiquidationMapLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="h-9 w-64 bg-white/[0.06] rounded animate-pulse mb-2" />
            <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-9 w-40 rounded-lg bg-white/[0.06] animate-pulse" />
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap gap-2 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-lg bg-white/[0.06] animate-pulse" />
          ))}
        </div>

        {/* Big heatmap canvas */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-[420px] animate-pulse mb-4" />

        {/* Bucket detail strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
