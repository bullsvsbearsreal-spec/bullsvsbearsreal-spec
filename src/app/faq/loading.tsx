/**
 * Loading skeleton for /faq. Mirrors: hero + search bar + 4
 * category sections each with a stacked accordion list.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function FaqLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* PageHero skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-32 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-72 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        {/* Search bar */}
        <div className="h-11 max-w-xl rounded-xl bg-white/[0.04] animate-pulse mb-8" />

        {/* 4 category sections, each with 3-5 stacked Q rows */}
        <div className="space-y-8">
          {Array.from({ length: 4 }).map((_, s) => (
            <section key={s}>
              <div className="h-4 w-40 bg-white/[0.04] rounded mb-1 animate-pulse" />
              <div className="h-3 w-72 max-w-full bg-white/[0.03] rounded mb-3 animate-pulse" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-lg border border-white/[0.06] bg-white/[0.02] animate-pulse"
                    style={{ animationDelay: `${(s * 4 + i) * 30}ms` }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
