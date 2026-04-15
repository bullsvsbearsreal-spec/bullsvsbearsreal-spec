export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-32 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-white/[0.06] rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Widget grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Large widget */}
          <div className="sm:col-span-2 h-48 bg-hub-card border border-hub-subtle rounded-2xl animate-pulse" />
          {/* Stat widgets */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 bg-hub-card border border-hub-subtle rounded-2xl animate-pulse" />
          ))}
          {/* Chart widget */}
          <div className="sm:col-span-2 h-52 bg-hub-card border border-hub-subtle rounded-2xl animate-pulse" />
          {/* List widgets */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-44 bg-hub-card border border-hub-subtle rounded-2xl animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
