/**
 * Loading skeleton for /cycle-phase. Mirrors: hero + phase
 * indicator + history chart.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function CyclePhaseLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-9 w-56 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
        </div>

        {/* Phase strip + history */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-32 mb-5 animate-pulse" />
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-80 mb-5 animate-pulse" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
