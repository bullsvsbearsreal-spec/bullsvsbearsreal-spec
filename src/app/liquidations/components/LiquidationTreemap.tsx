'use client';

import { Grid3X3 } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { formatLiqValue } from '@/lib/utils/format';

interface TreemapItem {
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
  count: number;
}

interface LiquidationTreemapProps {
  data: TreemapItem[];
  isLoading: boolean;
  onSymbolClick?: (symbol: string) => void;
}

/** Tile intensity from 0 to 1 — drives color opacity */
function getIntensity(value: number, maxValue: number): number {
  if (maxValue <= 0) return 0.2;
  return Math.min(1, Math.pow(value / maxValue, 0.55));
}

/** Returns inline bg style based on long/short dominance */
function getTileBg(item: TreemapItem, maxValue: number): string {
  const total = item.longValue + item.shortValue;
  if (total === 0) return 'rgba(255,255,255,0.02)';
  const intensity = getIntensity(item.totalValue, maxValue);
  const alpha = (0.08 + intensity * 0.32).toFixed(3);
  return item.longValue > item.shortValue
    ? `rgba(239, 68, 68, ${alpha})`
    : `rgba(34, 197, 94, ${alpha})`;
}

export default function LiquidationTreemap({
  data,
  isLoading,
  onSymbolClick,
}: LiquidationTreemapProps) {
  const heroItems = data.slice(0, 3);
  const gridItems = data.slice(3, 20);
  const maxValue = data.length > 0 ? data[0].totalValue : 0;

  // ─── Loading ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="border border-hub-subtle rounded-2xl bg-hub-dark/30 overflow-hidden">
        <TreemapHeader count={0} />
        <div className="flex items-center justify-center h-52">
          <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ─── Empty ──────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="border border-hub-subtle rounded-2xl bg-hub-dark/30 overflow-hidden">
        <TreemapHeader count={0} />
        <div className="flex flex-col items-center justify-center h-52 gap-2">
          <Grid3X3 className="w-7 h-7 text-neutral-800" />
          <p className="text-sm text-neutral-500">No liquidation data available</p>
          <p className="text-xs text-neutral-600">
            Data will appear as liquidation events are recorded
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-hub-subtle rounded-2xl bg-hub-dark/30 overflow-hidden">
      <TreemapHeader count={data.length} />

      <div className="p-3">
        {/* Hero tiles — top 3 largest */}
        {heroItems.length > 0 && (() => {
          const heroTotal = heroItems.reduce((s, i) => s + i.totalValue, 0);
          // Compute flex grow proportions, capped so the dominant tile doesn't crush others
          const rawPcts = heroItems.map(i => heroTotal > 0 ? (i.totalValue / heroTotal) * 100 : 33);
          // Cap any tile at 65% and ensure min 15% — use flex-grow for proportional sizing
          const flexValues = rawPcts.map(p => Math.max(15, Math.min(65, p)));
          return (
            <div className="flex gap-2 mb-2">
              {heroItems.map((item, idx) => (
                <HeroTile
                  key={item.symbol}
                  item={item}
                  maxValue={maxValue}
                  flexGrow={flexValues[idx]}
                  onClick={() => onSymbolClick?.(item.symbol)}
                />
              ))}
            </div>
          );
        })()}

        {/* Grid tiles */}
        {gridItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {gridItems.map((item) => (
              <GridTile
                key={item.symbol}
                item={item}
                maxValue={maxValue}
                onClick={() => onSymbolClick?.(item.symbol)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────

function TreemapHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-hub-subtle">
      <div className="flex items-center gap-2.5">
        <Grid3X3 className="w-4 h-4 text-neutral-500" />
        <span className="text-sm font-medium text-neutral-300">Liquidation Heatmap</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-[10px] text-neutral-600">
          <span className="w-2 h-2 rounded-sm bg-red-500/40" /> Longs
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-neutral-600">
          <span className="w-2 h-2 rounded-sm bg-green-500/40" /> Shorts
        </span>
        {count > 0 && (
          <span className="text-[10px] font-mono text-neutral-600 bg-white/[0.03] px-1.5 py-0.5 rounded-md">
            {count} tokens
          </span>
        )}
      </div>
    </div>
  );
}

function HeroTile({
  item,
  maxValue,
  flexGrow,
  onClick,
}: {
  item: TreemapItem;
  maxValue: number;
  flexGrow: number;
  onClick: () => void;
}) {
  const total = item.longValue + item.shortValue;
  const longPct = total > 0 ? (item.longValue / total) * 100 : 50;
  const shortPct = 100 - longPct;
  const isLongDominant = longPct >= 50;
  const intensity = getIntensity(item.totalValue, maxValue);

  return (
    <button
      onClick={onClick}
      style={{ flex: `${flexGrow} 1 0%`, background: getTileBg(item, maxValue) }}
      className="relative h-[110px] min-w-0 rounded-xl border border-white/[0.06] p-3 flex flex-col justify-between hover:border-white/[0.12] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-hub-yellow/50 focus-visible:outline-none transition-all text-left group overflow-hidden"
    >
      {/* Top: Token info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TokenIconSimple symbol={item.symbol} size={20} />
          <span className="text-sm font-bold text-white">{item.symbol}</span>
        </div>
        <span className="text-[10px] text-neutral-500 font-medium">
          {item.count.toLocaleString()} liq{item.count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Bottom: Value + ratio */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className={`text-lg font-mono font-bold tabular-nums ${intensity > 0.5 ? 'text-white' : 'text-neutral-200'}`}>
            {formatLiqValue(item.totalValue)}
          </span>
          <span className={`text-[10px] font-mono font-semibold ${isLongDominant ? 'text-red-400/70' : 'text-green-400/70'}`}>
            {(isLongDominant ? longPct : shortPct).toFixed(0)}% {isLongDominant ? 'Long' : 'Short'}
          </span>
        </div>
        {/* Ratio bar */}
        <div className="h-1 rounded-full overflow-hidden bg-black/30 mt-2 flex">
          <div className="bg-red-400/80 h-full transition-all duration-500" style={{ width: `${longPct}%` }} />
          <div className="bg-green-400/80 h-full transition-all duration-500" style={{ width: `${shortPct}%` }} />
        </div>
      </div>
    </button>
  );
}

function GridTile({
  item,
  maxValue,
  onClick,
}: {
  item: TreemapItem;
  maxValue: number;
  onClick: () => void;
}) {
  const total = item.longValue + item.shortValue;
  const longPct = total > 0 ? (item.longValue / total) * 100 : 50;
  const isLongDominant = longPct >= 50;

  return (
    <button
      onClick={onClick}
      style={{ background: getTileBg(item, maxValue) }}
      className="h-[56px] rounded-lg border border-white/[0.04] p-2.5 flex flex-col justify-between hover:border-white/[0.1] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-hub-yellow/50 focus-visible:outline-none transition-all text-left group"
    >
      <div className="flex items-center gap-1.5">
        <TokenIconSimple symbol={item.symbol} size={13} />
        <span className="text-[11px] font-semibold text-neutral-200 truncate">{item.symbol}</span>
        <span className="text-[8px] text-neutral-600 ml-auto shrink-0 font-medium">{item.count}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-bold text-neutral-300 tabular-nums">
          {formatLiqValue(item.totalValue)}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${isLongDominant ? 'bg-red-400/70' : 'bg-green-400/70'}`} />
      </div>
    </button>
  );
}
