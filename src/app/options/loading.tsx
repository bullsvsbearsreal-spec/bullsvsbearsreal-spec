export default function OptionsLoading() {
  return (
    <div className="min-h-screen bg-hub-black">

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-36 bg-white/[0.06] rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-white/[0.06] rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-white/[0.06] rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-hub-darker border border-hub-subtle rounded-xl animate-pulse" />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="h-[250px] bg-hub-darker border border-hub-subtle rounded-xl animate-pulse" />
          <div className="h-[250px] bg-hub-darker border border-hub-subtle rounded-xl animate-pulse" />
        </div>

        {/* Table */}
        <div className="bg-hub-darker border border-hub-subtle rounded-xl overflow-hidden">
          <div className="h-10 bg-white/[0.06] border-b border-hub-subtle" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-hub-subtle animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
