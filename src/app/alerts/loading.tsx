export default function AlertsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-32 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="h-8 w-28 bg-white/[0.06] rounded-lg animate-pulse" />
        </div>

        {/* Add alert form skeleton */}
        <div className="bg-hub-card border border-hub-subtle rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <div className="h-10 w-32 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-10 w-28 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-10 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-10 w-24 bg-white/[0.06] rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Alert cards */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-hub-card border border-hub-subtle rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
