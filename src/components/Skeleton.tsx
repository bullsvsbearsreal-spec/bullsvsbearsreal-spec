export function SkeletonLine({ width = 'w-24', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`skeleton ${width} ${height}`} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card-premium p-4 space-y-3">
      <div className="skeleton h-3 w-20" />
      <div className="skeleton h-6 w-32" />
      {lines > 2 && <div className="skeleton h-3 w-24" />}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="skeleton h-4 w-6" />
          <div className="skeleton h-5 w-5 rounded-full" />
          <div className="skeleton h-4 w-16" />
          {Array.from({ length: cols - 3 }).map((_, j) => (
            <div key={j} className="skeleton h-4 w-20 ml-auto" />
          ))}
        </div>
      ))}
    </div>
  );
}
