/**
 * Loading skeleton for /portfolio. Matches the page layout
 * (hero + summary stats + holdings table) so the perceived load
 * is the shape of the real page, not a generic spinner.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function PortfolioLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* PageHero skeleton */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-32 bg-white/[0.06] rounded animate-pulse" />
              </div>
              <div className="h-9 w-64 bg-white/[0.06] rounded animate-pulse mb-2" />
              <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-24 rounded-xl bg-white/[0.06] animate-pulse" />
              <div className="h-9 w-28 rounded-xl bg-white/[0.06] animate-pulse" />
            </div>
          </div>
        </div>

        {/* Summary stats skeleton — 3-cell */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        {/* Holdings table skeleton */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-white/[0.04] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
