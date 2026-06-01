/**
 * Loading skeleton for /liq-calculator. Mirrors: hero + calculator
 * form + liquidation-price result panel.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function LiqCalculatorLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-9 w-72 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Form */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 w-20 bg-white/[0.06] rounded mb-1 animate-pulse" />
                <div className="h-9 rounded bg-white/[0.06] animate-pulse" />
              </div>
            ))}
          </div>

          {/* Result */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-16 rounded bg-white/[0.06] animate-pulse" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-white/[0.06] animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
