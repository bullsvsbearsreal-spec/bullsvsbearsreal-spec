export default function FundingLoading() {
  return (
    <div className="min-h-screen bg-hub-black">

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title + controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-white/[0.06] rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-hub-darker border border-hub-subtle rounded-xl animate-pulse" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-hub-darker border border-hub-subtle rounded-xl overflow-hidden">
          <div className="h-12 bg-white/[0.06] border-b border-hub-subtle" />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-hub-subtle flex items-center px-4 gap-4">
              <div className="w-6 h-6 rounded-full bg-white/[0.06] animate-pulse" />
              <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
              <div className="flex-1" />
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
