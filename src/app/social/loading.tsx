/**
 * Loading skeleton for /social. Mirrors: hero + handle filter chips
 * + feed of KOL posts.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function SocialLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-9 w-56 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.06] rounded animate-pulse" />
        </div>

        {/* Filter chips */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 mb-4">
          <div className="h-3 w-24 bg-white/[0.06] rounded mb-2 animate-pulse" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-md bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        </div>

        {/* Post feed */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-pulse h-24" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
