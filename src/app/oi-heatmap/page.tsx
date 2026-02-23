'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { useApiData } from '@/hooks/useApiData';
import { formatUSD, formatPercent, formatCompact } from '@/lib/utils/format';
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Activity } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OIEntry {
  symbol: string;
  exchange: string;
  openInterest: number;
  openInterestValue: number;
}

interface OIDelta {
  symbol: string;
  currentOI: number;
  change1h: number | null;
  change4h: number | null;
  change24h: number | null;
}

interface AggregatedOI {
  symbol: string;
  totalOI: number;
  change24h: number | null;
  exchangeCount: number;
}

type CountFilter = 20 | 50 | 'all';

// ---------------------------------------------------------------------------
// Squarified treemap algorithm
// ---------------------------------------------------------------------------

interface TreemapRect {
  item: AggregatedOI;
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarify(
  items: AggregatedOI[],
  x: number,
  y: number,
  w: number,
  h: number,
  sizeKey: 'totalOI',
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ item: items[0], x, y, w, h }];
  }

  const total = items.reduce((sum, it) => sum + it[sizeKey], 0);
  if (total === 0) return [];

  const vertical = w >= h;
  const length = vertical ? w : h;

  let partialSum = 0;
  let bestRatio = Infinity;
  let splitIdx = 0;

  for (let i = 0; i < items.length - 1; i++) {
    partialSum += items[i][sizeKey];
    const fraction = partialSum / total;
    const remaining = 1 - fraction;

    const r1 = vertical
      ? Math.max((length * fraction) / h, h / (length * fraction))
      : Math.max((length * fraction) / w, w / (length * fraction));
    const r2 = vertical
      ? Math.max((length * remaining) / h, h / (length * remaining))
      : Math.max((length * remaining) / w, w / (length * remaining));

    const maxRatio = Math.max(r1, r2);
    if (maxRatio < bestRatio) {
      bestRatio = maxRatio;
      splitIdx = i;
    }
  }

  const left = items.slice(0, splitIdx + 1);
  const right = items.slice(splitIdx + 1);
  const leftFraction = left.reduce((s, it) => s + it[sizeKey], 0) / total;

  let leftRects: TreemapRect[];
  let rightRects: TreemapRect[];

  if (vertical) {
    const splitX = w * leftFraction;
    leftRects = squarify(left, x, y, splitX, h, sizeKey);
    rightRects = squarify(right, x + splitX, y, w - splitX, h, sizeKey);
  } else {
    const splitY = h * leftFraction;
    leftRects = squarify(left, x, y, w, splitY, sizeKey);
    rightRects = squarify(right, x, y + splitY, w, h - splitY, sizeKey);
  }

  return [...leftRects, ...rightRects];
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function getOIChangeColor(change: number | null): string {
  if (change === null || change === undefined || isNaN(change)) return 'rgba(80, 80, 80, 0.6)';
  if (change >= 20) return 'rgba(34, 197, 94, 0.9)';
  if (change >= 10) return 'rgba(34, 197, 94, 0.75)';
  if (change >= 5) return 'rgba(34, 197, 94, 0.6)';
  if (change >= 2) return 'rgba(34, 197, 94, 0.4)';
  if (change >= 0.5) return 'rgba(34, 197, 94, 0.25)';
  if (change > -0.5) return 'rgba(80, 80, 80, 0.5)';
  if (change > -2) return 'rgba(239, 68, 68, 0.25)';
  if (change > -5) return 'rgba(239, 68, 68, 0.4)';
  if (change > -10) return 'rgba(239, 68, 68, 0.6)';
  if (change > -20) return 'rgba(239, 68, 68, 0.75)';
  return 'rgba(239, 68, 68, 0.9)';
}

function getOIChangeBorder(change: number | null): string {
  if (change === null || change === undefined || isNaN(change)) return 'rgba(120, 120, 120, 0.3)';
  if (change >= 0.5) return 'rgba(34, 197, 94, 0.3)';
  if (change > -0.5) return 'rgba(120, 120, 120, 0.3)';
  return 'rgba(239, 68, 68, 0.3)';
}

function getChangeTextColor(change: number | null): string {
  if (change === null || change === undefined || isNaN(change)) return 'text-neutral-400';
  if (change >= 0.5) return 'text-green-400';
  if (change > -0.5) return 'text-neutral-400';
  return 'text-red-400';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OIHeatmapPage() {
  const [count, setCount] = useState<CountFilter>(50);
  const [hoveredItem, setHoveredItem] = useState<AggregatedOI | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch both APIs in parallel
  const {
    data: oiData,
    error: oiError,
    isLoading: oiLoading,
    lastUpdate: oiLastUpdate,
    refresh: oiRefresh,
    isRefreshing: oiRefreshing,
  } = useApiData<{ data: OIEntry[] }>({
    fetcher: useCallback(async () => {
      const res = await fetch('/api/openinterest');
      if (!res.ok) throw new Error(`OI API HTTP ${res.status}`);
      return res.json();
    }, []),
    refreshInterval: 3 * 60 * 1000,
  });

  const {
    data: deltaData,
    error: deltaError,
    isLoading: deltaLoading,
  } = useApiData<{ data: OIDelta[] }>({
    fetcher: useCallback(async () => {
      const res = await fetch('/api/oi-delta');
      if (!res.ok) throw new Error(`Delta API HTTP ${res.status}`);
      return res.json();
    }, []),
    refreshInterval: 5 * 60 * 1000,
  });

  const isLoading = oiLoading || deltaLoading;
  const error = oiError || deltaError;
  const isRefreshing = oiRefreshing;
  const lastUpdate = oiLastUpdate;

  // Aggregate OI by symbol and merge with deltas
  const aggregated = useMemo(() => {
    if (!oiData?.data) return [];

    // Sum OI per symbol
    const symbolMap = new Map<string, { totalOI: number; exchangeCount: number }>();
    for (const entry of oiData.data) {
      const sym = entry.symbol.toUpperCase();
      const val = entry.openInterestValue || 0;
      if (val <= 0) continue;
      const existing = symbolMap.get(sym);
      if (existing) {
        existing.totalOI += val;
        existing.exchangeCount += 1;
      } else {
        symbolMap.set(sym, { totalOI: val, exchangeCount: 1 });
      }
    }

    // Build delta lookup
    const deltaMap = new Map<string, OIDelta>();
    if (Array.isArray(deltaData?.data)) {
      for (const d of deltaData.data) {
        deltaMap.set(d.symbol.toUpperCase(), d);
      }
    }

    // Merge
    const result: AggregatedOI[] = [];
    symbolMap.forEach((agg, symbol) => {
      const delta = deltaMap.get(symbol);
      result.push({
        symbol,
        totalOI: agg.totalOI,
        change24h: delta?.change24h ?? null,
        exchangeCount: agg.exchangeCount,
      });
    });

    // Sort by OI descending
    result.sort((a, b) => b.totalOI - a.totalOI);

    return result;
  }, [oiData, deltaData]);

  // Apply count filter
  const filtered = useMemo(() => {
    if (count === 'all') return aggregated;
    return aggregated.slice(0, count);
  }, [aggregated, count]);

  // Compute treemap rects
  const rects = useMemo(() => {
    if (filtered.length === 0) return [];
    return squarify(filtered, 0, 0, 100, 60, 'totalOI');
  }, [filtered]);

  // Summary statistics
  const stats = useMemo(() => {
    if (filtered.length === 0) {
      return {
        totalOI: 0,
        biggestGainer: null as AggregatedOI | null,
        biggestLoser: null as AggregatedOI | null,
      };
    }

    const totalOI = filtered.reduce((s, it) => s + it.totalOI, 0);

    let biggestGainer: AggregatedOI | null = null;
    let biggestLoser: AggregatedOI | null = null;

    for (const item of filtered) {
      if (item.change24h === null) continue;
      if (!biggestGainer || item.change24h > (biggestGainer.change24h ?? -Infinity)) {
        biggestGainer = item;
      }
      if (!biggestLoser || item.change24h < (biggestLoser.change24h ?? Infinity)) {
        biggestLoser = item;
      }
    }

    return { totalOI, biggestGainer, biggestLoser };
  }, [filtered]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const refresh = useCallback(() => {
    oiRefresh();
  }, [oiRefresh]);

  return (
    <div className="min-h-screen bg-hub-black text-white">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="heading-page">OI Change Heatmap</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Open interest sized by total OI, colored by 24h change
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && <UpdatedAgo date={lastUpdate} />}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-[11px] text-neutral-500">Total Open Interest</span>
            </div>
            <div className="text-lg font-bold text-white">
              {isLoading ? (
                <span className="inline-block w-20 h-6 bg-white/[0.02] animate-pulse rounded" />
              ) : (
                formatUSD(stats.totalOI)
              )}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[11px] text-neutral-500">Biggest OI Gainer (24h)</span>
            </div>
            {isLoading ? (
              <span className="inline-block w-28 h-6 bg-white/[0.02] animate-pulse rounded" />
            ) : stats.biggestGainer ? (
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">{stats.biggestGainer.symbol}</span>
                <span className="text-sm font-mono text-green-400">
                  {formatPercent(stats.biggestGainer.change24h)}
                </span>
              </div>
            ) : (
              <span className="text-sm text-neutral-600">No data</span>
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[11px] text-neutral-500">Biggest OI Loser (24h)</span>
            </div>
            {isLoading ? (
              <span className="inline-block w-28 h-6 bg-white/[0.02] animate-pulse rounded" />
            ) : stats.biggestLoser ? (
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">{stats.biggestLoser.symbol}</span>
                <span className="text-sm font-mono text-red-400">
                  {formatPercent(stats.biggestLoser.change24h)}
                </span>
              </div>
            ) : (
              <span className="text-sm text-neutral-600">No data</span>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {([20, 50, 'all'] as CountFilter[]).map(n => (
              <button
                key={String(n)}
                onClick={() => setCount(n)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  count === n
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {n === 'all' ? 'All' : `Top ${n}`}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-neutral-600">
            {filtered.length} symbols
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="w-full bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden" style={{ paddingBottom: '60%' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && rects.length === 0 && oiData && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-neutral-500 text-sm mb-2">No OI heatmap data available</div>
            <div className="text-neutral-600 text-xs">Open interest data may be temporarily unavailable</div>
          </div>
        )}

        {/* Treemap heatmap (SVG) */}
        {!isLoading && rects.length > 0 && (
          <div
            ref={containerRef}
            className="relative w-full bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden"
            style={{ paddingBottom: '60%' }}
            onMouseMove={handleMouseMove}
          >
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 60"
              preserveAspectRatio="none"
            >
              {rects.map((rect) => {
                const minDim = Math.min(rect.w, rect.h);
                const showSymbol = minDim > 2.5;
                const showOI = minDim > 4.5;
                const showChange = minDim > 4.5;
                const symbolFontSize = Math.max(0.8, Math.min(3.2, minDim * 0.28));
                const detailFontSize = Math.max(0.55, Math.min(2.0, minDim * 0.16));
                const cx = rect.x + rect.w / 2;
                const cy = rect.y + rect.h / 2;

                return (
                  <g
                    key={rect.item.symbol}
                    onMouseEnter={() => setHoveredItem(rect.item)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={rect.x}
                      y={rect.y}
                      width={rect.w}
                      height={rect.h}
                      fill={getOIChangeColor(rect.item.change24h)}
                      stroke={getOIChangeBorder(rect.item.change24h)}
                      strokeWidth={0.12}
                      rx={0.3}
                      ry={0.3}
                    />
                    {/* Hover highlight */}
                    <rect
                      x={rect.x}
                      y={rect.y}
                      width={rect.w}
                      height={rect.h}
                      fill="transparent"
                      rx={0.3}
                      ry={0.3}
                      className="transition-all duration-150 hover:fill-white/[0.08]"
                    />
                    {showSymbol && (
                      <text
                        x={cx}
                        y={showOI ? cy - detailFontSize * 0.6 : cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontWeight="700"
                        fontSize={symbolFontSize}
                        style={{ pointerEvents: 'none' }}
                      >
                        {rect.item.symbol}
                      </text>
                    )}
                    {showOI && (
                      <text
                        x={cx}
                        y={cy + symbolFontSize * 0.45}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="rgba(255,255,255,0.7)"
                        fontSize={detailFontSize}
                        style={{ pointerEvents: 'none' }}
                      >
                        {formatCompact(rect.item.totalOI)}
                      </text>
                    )}
                    {showChange && rect.item.change24h !== null && (
                      <text
                        x={cx}
                        y={cy + symbolFontSize * 0.45 + detailFontSize * 1.25}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={
                          rect.item.change24h >= 0.5
                            ? 'rgba(134, 239, 172, 0.9)'
                            : rect.item.change24h <= -0.5
                              ? 'rgba(252, 165, 165, 0.9)'
                              : 'rgba(200, 200, 200, 0.7)'
                        }
                        fontSize={detailFontSize}
                        fontWeight="500"
                        style={{ pointerEvents: 'none' }}
                      >
                        {rect.item.change24h >= 0 ? '+' : ''}
                        {rect.item.change24h.toFixed(1)}%
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Tooltip */}
            {hoveredItem && (
              <div
                className="fixed z-50 pointer-events-none bg-[#121216] border border-white/[0.1] rounded-lg p-3 shadow-xl"
                style={{
                  left: tooltipPos.x + 14,
                  top: tooltipPos.y + 14,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-bold text-white text-sm">{hoveredItem.symbol}</span>
                  <span className="text-neutral-500 text-xs">
                    {hoveredItem.exchangeCount} exchange{hoveredItem.exchangeCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-6">
                    <span className="text-neutral-500">Total OI</span>
                    <span className="text-white font-mono">{formatUSD(hoveredItem.totalOI)}</span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-neutral-500">24h Change</span>
                    <span className={`font-mono ${getChangeTextColor(hoveredItem.change24h)}`}>
                      {hoveredItem.change24h !== null
                        ? formatPercent(hoveredItem.change24h)
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        {!isLoading && rects.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 mb-2">
            <span className="text-[10px] text-neutral-500 mr-1">-20%+</span>
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(239, 68, 68, 0.9)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(239, 68, 68, 0.75)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(239, 68, 68, 0.6)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(239, 68, 68, 0.4)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(239, 68, 68, 0.25)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(80, 80, 80, 0.5)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(34, 197, 94, 0.25)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(34, 197, 94, 0.4)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(34, 197, 94, 0.6)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(34, 197, 94, 0.75)' }} />
            <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(34, 197, 94, 0.9)' }} />
            <span className="text-[10px] text-neutral-500 ml-1">+20%+</span>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
