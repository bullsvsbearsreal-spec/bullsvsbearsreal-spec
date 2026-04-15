export default function PredictionMarketsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-56 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-hub-card border border-hub-subtle rounded-xl animate-pulse" />
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 mb-4">
          <div className="h-9 w-40 bg-white/[0.06] rounded-lg animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-20 bg-white/[0.06] rounded-full animate-pulse" />
          ))}
        </div>

        {/* Market cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-hub-card border border-hub-subtle rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
