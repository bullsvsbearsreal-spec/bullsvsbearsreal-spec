/**
 * Loading skeleton for /onchain. Mirrors: hero + 4-cell + multi-
 * panel grid (TVL, fees, active addrs, etc.).
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function OnchainLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-9 w-72 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-60 animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
