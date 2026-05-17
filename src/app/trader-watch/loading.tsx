/**
 * Loading skeleton for /trader-watch. Matches the page layout
 * (hero + 4-cell stats + activity-feed strip + bookmark chips +
 * positions table) so the perceived load is the shape of the real
 * page, not a generic spinner.
 *
 * The page fetches positions across GMX + Hyperliquid + gTrade
 * which can take 1-3s on a cold load — a real skeleton makes that
 * wait feel intentional.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TraderWatchLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <div id="main-content" className="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto">
        {/* PageHero skeleton */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-56 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-72 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        {/* 4-cell stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        {/* Activity feed strip */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-12 mb-4 animate-pulse" />

        {/* Bookmark chips row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-32 rounded-md bg-white/[0.04] animate-pulse" />
          ))}
        </div>

        {/* Positions table skeleton */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-white/[0.04] animate-pulse" />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
