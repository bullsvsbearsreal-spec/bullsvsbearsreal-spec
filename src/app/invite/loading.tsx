/**
 * Loading skeleton for /invite. Matches the page layout (hero +
 * share-link card + 2-col stats + share-templates) so the perceived
 * load is the shape of the real page, not a spinner.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function InviteLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[900px] mx-auto w-full px-4 sm:px-6 py-6">
        {/* PageHero skeleton */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-48 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-80 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        {/* Share link card skeleton */}
        <div className="card-premium p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-32 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-3 w-24 bg-white/[0.03] rounded animate-pulse" />
          </div>
          <div className="h-10 w-full rounded-lg bg-white/[0.04] animate-pulse" />
        </div>

        {/* 2-cell stats skeleton */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="card-premium p-4 h-24 animate-pulse" />
          <div className="card-premium p-4 h-24 animate-pulse" />
        </div>

        {/* Share templates skeleton — 3 stacked cards */}
        <div className="card-premium p-5 mb-5 space-y-3">
          <div className="h-4 w-40 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-24 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="h-20 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="h-24 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>

        {/* What you both get skeleton */}
        <div className="card-premium p-5 mb-8 h-32 animate-pulse" />
      </main>
      <Footer />
    </div>
  );
}
