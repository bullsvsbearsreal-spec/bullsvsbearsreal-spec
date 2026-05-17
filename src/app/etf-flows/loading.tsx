/**
 * Loading skeleton for /etf-flows. Mirrors: hero + asset toggle +
 * summary tiles + daily flow bars + issuer breakdown table.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function EtfFlowsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Hero skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
              <div className="h-3 w-28 bg-white/[0.04] rounded animate-pulse" />
            </div>
            <div className="h-9 w-64 bg-white/[0.04] rounded animate-pulse mb-2" />
            <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>

        {/* Summary stats — 3-cell */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        {/* Daily flow bars — emulate the 30-day bar chart */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-5">
          <div className="flex items-end gap-1 h-40">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-white/[0.04] animate-pulse"
                style={{
                  height: `${30 + Math.abs(Math.sin(i)) * 60}%`,
                  animationDelay: `${i * 20}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Issuer breakdown */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-white/[0.04] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
