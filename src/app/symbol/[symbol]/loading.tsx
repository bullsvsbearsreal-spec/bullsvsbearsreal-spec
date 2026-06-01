/**
 * Loading skeleton for /symbol/[symbol]. Mirrors: symbol hero +
 * funding/OI/L:S strips + chart + per-exchange tables.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function SymbolLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Symbol hero */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-white/[0.06] animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-32 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-3 w-48 bg-white/[0.06] rounded animate-pulse" />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        {/* Chart area */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-80 mb-6 animate-pulse" />

        {/* Per-exchange table */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-white/[0.04] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
