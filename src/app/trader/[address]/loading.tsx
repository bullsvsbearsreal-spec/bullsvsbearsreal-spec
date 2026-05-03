export default function TraderLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Back nav */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse" />
          <div className="h-4 w-20 bg-white/[0.04] rounded animate-pulse" />
        </div>
        {/* Header card with rollup */}
        <div className="bg-white/[0.03] rounded-xl p-4 mb-4 animate-pulse">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-5 w-64 bg-white/[0.06] rounded" />
              <div className="h-4 w-[440px] max-w-full bg-white/[0.04] rounded" />
              <div className="flex gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-3 w-16 bg-white/[0.04] rounded" />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-[64px] w-[110px] bg-white/[0.04] rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        {/* Three venue cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-[360px] bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
