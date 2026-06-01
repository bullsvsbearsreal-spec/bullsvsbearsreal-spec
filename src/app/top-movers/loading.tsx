export default function TopMoversLoading() {
  return (
    <div className="min-h-screen bg-hub-black">

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="h-7 w-36 bg-white/[0.06] rounded-lg animate-pulse mb-6" />

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-hub-darker border border-hub-subtle rounded-xl p-4 space-y-2">
              <div className="h-3 w-16 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-6 w-20 bg-white/[0.06] rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-hub-darker border border-hub-subtle rounded-xl overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.03]">
              <div className="w-6 h-6 bg-white/[0.06] rounded-full animate-pulse" />
              <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
              <div className="flex-1" />
              <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-4 w-14 bg-white/[0.04] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
