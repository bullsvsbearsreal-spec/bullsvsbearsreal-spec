export default function OptionsIvLoading() {
  return (
    <div className="min-h-screen bg-hub-black">
      <div className="h-14 bg-hub-card border-b border-hub-subtle" />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="h-10 bg-white/[0.04] rounded animate-pulse mb-4" />
        <div className="h-8 w-48 bg-white/[0.04] rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[66px] bg-white/[0.03] rounded-xl animate-pulse" />)}
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 space-y-1.5 min-h-[400px]">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
        </div>
      </main>
    </div>
  );
}
