'use client';

function Pulse({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} style={style} />;
}

export function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <Pulse className="h-3 w-16 mb-2" />
          <Pulse className="h-6 w-12 mb-1" />
          <Pulse className="h-2 w-full mt-2" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3">
        <Pulse className="h-4 w-32" />
        <Pulse className="h-4 w-20 ml-auto" />
      </div>
      <div className="divide-y divide-white/[0.04]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-2.5">
            <Pulse className="h-3.5 w-24" />
            <Pulse className="h-3.5 w-32" />
            <Pulse className="h-3.5 w-16 ml-auto" />
            <Pulse className="h-3.5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 140 }: { height?: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] p-3">
      <Pulse className="h-3 w-28 mb-3" />
      <Pulse className={`w-full rounded`} style={{ height }} />
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
          <Pulse className="h-3 w-16 mb-2" />
          <Pulse className="h-5 w-10" />
        </div>
      ))}
    </div>
  );
}

export function TimelineSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Pulse className="h-6 w-6 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Pulse className="h-3 w-48" />
            <Pulse className="h-2.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
