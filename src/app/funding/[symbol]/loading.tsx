/**
 * Loading skeleton for /funding/[symbol]. Mirrors: symbol header +
 * per-exchange funding table + history chart.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function FundingSymbolLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Back link */}
        <div className="h-3 w-32 bg-white/[0.03] rounded animate-pulse mb-6" />

        {/* Symbol header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-32 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-3 w-56 bg-white/[0.03] rounded animate-pulse" />
          </div>
        </div>

        {/* Quick symbol links */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-32 rounded-lg bg-white/[0.04] animate-pulse" />
          ))}
        </div>

        {/* History chart */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-72 mb-6 animate-pulse" />

        {/* Per-exchange table */}
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
