export default function LeverageLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-white/[0.06] rounded-md animate-pulse" />
            <div className="h-6 w-56 bg-white/[0.06] rounded animate-pulse" />
            <div className="ml-auto h-4 w-48 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-4 w-[480px] max-w-full bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[66px] bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-7 w-80 bg-white/[0.06] rounded-lg animate-pulse mb-3" />
        <div className="bg-white/[0.03] rounded-xl p-3 space-y-1.5 min-h-[500px]">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
