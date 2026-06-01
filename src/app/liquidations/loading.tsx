export default function LiquidationsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-44 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-white/[0.06] rounded-lg animate-pulse" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-hub-darker border border-hub-subtle rounded-xl animate-pulse" />
          ))}
        </div>

        {/* Chart + Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 h-[280px] bg-hub-darker border border-hub-subtle rounded-xl animate-pulse" />
          <div className="h-[280px] bg-hub-darker border border-hub-subtle rounded-xl animate-pulse" />
        </div>

        {/* Treemap skeleton */}
        <div className="h-[320px] bg-hub-darker border border-hub-subtle rounded-xl animate-pulse" />
      </main>
    </div>
  );
}
