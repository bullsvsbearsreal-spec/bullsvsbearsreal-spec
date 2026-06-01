export default function MomentumLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="h-10 bg-white/[0.04] rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[66px] bg-white/[0.03] rounded-xl animate-pulse" />)}
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 space-y-1.5 min-h-[500px]">
          {Array.from({ length: 14 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
        </div>
      </main>
    </div>
  );
}
