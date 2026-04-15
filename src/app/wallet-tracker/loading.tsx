export default function WalletTrackerLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-40 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="h-8 w-32 bg-white/[0.06] rounded-lg animate-pulse" />
        </div>

        {/* Search + add wallet */}
        <div className="bg-hub-card border border-hub-subtle rounded-xl p-4 mb-6">
          <div className="h-10 w-full bg-white/[0.06] rounded-lg animate-pulse" />
        </div>

        {/* Wallet cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-hub-card border border-hub-subtle rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
