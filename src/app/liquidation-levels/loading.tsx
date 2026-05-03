export default function LiquidationLevelsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-red-400/10 rounded-md animate-pulse" />
            <div className="h-6 w-40 bg-white/[0.06] rounded animate-pulse" />
            <div className="ml-auto h-4 w-48 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-4 w-[500px] max-w-full bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-7 w-16 bg-white/[0.06] rounded animate-pulse" />
          ))}
          <div className="ml-auto h-7 w-36 bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[66px] bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="h-[400px] bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
