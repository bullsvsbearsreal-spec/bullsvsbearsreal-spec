export default function LongShortLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="h-7 w-40 bg-white/[0.06] rounded-lg animate-pulse mb-6" />

        {/* Chart skeleton */}
        <div className="bg-hub-card border border-hub-subtle rounded-xl p-4 mb-6">
          <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse mb-4" />
          <div className="h-64 bg-white/[0.03] rounded-lg animate-pulse" />
        </div>

        {/* Table skeleton */}
        <div className="bg-hub-card border border-hub-subtle rounded-xl overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.03]">
              <div className="w-5 h-5 bg-white/[0.06] rounded-full animate-pulse" />
              <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
              <div className="flex-1" />
              <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-3 w-12 bg-white/[0.04] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
