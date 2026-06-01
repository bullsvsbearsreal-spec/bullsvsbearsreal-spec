export default function ChartLoading() {
  return (
    <div className="min-h-screen bg-hub-black">

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Symbol + timeframe bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-28 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="flex gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-8 w-10 bg-white/[0.06] rounded animate-pulse" />
            ))}
          </div>
          <div className="flex-1" />
          <div className="h-8 w-8 bg-white/[0.06] rounded-lg animate-pulse" />
        </div>

        {/* Chart area */}
        <div className="h-[500px] bg-hub-darker border border-hub-subtle rounded-xl animate-pulse mb-4" />

        {/* Metrics panel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-hub-darker border border-hub-subtle rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
