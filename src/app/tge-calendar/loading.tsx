/**
 * Loading skeleton for /tge-calendar. Mirrors: hero + filter chips +
 * grouped upcoming TGEs by week.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TgeCalendarLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-56 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-white/[0.04] animate-pulse" />
          ))}
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, week) => (
            <div key={week}>
              <div className="h-4 w-40 bg-white/[0.03] rounded mb-2 animate-pulse" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, ev) => (
                  <div key={ev} className="h-16 rounded-lg border border-white/[0.06] bg-white/[0.02] animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
