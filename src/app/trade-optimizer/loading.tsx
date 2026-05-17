/**
 * Loading skeleton for /trade-optimizer. Mirrors: hero + search +
 * venue-by-venue cost breakdown.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TradeOptimizerLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-72 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 rounded bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 border-b border-white/[0.04] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
