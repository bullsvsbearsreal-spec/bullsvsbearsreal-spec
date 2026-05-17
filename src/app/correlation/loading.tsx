/**
 * Loading skeleton for /correlation. Mirrors: hero + N×N
 * correlation matrix.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function CorrelationLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
              <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
            </div>
            <div className="h-9 w-64 bg-white/[0.04] rounded animate-pulse mb-2" />
            <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>

        {/* Matrix skeleton — 12×12 grid of cells with staggered animation */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 overflow-hidden">
          <div className="space-y-1">
            {Array.from({ length: 12 }).map((_, r) => (
              <div key={r} className="flex gap-1">
                <div className="w-16 h-7 rounded bg-white/[0.04] animate-pulse shrink-0" />
                {Array.from({ length: 12 }).map((_, c) => (
                  <div
                    key={c}
                    className="flex-1 h-7 rounded bg-white/[0.04] animate-pulse"
                    style={{ animationDelay: `${(r * 12 + c) * 8}ms` }}
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
