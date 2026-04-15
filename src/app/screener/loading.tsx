export default function ScreenerLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title + actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-32 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-28 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="h-9 w-48 bg-white/[0.06] rounded-lg animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-28 bg-white/[0.06] rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Table */}
        <div className="bg-hub-card border border-hub-subtle rounded-xl overflow-hidden">
          <div className="h-10 bg-white/[0.03] border-b border-hub-subtle" />
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-11 border-b border-hub-subtle flex items-center px-4 gap-4">
              <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
              <div className="flex-1" />
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="h-4 w-14 bg-white/[0.06] rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
