export default function StakingLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="h-10 bg-white/[0.06] rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[66px] bg-white/[0.06] rounded-xl animate-pulse" />)}
        </div>
        <div className="bg-white/[0.06] rounded-xl p-3 space-y-1.5 min-h-[500px]">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="h-12 bg-white/[0.06] rounded animate-pulse" />)}
        </div>
      </main>
    </div>
  );
}
