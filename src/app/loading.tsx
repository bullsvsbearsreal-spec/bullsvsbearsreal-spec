export default function Loading() {
  return (
    <div className="min-h-screen bg-hub-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        <span className="text-neutral-500 text-xs">Loading...</span>
      </div>
    </div>
  );
}
