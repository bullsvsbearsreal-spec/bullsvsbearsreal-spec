/**
 * Loading skeleton for /sectors. Mirrors: hero + 4-cell + sector
 * heatmap-style grid.
 */
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function SectorsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-24 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-56 bg-white/[0.04] rounded animate-pulse mb-2" />
          <div className="h-3 w-96 max-w-full bg-white/[0.03] rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>

        {/* Sector tiles with varied heights */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 24 }).map((_, i) => {
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
