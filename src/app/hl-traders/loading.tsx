export default function HLTradersLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="w-7 h-7 bg-purple-500/10 rounded-md animate-pulse" />
            <div className="h-6 w-52 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-5 w-32 bg-white/[0.04] rounded animate-pulse" />
            <div className="ml-auto h-4 w-40 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-4 w-[440px] max-w-full bg-white/[0.04] rounded animate-pulse mb-3" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-72 bg-white/[0.04] rounded-lg animate-pulse" />
            <div className="h-8 w-24 bg-white/[0.04] rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[66px] bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-7 w-16 bg-white/[0.06] rounded animate-pulse" />
          ))}
          <div className="ml-auto h-8 w-64 bg-white/[0.04] rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-4">
          <div className="bg-white/[0.03] rounded-xl p-3 space-y-1.5 min-h-[600px]">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />
            ))}
          </div>
          <div className="hidden lg:block h-[480px] bg-white/[0.03] rounded-xl animate-pulse" />
        </div>
      </main>
    </div>
  );
}
