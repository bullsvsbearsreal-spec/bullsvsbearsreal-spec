export default function DominanceLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="h-7 w-44 bg-white/[0.06] rounded-lg animate-pulse mb-6" />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-hub-card border border-hub-subtle rounded-xl p-4 space-y-2">
              <div className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-7 w-16 bg-white/[0.06] rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-hub-card border border-hub-subtle rounded-xl p-4">
          <div className="h-4 w-36 bg-white/[0.06] rounded animate-pulse mb-4" />
          <div className="h-72 bg-white/[0.03] rounded-lg animate-pulse" />
        </div>
      </main>
    </div>
  );
}
