export default function SpreadsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title + pickers */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-36 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="h-9 w-36 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="flex-1" />
          <div className="h-9 w-24 bg-white/[0.06] rounded-lg animate-pulse" />
        </div>

        {/* Timeframe bar */}
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-12 bg-white/[0.06] rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="h-[400px] bg-hub-card border border-hub-subtle rounded-2xl animate-pulse mb-6" />

        {/* Exchange price table */}
        <div className="bg-hub-card border border-hub-subtle rounded-2xl overflow-hidden">
          <div className="h-10 bg-white/[0.03] border-b border-hub-subtle" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-hub-subtle flex items-center px-4 gap-4">
              <div className="w-5 h-5 rounded-full bg-white/[0.06] animate-pulse" />
              <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />
              <div className="flex-1" />
              <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
