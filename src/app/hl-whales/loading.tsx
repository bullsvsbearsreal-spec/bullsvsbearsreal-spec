export default function HLWhalesLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="h-7 w-32 bg-white/[0.06] rounded-lg animate-pulse mb-6" />

        {/* Table */}
        <div className="bg-hub-card border border-hub-subtle rounded-xl overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3 border-b border-hub-subtle">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 w-20 bg-white/[0.06] rounded animate-pulse" />
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.03]">
              <div className="h-4 w-28 bg-white/[0.06] rounded animate-pulse font-mono" />
              <div className="h-4 w-20 bg-white/[0.04] rounded animate-pulse" />
              <div className="flex-1" />
              <div className="h-4 w-16 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-3 w-14 bg-white/[0.04] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
