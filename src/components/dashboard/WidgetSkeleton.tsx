'use client';

/**
 * Content-shaped loading skeletons for dashboard widgets.
 * Replaces generic spinners with shapes that match actual widget content,
 * reducing perceived load time and layout shift.
 */

type SkeletonVariant = 'stat' | 'list' | 'chart' | 'heatmap' | 'bar' | 'grid';

interface WidgetSkeletonProps {
  variant: SkeletonVariant;
  rows?: number;
}

function Bar({ w, h = 'h-3' }: { w: string; h?: string }) {
  return <div className={`skeleton ${h} rounded ${w}`} />;
}

/** Big number + label — btc-price, fear-greed */
function StatSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <Bar w="w-28" h="h-7" />
      <Bar w="w-16" h="h-2.5" />
      <div className="mt-2">
        <Bar w="w-full" h="h-1.5" />
      </div>
    </div>
  );
}

/** Rows of items — watchlist, portfolio, alerts, trending, token-unlocks, oi-chart */
function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 py-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="skeleton w-3.5 h-3.5 rounded-full" />
            <div className="skeleton h-3 rounded" style={{ width: `${48 + (i % 3) * 16}px` }} />
          </div>
          <Bar w="w-12" />
        </div>
      ))}
    </div>
  );
}

/** Chart area — btc-chart */
function ChartSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <div className="flex items-baseline justify-between">
        <Bar w="w-24" h="h-5" />
        <Bar w="w-8" h="h-2.5" />
      </div>
      <div className="skeleton w-full h-20 rounded-lg" />
    </div>
  );
}

/** Colored tiles — funding-heatmap */
function HeatmapSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="skeleton rounded"
            style={{ width: `${32 + (i % 4) * 8}px`, height: '20px' }}
          />
        ))}
      </div>
      <Bar w="w-20" h="h-2.5" />
    </div>
  );
}

/** Stacked horizontal bar — long-short, dominance */
function BarSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between">
        <Bar w="w-20" h="h-2.5" />
        <Bar w="w-14" h="h-2.5" />
      </div>
      <div className="skeleton w-full h-5 rounded-full" />
      <div className="flex justify-between">
        <Bar w="w-10" h="h-2.5" />
        <Bar w="w-10" h="h-2.5" />
      </div>
    </div>
  );
}

/** 2×2 grid — market-overview */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 py-1">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <Bar w="w-14" h="h-2" />
          <Bar w="w-20" h="h-4" />
          {i === 0 && <Bar w="w-10" h="h-2.5" />}
        </div>
      ))}
    </div>
  );
}

export default function WidgetSkeleton({ variant, rows }: WidgetSkeletonProps) {
  switch (variant) {
    case 'stat':
      return <StatSkeleton />;
    case 'list':
      return <ListSkeleton rows={rows} />;
    case 'chart':
      return <ChartSkeleton />;
    case 'heatmap':
      return <HeatmapSkeleton />;
    case 'bar':
      return <BarSkeleton />;
    case 'grid':
      return <GridSkeleton />;
    default:
      return <StatSkeleton />;
  }
}
