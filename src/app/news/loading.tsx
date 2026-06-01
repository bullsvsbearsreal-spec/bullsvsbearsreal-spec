export default function NewsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title + filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-40 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 w-16 bg-white/[0.06] rounded-full animate-pulse" />
            ))}
          </div>
        </div>

        {/* News cards */}
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-hub-darker border border-hub-subtle rounded-xl p-4 flex gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-white/[0.06] rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-white/[0.04] rounded animate-pulse" />
                <div className="flex gap-2 mt-2">
                  <div className="h-5 w-14 bg-white/[0.06] rounded-full animate-pulse" />
                  <div className="h-5 w-12 bg-white/[0.04] rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
