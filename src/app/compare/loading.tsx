/**
 * Loading skeleton for /compare. Mirrors: hero + token-selector +
 * side-by-side comparison grid.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function CompareLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="h-9 w-64 bg-white/[0.06] rounded animate-pulse mb-2" />
            <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
          </div>
        </div>

        {/* Token-selector card */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-5">
          <div className="flex flex-wrap gap-2 mb-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-28 rounded-lg bg-white/[0.06] animate-pulse" />
            ))}
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 w-16 rounded-md bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        </div>

        {/* Comparison grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
