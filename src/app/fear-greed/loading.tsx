export default function FearGreedLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="h-7 w-44 bg-white/[0.06] rounded-lg animate-pulse mb-6" />

        {/* Gauge card */}
        <div className="bg-hub-card border border-hub-subtle rounded-xl p-8 flex flex-col items-center mb-6">
          <div className="w-48 h-48 rounded-full bg-white/[0.04] animate-pulse mb-4" />
          <div className="h-8 w-20 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-white/[0.04] rounded animate-pulse" />
        </div>

        {/* History chart */}
        <div className="bg-hub-card border border-hub-subtle rounded-xl p-4">
          <div className="h-4 w-28 bg-white/[0.06] rounded animate-pulse mb-4" />
          <div className="h-56 bg-white/[0.03] rounded-lg animate-pulse" />
        </div>
      </main>
    </div>
  );
}
