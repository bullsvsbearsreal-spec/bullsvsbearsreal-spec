/**
 * Loading skeleton for /market-cycle. Mirrors: hero + cycle gauge +
 * indicator cards grid.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MarketCycleLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-9 w-64 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
        </div>

        {/* Cycle gauge — big circle area */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-64 mb-5 animate-pulse" />

        {/* Indicator cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
