export default function TokenUnlocksLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="h-7 w-36 bg-white/[0.06] rounded-lg animate-pulse mb-6" />

        {/* Calendar-style grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-hub-card border border-hub-subtle rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white/[0.06] rounded-full animate-pulse" />
                <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />
                <div className="flex-1" />
                <div className="h-5 w-14 bg-white/[0.04] rounded-full animate-pulse" />
              </div>
              <div className="h-3 w-full bg-white/[0.04] rounded animate-pulse" />
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-white/[0.06] rounded animate-pulse" />
                <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
