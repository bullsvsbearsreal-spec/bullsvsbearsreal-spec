/**
 * Loading skeleton for /coin/[id]. Mirrors: coin hero (icon + name +
 * price + change) + stats grid + chart placeholder + related sections.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function CoinLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <div className="h-3 w-32 bg-white/[0.06] rounded animate-pulse mb-4" />

        {/* Coin header */}
        <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/[0.06] animate-pulse" />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-40 bg-white/[0.06] rounded animate-pulse" />
                  <div className="h-5 w-14 bg-white/[0.06] rounded animate-pulse" />
                  <div className="h-5 w-16 bg-white/[0.06] rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-9 w-32 bg-white/[0.06] rounded animate-pulse" />
                  <div className="h-6 w-20 bg-white/[0.06] rounded animate-pulse" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/[0.06] animate-pulse" />
              <div className="h-12 w-12 rounded-xl bg-white/[0.06] animate-pulse" />
              <div className="h-12 w-12 rounded-xl bg-white/[0.06] animate-pulse" />
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        {/* Chart area */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-80 mb-6 animate-pulse" />

        {/* 2-col bottom: events + related */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-64 animate-pulse" />
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-64 animate-pulse" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
