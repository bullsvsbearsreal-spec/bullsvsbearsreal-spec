export default function CompareTradersLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse" />
          <div className="h-4 w-20 bg-white/[0.04] rounded animate-pulse" />
          <div className="h-4 w-20 bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-hub-yellow/10 rounded-md animate-pulse" />
            <div className="h-6 w-48 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="h-4 w-[500px] max-w-full bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="h-[80px] bg-white/[0.03] rounded-xl animate-pulse mb-4" />
        <div className="h-[500px] bg-white/[0.03] rounded-xl animate-pulse" />
      </main>
    </div>
  );
}
