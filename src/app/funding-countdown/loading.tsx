/**
 * Loading skeleton for /funding-countdown. Mirrors: hero + countdown
 * tiles + per-exchange next-settlement grid.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function FundingCountdownLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-9 w-72 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
        </div>

        {/* Imminent-settlement big card */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-32 mb-5 animate-pulse" />

        {/* Per-exchange grid */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-white/[0.04] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
