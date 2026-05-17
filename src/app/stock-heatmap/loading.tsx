/**
 * Loading skeleton for /stock-heatmap. Mirrors the page shape: hero,
 * sector groupings, treemap-style grid.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function StockHeatmapLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Hero skeleton */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-20 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-64 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        {/* Treemap-style grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
          {Array.from({ length: 30 }).map((_, i) => {
            // Vary tile heights to feel like a real treemap
            const sizes = ['h-20', 'h-28', 'h-24', 'h-32', 'h-20', 'h-24'];
            const h = sizes[i % sizes.length];
            return (
              <div
                key={i}
                className={`${h} rounded-md border border-white/[0.06] bg-white/[0.02] animate-pulse`}
                style={{ animationDelay: `${i * 18}ms` }}
              />
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
