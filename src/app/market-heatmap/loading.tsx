/**
 * Loading skeleton for /market-heatmap. Mirrors the treemap layout
 * with mixed-size tiles.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MarketHeatmapLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Hero skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
              <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
            </div>
            <div className="h-9 w-56 bg-white/[0.04] rounded animate-pulse mb-2" />
            <div className="h-3 w-80 max-w-full bg-white/[0.03] rounded animate-pulse" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-white/[0.04] animate-pulse" />
        </div>

        {/* Treemap skeleton — varied sizes */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
          {Array.from({ length: 48 }).map((_, i) => {
            const sizes = ['h-16', 'h-24', 'h-20', 'h-28', 'h-16', 'h-20', 'h-24', 'h-32'];
            const h = sizes[i % sizes.length];
            return (
              <div
                key={i}
                className={`${h} rounded-md border border-white/[0.06] bg-white/[0.02] animate-pulse`}
                style={{ animationDelay: `${i * 12}ms` }}
              />
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
