/**
 * Loading skeleton for /watch — Wallet Alerts (HL + gTrade + GMX
 * Telegram alerter). Matches the page layout: hero with venue chips,
 * add-wallet form, watched-wallets table, recent-events feed.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function WatchLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="text-white max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
        {/* Hero skeleton */}
        <header className="mb-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
              <div className="h-3 w-16 bg-white/[0.04] rounded animate-pulse" />
            </div>
            <div className="h-9 w-64 bg-white/[0.04] rounded animate-pulse mb-3" />
            <div className="flex gap-1.5 mb-3">
              <div className="h-5 w-24 rounded-full bg-white/[0.04] animate-pulse" />
              <div className="h-5 w-32 rounded-full bg-white/[0.04] animate-pulse" />
              <div className="h-5 w-36 rounded-full bg-white/[0.04] animate-pulse" />
            </div>
            <div className="h-3 w-80 max-w-full bg-white/[0.03] rounded animate-pulse" />
          </div>
        </header>

        {/* Add-wallet form skeleton */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6 h-32 animate-pulse" />

        {/* Watched wallets table skeleton */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-6">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-white/[0.04] animate-pulse" />
          ))}
        </div>

        {/* Recent events feed skeleton */}
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
