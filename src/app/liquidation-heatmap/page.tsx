'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { useApiData } from '@/hooks/useApiData';
import { formatUSD, formatPrice, formatRelativeTime } from '@/lib/utils/format';
import {
  RefreshCw,
  AlertTriangle,
  Flame,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────── */

interface HeatmapCell {
  timeIdx: number;
  priceIdx: number;
  volume: number;
  count: number;
  dominantSide: 'long' | 'short';
}

interface LiquidationEvent {
  time: number;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  price: number;
  volume: number;
}

interface LiquidationHeatmapResponse {
  heatmap: {
    timeBuckets: number[];
    priceBuckets: number[];
    cells: HeatmapCell[];
  };
  summary: {
    totalLiquidations: number;
    totalVolume: number;
    longLiqVolume: number;
    shortLiqVolume: number;
    largestSingle: LiquidationEvent;
    recentEvents: LiquidationEvent[];
  };
  currentPrice: number;
  symbol: string;
  timeframe: string;
}

type Symbol = 'BTC' | 'ETH' | 'SOL';
type Timeframe = '4h' | '24h' | '7d';

/* ─── Constants ──────────────────────────────────────────────────── */

const SYMBOLS: Symbol[] = ['BTC', 'ETH', 'SOL'];
const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '4h', label: '4H' },
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
];

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatTimeBucketLabel(ts: number, timeframe: string): string {
  const d = new Date(ts);
  if (timeframe === '7d') {
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* ─── Heatmap SVG Component ──────────────────────────────────────── */

function HeatmapVisualization({
  data,
  loading,
}: {
  data: LiquidationHeatmapResponse | null;
  loading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (loading || !data) {
    return (
      <div
        ref={containerRef}
        className="bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center"
        style={{ height: 500 }}
      >
        {loading ? (
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
            <span className="text-neutral-500">Loading heatmap...</span>
          </div>
        ) : (
          <span className="text-neutral-600">No heatmap data available</span>
        )}
      </div>
    );
  }

  const { heatmap, currentPrice } = data;
  const { timeBuckets, priceBuckets, cells } = heatmap;

  if (timeBuckets.length === 0 || priceBuckets.length === 0 || cells.length === 0) {
    return (
      <div
        ref={containerRef}
        className="bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center"
        style={{ height: 500 }}
      >
        <span className="text-neutral-600">No liquidation data for this period</span>
      </div>
    );
  }

  const svgWidth = containerWidth;
  const svgHeight = 500;
  const paddingLeft = 80;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const numCols = timeBuckets.length;
  const numRows = priceBuckets.length;
  const cellWidth = plotWidth / numCols;
  const cellHeight = plotHeight / numRows;

  const maxVol = Math.max(...cells.map((c) => c.volume), 1);

  const minPrice = Math.min(...priceBuckets);
  const maxPrice = Math.max(...priceBuckets);
  const priceRange = maxPrice - minPrice || 1;
  const currentPriceY =
    paddingTop + plotHeight - ((currentPrice - minPrice) / priceRange) * plotHeight;

  const yLabelCount = Math.min(numRows, 10);
  const yLabelStep = Math.max(1, Math.floor(numRows / yLabelCount));
  const xLabelCount = Math.min(numCols, 12);
  const xLabelStep = Math.max(1, Math.floor(numCols / xLabelCount));

  return (
    <div ref={containerRef} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 overflow-hidden">
      <svg width={svgWidth} height={svgHeight} className="block">
        {/* Cells */}
        {cells.map((cell) => {
          const intensity = Math.min(cell.volume / maxVol, 1);
          const x = paddingLeft + cell.timeIdx * cellWidth;
          const y = paddingTop + (numRows - 1 - cell.priceIdx) * cellHeight;
          const color =
            cell.dominantSide === 'long'
              ? `rgba(239, 68, 68, ${0.1 + intensity * 0.9})`
              : `rgba(34, 197, 94, ${0.1 + intensity * 0.9})`;

          return (
            <rect
              key={`${cell.timeIdx}-${cell.priceIdx}`}
              x={x}
              y={y}
              width={Math.max(cellWidth - 1, 1)}
              height={Math.max(cellHeight - 1, 1)}
              fill={color}
              rx={1}
            >
              <title>
                {`${formatTimeBucketLabel(timeBuckets[cell.timeIdx], data.timeframe)} | $${priceBuckets[cell.priceIdx]?.toLocaleString()}\n${cell.dominantSide.toUpperCase()} | $${cell.volume.toLocaleString()} | ${cell.count} liqs`}
              </title>
            </rect>
          );
        })}

        {/* Current price line */}
        {currentPriceY >= paddingTop && currentPriceY <= paddingTop + plotHeight && (
          <>
            <line
              x1={paddingLeft}
              y1={currentPriceY}
              x2={paddingLeft + plotWidth}
              y2={currentPriceY}
              stroke="#eab308"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              opacity={0.8}
            />
            <rect
              x={paddingLeft + plotWidth - 80}
              y={currentPriceY - 10}
              width={80}
              height={20}
              rx={4}
              fill="#eab308"
            />
            <text
              x={paddingLeft + plotWidth - 40}
              y={currentPriceY + 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fontFamily="monospace"
              fill="#000"
            >
              ${currentPrice.toLocaleString()}
            </text>
          </>
        )}

        {/* Y-axis labels (price) */}
        {Array.from({ length: yLabelCount }).map((_, i) => {
          const idx = i * yLabelStep;
          if (idx >= numRows) return null;
          const price = priceBuckets[idx];
          const y = paddingTop + (numRows - 1 - idx) * cellHeight + cellHeight / 2;
          return (
            <text
              key={`y-${idx}`}
              x={paddingLeft - 8}
              y={y + 3}
              textAnchor="end"
              fontSize={10}
              fill="#737373"
              fontFamily="monospace"
            >
              ${price >= 1000 ? (price / 1000).toFixed(1) + 'K' : price.toFixed(0)}
            </text>
          );
        })}

        {/* X-axis labels (time) */}
        {Array.from({ length: xLabelCount }).map((_, i) => {
          const idx = i * xLabelStep;
          if (idx >= numCols) return null;
          const ts = timeBuckets[idx];
          const x = paddingLeft + idx * cellWidth + cellWidth / 2;
          return (
            <text
              key={`x-${idx}`}
              x={x}
              y={svgHeight - paddingBottom + 16}
              textAnchor="middle"
              fontSize={10}
              fill="#737373"
              fontFamily="monospace"
            >
              {formatTimeBucketLabel(ts, data.timeframe)}
            </text>
          );
        })}

        {/* Axis lines */}
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={paddingTop + plotHeight}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
        <line
          x1={paddingLeft}
          y1={paddingTop + plotHeight}
          x2={paddingLeft + plotWidth}
          y2={paddingTop + plotHeight}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(239, 68, 68, 0.7)' }} />
          <span className="text-[10px] text-neutral-500">Long Liquidations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(34, 197, 94, 0.7)' }} />
          <span className="text-[10px] text-neutral-500">Short Liquidations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-hub-yellow rounded" />
          <span className="text-[10px] text-neutral-500">Current Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded-sm opacity-30" style={{ background: '#666' }} />
          <span className="text-[10px] text-neutral-500">Low Volume</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded-sm" style={{ background: '#fff' }} />
          <span className="text-[10px] text-neutral-500">High Volume</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Summary Card ───────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-neutral-500">{icon}</div>
        <span className="text-xs text-neutral-500 font-medium">{label}</span>
      </div>
      <span className={`text-xl font-bold font-mono ${color ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

/* ─── Recent Liquidations Table ──────────────────────────────────── */

function RecentLiquidationsTable({ events }: { events: LiquidationEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center text-neutral-600 text-sm">
        No recent liquidation events
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => b.time - a.time).slice(0, 20);

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white">Recent Liquidations</h3>
        <p className="text-[11px] text-neutral-600 mt-0.5">Latest forced liquidation events</p>
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-hub-darker z-10">
            <tr className="border-b border-white/[0.06]">
              <th className="text-left text-neutral-500 text-[11px] font-medium px-4 py-2.5">Time</th>
              <th className="text-left text-neutral-500 text-[11px] font-medium px-4 py-2.5">Exchange</th>
              <th className="text-left text-neutral-500 text-[11px] font-medium px-4 py-2.5">Symbol</th>
              <th className="text-left text-neutral-500 text-[11px] font-medium px-4 py-2.5">Side</th>
              <th className="text-right text-neutral-500 text-[11px] font-medium px-4 py-2.5">Price</th>
              <th className="text-right text-neutral-500 text-[11px] font-medium px-4 py-2.5">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {sorted.map((evt, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5 text-xs text-neutral-400 font-mono">
                  {formatRelativeTime(evt.time)}
                </td>
                <td className="px-4 py-2.5 text-xs text-neutral-300">{evt.exchange}</td>
                <td className="px-4 py-2.5 text-xs text-white font-medium">{evt.symbol}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      evt.side === 'long'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-green-500/15 text-green-400'
                    }`}
                  >
                    {evt.side.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-neutral-300 font-mono text-right">
                  {formatPrice(evt.price)}
                </td>
                <td className="px-4 py-2.5 text-xs text-white font-mono font-semibold text-right">
                  {formatUSD(evt.volume)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Largest Liquidation Highlight ──────────────────────────────── */

function LargestLiquidationCard({ event }: { event: LiquidationEvent }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-hub-yellow" />
        <h3 className="text-sm font-semibold text-white">Largest Liquidation</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <span className="text-[10px] text-neutral-500 block">Exchange</span>
          <span className="text-sm font-medium text-white">{event.exchange}</span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-500 block">Side</span>
          <span
            className={`text-sm font-bold ${
              event.side === 'long' ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {event.side.toUpperCase()}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-500 block">Price</span>
          <span className="text-sm font-mono text-white">{formatPrice(event.price)}</span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-500 block">Volume</span>
          <span className="text-sm font-mono font-bold text-hub-yellow">{formatUSD(event.volume)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Page Component ─────────────────────────────────────────────── */

export default function LiquidationHeatmapPage() {
  const [symbol, setSymbol] = useState<Symbol>('BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');

  const fetcher = useCallback(async () => {
    const res = await fetch(`/api/liquidation-heatmap?symbol=${symbol}&timeframe=${timeframe}`);
    if (!res.ok) throw new Error(`Failed to fetch liquidation heatmap (${res.status})`);
    return res.json() as Promise<LiquidationHeatmapResponse>;
  }, [symbol, timeframe]);

  const refreshMs = timeframe === '7d' ? 5 * 60_000 : 30_000;

  const { data, isLoading, isRefreshing, lastUpdate, refresh, error } =
    useApiData<LiquidationHeatmapResponse>({
      fetcher,
      refreshInterval: refreshMs,
    });

  const recentEvents = useMemo(() => data?.summary?.recentEvents ?? [], [data]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="heading-page flex items-center gap-2">
              <Flame className="w-6 h-6 text-hub-yellow" />
              Liquidation Heatmap
            </h1>
            <p className="text-neutral-600 text-xs mt-0.5">
              Forced liquidation density across exchanges
            </p>
          </div>
          <div className="flex items-center gap-3">
            <UpdatedAgo date={lastUpdate} />
            <span className="text-[10px] font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
              Auto-refresh {timeframe === '7d' ? '5m' : '30s'}
            </span>
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white transition-colors text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Symbol tabs */}
          <div className="flex rounded-xl overflow-hidden bg-hub-gray/20 border border-white/[0.06]">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  symbol === s ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Timeframe toggle */}
          <div className="flex rounded-xl overflow-hidden bg-hub-gray/20 border border-white/[0.06]">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  timeframe === tf.key ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-6 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={refresh} className="ml-auto text-xs text-hub-yellow hover:underline">
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                  <div className="h-3 w-20 bg-white/[0.06] rounded mb-3" />
                  <div className="h-7 w-28 bg-white/[0.06] rounded" />
                </div>
              ))}
            </div>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl animate-pulse" style={{ height: 500 }}>
              <div className="h-full bg-white/[0.04] rounded-xl" />
            </div>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 animate-pulse">
              <div className="h-4 w-40 bg-white/[0.06] rounded mb-4" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div className="h-3 w-20 bg-white/[0.06] rounded" />
                  <div className="h-3 w-16 bg-white/[0.06] rounded" />
                  <div className="h-3 w-12 bg-white/[0.06] rounded" />
                  <div className="h-5 w-14 bg-white/[0.06] rounded-full" />
                  <div className="h-3 w-16 bg-white/[0.06] rounded" />
                  <div className="h-3 w-20 bg-white/[0.06] rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={<Flame className="w-4 h-4" />}
                label="Total Liquidations"
                value={data.summary.totalLiquidations.toLocaleString()}
              />
              <StatCard
                icon={<DollarSign className="w-4 h-4" />}
                label="Total Volume"
                value={formatUSD(data.summary.totalVolume)}
              />
              <StatCard
                icon={<TrendingDown className="w-4 h-4" />}
                label="Long Liquidated"
                value={formatUSD(data.summary.longLiqVolume)}
                color="text-red-400"
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="Short Liquidated"
                value={formatUSD(data.summary.shortLiqVolume)}
                color="text-green-400"
              />
            </div>

            {/* Heatmap */}
            <div className="mb-6">
              <HeatmapVisualization data={data} loading={false} />
            </div>

            {/* Largest Liquidation + Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-4">
                {data.summary.largestSingle && (
                  <LargestLiquidationCard event={data.summary.largestSingle} />
                )}

                {/* Long/Short ratio bar */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Long vs Short Breakdown</h3>
                  {data.summary.totalVolume > 0 ? (
                    <>
                      <div className="h-3 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-red-500 transition-all duration-500"
                          style={{
                            width: `${(data.summary.longLiqVolume / data.summary.totalVolume) * 100}%`,
                          }}
                        />
                        <div
                          className="h-full bg-green-500 transition-all duration-500"
                          style={{
                            width: `${(data.summary.shortLiqVolume / data.summary.totalVolume) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-[10px] text-red-400 font-mono">
                          Long {((data.summary.longLiqVolume / data.summary.totalVolume) * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-green-400 font-mono">
                          Short {((data.summary.shortLiqVolume / data.summary.totalVolume) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-neutral-600 text-xs">No volume data</p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2">
                <RecentLiquidationsTable events={recentEvents} />
              </div>
            </div>

            {/* Info footer */}
            <div className="mt-6 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
              <p className="text-neutral-500 text-xs leading-relaxed">
                The liquidation heatmap shows the density of forced position closures across price levels and time. Red cells indicate long positions being liquidated (price moving down), green cells indicate short positions being liquidated (price moving up). Brighter cells represent higher liquidation volume. 4H uses live exchange data; 24H and 7D use the historical database.
              </p>
            </div>
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
