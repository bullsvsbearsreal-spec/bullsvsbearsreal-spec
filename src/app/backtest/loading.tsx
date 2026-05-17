/**
 * Loading skeleton for /backtest. Mirrors: hero + form (left) +
 * result panel with sparkline (right).
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function BacktestLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-12 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-64 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Form column */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="h-4 w-24 bg-white/[0.04] rounded animate-pulse" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-9 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-9 rounded bg-white/[0.04] animate-pulse" />
            </div>
            <div className="h-9 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-9 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-9 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-10 rounded bg-white/[0.04] animate-pulse mt-2" />
          </div>

          {/* Result column — 2/3 width */}
          <div className="md:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded bg-white/[0.04] animate-pulse" />
              ))}
            </div>
            <div className="h-56 rounded bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
