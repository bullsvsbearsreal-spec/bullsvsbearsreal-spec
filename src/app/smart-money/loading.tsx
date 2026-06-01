export default function SmartMoneyLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-white/[0.06] rounded-md animate-pulse" />
            <div className="h-6 w-36 bg-white/[0.06] rounded animate-pulse" />
            <div className="ml-auto h-4 w-56 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-4 w-[500px] max-w-full bg-white/[0.04] rounded animate-pulse" />
        </div>
        {/* Sentiment + 3 stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,260px,260px,260px] gap-2 mb-4">
          <div className="h-[94px] bg-white/[0.03] rounded-xl animate-pulse" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-[94px] bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-7 w-20 bg-white/[0.06] rounded animate-pulse" />
          ))}
          <div className="ml-auto h-8 w-64 bg-white/[0.04] rounded-lg animate-pulse" />
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 space-y-1.5 min-h-[400px]">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-14 bg-white/[0.03] rounded animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
