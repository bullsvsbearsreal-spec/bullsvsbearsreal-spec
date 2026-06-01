/**
 * Loading skeleton for /watchlist. Mirrors: hero + add-symbol bar +
 * watchlist table.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function WatchlistLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="h-9 w-64 bg-white/[0.06] rounded animate-pulse mb-2" />
            <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-lg bg-white/[0.06] animate-pulse" />
            <div className="h-9 w-24 rounded-lg bg-white/[0.06] animate-pulse" />
          </div>
        </div>

        {/* Add-symbol bar */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6 h-16 animate-pulse" />

        {/* Watchlist table */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-white/[0.04] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
