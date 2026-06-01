/**
 * Loading skeleton for /home — the landing terminal dashboard.
 * Mirrors: hero + market tiles + multi-section live data panels.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="text-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          {/* Hero strip */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="h-9 w-72 bg-white/[0.06] rounded animate-pulse mb-2" />
              <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="h-7 w-40 bg-white/[0.06] rounded animate-pulse" />
          </div>

          {/* Top stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
            ))}
          </div>

          {/* Major coins panel */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-5">
            <div className="h-10 border-b border-white/[0.04] bg-white/[0.02]" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 border-b border-white/[0.04] animate-pulse" />
            ))}
          </div>

          {/* Bottom 3-col panel grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-48 animate-pulse" />
            ))}
          </div>

          {/* Exchange health strip */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-40 animate-pulse" />
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-40 animate-pulse" />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
