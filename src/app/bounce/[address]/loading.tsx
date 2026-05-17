/**
 * Loading skeleton for /bounce/[address] — wallet rekt profile.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function BounceAddressLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1100px] mx-auto px-4 py-6">
        {/* Address header */}
        <div className="mb-5">
          <div className="h-8 w-72 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        {/* Big rekt-score card */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-40 mb-5 animate-pulse" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        {/* Liquidations timeline */}
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
