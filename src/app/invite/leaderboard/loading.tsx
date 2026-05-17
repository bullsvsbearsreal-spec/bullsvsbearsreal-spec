/**
 * Loading skeleton for /invite/leaderboard. Mirrors: hero +
 * leaderboard table with 8 rows.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function InviteLeaderboardLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[900px] mx-auto w-full px-4 sm:px-6 py-6">
        {/* PageHero skeleton */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-24 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-72 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        {/* Leaderboard table */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-3">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-14 border-b border-white/[0.04] animate-pulse"
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>

        {/* CTA card placeholder */}
        <div className="card-premium p-5 mb-8 h-40 animate-pulse" />
      </main>
      <Footer />
    </div>
  );
}
