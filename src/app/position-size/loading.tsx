/**
 * Loading skeleton for /position-size. Mirrors: hero + 2-col
 * calculator (form + result with R:R + Kelly breakdown).
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function PositionSizeLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-72 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 w-24 bg-white/[0.03] rounded mb-1 animate-pulse" />
                <div className="h-9 rounded bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="h-4 w-32 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-20 rounded bg-white/[0.04] animate-pulse" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
