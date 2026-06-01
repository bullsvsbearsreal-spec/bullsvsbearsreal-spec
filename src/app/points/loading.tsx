export default function PointsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-hub-yellow/10 rounded-md animate-pulse" />
            <div className="h-6 w-52 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-4 w-[480px] max-w-full bg-white/[0.06] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[58px] bg-white/[0.06] rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[70px] bg-white/[0.06] rounded-xl animate-pulse mb-4" />
        <div className="flex gap-1 mb-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-7 w-20 bg-white/[0.06] rounded animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[260px] bg-white/[0.06] rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
