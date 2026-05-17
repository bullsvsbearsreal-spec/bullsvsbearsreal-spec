/**
 * Loading skeleton for /bounce/check — wallet rekt-profile lookup.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function BounceCheckLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[900px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-64 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-80 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        {/* Address input + result card */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-14 mb-4 animate-pulse" />
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] h-72 animate-pulse" />
      </main>
      <Footer />
    </div>
  );
}
