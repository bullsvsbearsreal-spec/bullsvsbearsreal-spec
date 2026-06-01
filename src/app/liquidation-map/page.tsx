'use client';

import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import DataFreshness from '@/components/DataFreshness';
import { useApi } from '@/hooks/useSWRApi';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import PageHero from '@/components/PageHero';
import { TokenIconSimple } from '@/components/TokenIcon';
import { formatUSD, formatPrice } from '@/lib/utils/format';
import {
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Crosshair,
  DollarSign,
  Info,
  Flame,
  Target,
  Scale,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LiquidationLevel {
  price: number;
  type: 'long' | 'short';
  leverage: number;
  estimatedVolume: number;
  distancePercent: number;
}

interface LiquidationMapData {
  symbol: string;
  currentPrice: number;
  levels: LiquidationLevel[];
  totalLongLiq: number;
  totalShortLiq: number;
  exchangeCount?: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// Keep this in sync with SUPPORTED_SYMBOLS in /api/liquidation-map/route.ts.
// If a symbol is added here but missing server-side the API silently falls
// back to BTC (validated tag), so the symbol tab "works" but shows BTC data.
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'AVAX', 'ADA', 'LINK', 'SUI'] as const;

// "Danger zone" — clusters within this % of price are cascade-risk: a single
// move could trip the first level, which feeds the next, etc. Tuned at 3%
// because below that you typically see the immediate post-stop-run liquidity.
const DANGER_ZONE_PCT = 3;

// ---------------------------------------------------------------------------
// Chart component (SVG)
// ---------------------------------------------------------------------------
function LiquidationChart({
  data,
  loading,
  biggestVolume,
}: {
  data: LiquidationMapData | null;
  loading: boolean;
  /** The single biggest cluster volume in the dataset — used to highlight it. */
  biggestVolume: number;
}) {
  if (loading || !data || data.levels.length === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 flex items-center justify-center h-[500px]">
        {loading ? (
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
            <span className="text-neutral-500">Loading liquidation map...</span>
          </div>
        ) : (
          <span className="text-neutral-600">No liquidation levels mapped yet — waiting for data</span>
        )}
      </div>
    );
  }

  const { currentPrice, levels } = data;

  // Separate long (below price) and short (above price) levels
  const longLevels = levels
    .filter((l) => l.type === 'long')
    .sort((a, b) => b.price - a.price); // nearest to current price first
  const shortLevels = levels
    .filter((l) => l.type === 'short')
    .sort((a, b) => a.price - b.price); // nearest to current price first

  // All levels sorted by price for chart y-axis
  const allPrices = levels.map((l) => l.price).concat(currentPrice);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;

  // Chart dimensions
  const chartWidth = 800;
  const chartHeight = 500;
  const marginTop = 30;
  const marginBottom = 30;
  const marginLeft = 90;
  const marginRight = 90;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  // Max volume for bar scaling
  const maxVolume = Math.max(...levels.map((l) => l.estimatedVolume), 1);

  // Price to Y coordinate (higher price = lower Y)
  const priceToY = (price: number) => {
    return marginTop + (1 - (price - minPrice) / priceRange) * plotHeight;
  };

  // Volume to bar width (half of plot width max)
  const maxBarWidth = plotWidth / 2 - 10;
  const volumeToWidth = (volume: number) => {
    return (volume / maxVolume) * maxBarWidth;
  };

  const centerX = marginLeft + plotWidth / 2;
  const currentPriceY = priceToY(currentPrice);

  // Price grid lines
  const gridCount = 8;
  const gridPrices: number[] = [];
  for (let i = 0; i <= gridCount; i++) {
    gridPrices.push(minPrice + (priceRange * i) / gridCount);
  }

  // Format helper for both axis + tooltip
  const fmtPrice = (p: number) =>
    `$${p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 0 }) : p.toFixed(2)}`;

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 sm:p-6 overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto min-w-[600px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {gridPrices.map((price, i) => {
          const y = priceToY(price);
          return (
            <g key={`grid-${i}`}>
              <line
                x1={marginLeft}
                y1={y}
                x2={chartWidth - marginRight}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="4 4"
              />
              <text
                x={marginLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill="rgba(255,255,255,0.3)"
                fontSize="10"
                fontFamily="monospace"
              >
                {fmtPrice(price)}
              </text>
            </g>
          );
        })}

        {/* Center vertical line */}
        <line
          x1={centerX}
          y1={marginTop}
          x2={centerX}
          y2={chartHeight - marginBottom}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />

        {/* Short liquidation bars (green, LEFT side, above current price) */}
        {shortLevels.map((level) => {
          const y = priceToY(level.price);
          const barWidth = volumeToWidth(level.estimatedVolume);
          const barHeight = Math.max(plotHeight / (levels.length + 2), 8);
          const isBiggest = level.estimatedVolume === biggestVolume;
          return (
            <g key={`short-${level.leverage}-${level.price}`} className="liq-bar">
              <title>
                {`Short liq · ${level.leverage}x · ${fmtPrice(level.price)} (+${level.distancePercent.toFixed(2)}%)\nEst volume: ${formatUSD(level.estimatedVolume)}`}
              </title>
              <rect
                x={centerX - barWidth}
                y={y - barHeight / 2}
                width={barWidth}
                height={barHeight}
                fill={isBiggest ? 'rgba(34,197,94,0.9)' : 'rgba(34,197,94,0.5)'}
                stroke={isBiggest ? '#22c55e' : 'transparent'}
                strokeWidth={isBiggest ? 1.5 : 0}
                rx="3"
                ry="3"
              />
              {/* Leverage label on left end */}
              <text
                x={centerX - barWidth - 6}
                y={y + 4}
                textAnchor="end"
                fill="rgba(34,197,94,0.9)"
                fontSize="10"
                fontWeight="600"
                fontFamily="monospace"
              >
                {level.leverage}x
              </text>
              {/* Price label on right */}
              <text
                x={chartWidth - marginRight + 6}
                y={y + 4}
                textAnchor="start"
                fill="rgba(255,255,255,0.4)"
                fontSize="9"
                fontFamily="monospace"
              >
                {fmtPrice(level.price)}
              </text>
            </g>
          );
        })}

        {/* Long liquidation bars (red, RIGHT side, below current price) */}
        {longLevels.map((level) => {
          const y = priceToY(level.price);
          const barWidth = volumeToWidth(level.estimatedVolume);
          const barHeight = Math.max(plotHeight / (levels.length + 2), 8);
          const isBiggest = level.estimatedVolume === biggestVolume;
          return (
            <g key={`long-${level.leverage}-${level.price}`} className="liq-bar">
              <title>
                {`Long liq · ${level.leverage}x · ${fmtPrice(level.price)} (-${level.distancePercent.toFixed(2)}%)\nEst volume: ${formatUSD(level.estimatedVolume)}`}
              </title>
              <rect
                x={centerX}
                y={y - barHeight / 2}
                width={barWidth}
                height={barHeight}
                fill={isBiggest ? 'rgba(239,68,68,0.9)' : 'rgba(239,68,68,0.5)'}
                stroke={isBiggest ? '#ef4444' : 'transparent'}
                strokeWidth={isBiggest ? 1.5 : 0}
                rx="3"
                ry="3"
              />
              {/* Leverage label on right end */}
              <text
                x={centerX + barWidth + 6}
                y={y + 4}
                textAnchor="start"
                fill="rgba(239,68,68,0.9)"
                fontSize="10"
                fontWeight="600"
                fontFamily="monospace"
              >
                {level.leverage}x
              </text>
              {/* Price label on left */}
              <text
                x={marginLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill="rgba(255,255,255,0.4)"
                fontSize="9"
                fontFamily="monospace"
              >
                {fmtPrice(level.price)}
              </text>
            </g>
          );
        })}

        {/* Current price line */}
        <line
          x1={marginLeft}
          y1={currentPriceY}
          x2={chartWidth - marginRight}
          y2={currentPriceY}
          stroke="#FACC15"
          strokeWidth="2"
          strokeDasharray="6 3"
        />
        <rect
          x={centerX - 55}
          y={currentPriceY - 12}
          width={110}
          height={24}
          rx="4"
          fill="#FACC15"
        />
        <text
          x={centerX}
          y={currentPriceY + 4}
          textAnchor="middle"
          fill="#000"
          fontSize="11"
          fontWeight="700"
          fontFamily="monospace"
        >
          {fmtPrice(currentPrice)}
        </text>

        {/* Legend */}
        <g transform={`translate(${marginLeft}, ${chartHeight - 10})`}>
          <rect x="0" y="-8" width="10" height="10" rx="2" fill="rgba(34,197,94,0.5)" />
          <text x="14" y="0" fill="rgba(255,255,255,0.5)" fontSize="10">
            Short Liquidation Clusters (above price)
          </text>
          <rect x="260" y="-8" width="10" height="10" rx="2" fill="rgba(239,68,68,0.5)" />
          <text x="274" y="0" fill="rgba(255,255,255,0.5)" fontSize="10">
            Long Liquidation Clusters (below price)
          </text>
        </g>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="stat-grid-card animate-pulse">
      <div className="h-3 w-20 bg-white/[0.06] rounded mb-3" />
      <div className="h-6 w-28 bg-white/[0.06] rounded mb-2" />
      <div className="h-3 w-16 bg-white/[0.06] rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="section-card animate-pulse">
      <div className="section-card-header">
        <div className="h-4 w-40 bg-white/[0.06] rounded" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 bg-white/[0.06] rounded" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function LiquidationMapPage() {
  const [symbol, setSymbol] = useState<string>('BTC');

  const fetcher = useCallback(async () => {
    const res = await fetch(`/api/liquidation-map?symbol=${symbol}`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const json: LiquidationMapData = await res.json();
    if (json.currentPrice === 0 || json.levels.length === 0) {
      throw new Error('No liquidation data available');
    }
    return json;
  }, [symbol]);

  const { data, error, isLoading: loading, lastUpdate, refresh } = useApi({
    key: `liquidation-map-${symbol}`,
    fetcher,
    refreshInterval: 60000,
  });

  // ── Derived data ─────────────────────────────────────────────────────
  const nearestLong = useMemo(() => {
    if (!data) return null;
    const longs = data.levels
      .filter((l) => l.type === 'long')
      .sort((a, b) => b.price - a.price);
    return longs[0] || null;
  }, [data]);

  const nearestShort = useMemo(() => {
    if (!data) return null;
    const shorts = data.levels
      .filter((l) => l.type === 'short')
      .sort((a, b) => a.price - b.price);
    return shorts[0] || null;
  }, [data]);

  // The single biggest cluster on each side — these are the "magnets" price
  // tends to revisit. Visually pinned in the chart with a brighter fill.
  const biggestLong = useMemo(() => {
    if (!data) return null;
    return data.levels
      .filter((l) => l.type === 'long')
      .reduce<LiquidationLevel | null>((max, l) => (!max || l.estimatedVolume > max.estimatedVolume ? l : max), null);
  }, [data]);

  const biggestShort = useMemo(() => {
    if (!data) return null;
    return data.levels
      .filter((l) => l.type === 'short')
      .reduce<LiquidationLevel | null>((max, l) => (!max || l.estimatedVolume > max.estimatedVolume ? l : max), null);
  }, [data]);

  const biggestVolume = Math.max(biggestLong?.estimatedVolume ?? 0, biggestShort?.estimatedVolume ?? 0);

  // Cascade-risk volume: liquidations within DANGER_ZONE_PCT of current price.
  // If a wick triggers the first cluster, it can feed the next — this is the
  // exposure that matters for short-term squeeze risk.
  const dangerZone = useMemo(() => {
    if (!data) return { long: 0, short: 0 };
    const inZone = data.levels.filter((l) => l.distancePercent <= DANGER_ZONE_PCT);
    return {
      long: inZone.filter((l) => l.type === 'long').reduce((s, l) => s + l.estimatedVolume, 0),
      short: inZone.filter((l) => l.type === 'short').reduce((s, l) => s + l.estimatedVolume, 0),
    };
  }, [data]);

  const totalEstVolume = data ? data.totalLongLiq + data.totalShortLiq : 0;

  // Directional bias copy — translates the long/short split into plain English.
  // The chart shows "where" — this sentence tells you "what".
  const biasLabel = useMemo(() => {
    if (!data || totalEstVolume === 0) return null;
    const longPct = (data.totalLongLiq / totalEstVolume) * 100;
    const diff = Math.abs(longPct - 50);
    if (diff < 5) return { tone: 'neutral' as const, text: 'Liquidations are roughly balanced — no clear cascade side.' };
    if (longPct > 50) {
      return {
        tone: 'bearish' as const,
        text: `Long-side leveraged ${longPct.toFixed(0)}% — a sharp dip would feed more forced selling than an equal-size rally.`,
      };
    }
    return {
      tone: 'bullish' as const,
      text: `Short-side leveraged ${(100 - longPct).toFixed(0)}% — a sharp rally would feed more short-covering than an equal-size dip.`,
    };
  }, [data, totalEstVolume]);

  // Table data grouped by leverage
  const tableRows = useMemo(() => {
    if (!data) return [];
    const leverageMap = new Map<
      number,
      { leverage: number; longPrice: number; shortPrice: number; longVol: number; shortVol: number; longDist: number; shortDist: number }
    >();
    for (const level of data.levels) {
      if (!leverageMap.has(level.leverage)) {
        leverageMap.set(level.leverage, {
          leverage: level.leverage,
          longPrice: 0,
          shortPrice: 0,
          longVol: 0,
          shortVol: 0,
          longDist: 0,
          shortDist: 0,
        });
      }
      const row = leverageMap.get(level.leverage)!;
      if (level.type === 'long') {
        row.longPrice = level.price;
        row.longVol = level.estimatedVolume;
        row.longDist = level.distancePercent;
      } else {
        row.shortPrice = level.price;
        row.shortVol = level.estimatedVolume;
        row.shortDist = level.distancePercent;
      }
    }
    return Array.from(leverageMap.values()).sort((a, b) => a.leverage - b.leverage);
  }, [data]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        <PageHero
          icon={Crosshair}
          eyebrow="Risk · liq density"
          title="Liquidation"
          accentNoun="map"
          accent="red"
          description={
            <>Estimated liquidation clusters based on common leverage tiers (5x,
              10x, 25x, 50x, 100x) and live open interest. Bigger clusters =
              magnets that price tends to revisit before reversing.</>
          }
          className="mb-8"
          actions={
            <>
              <DataFreshness exchangeCount={data?.exchangeCount || 1} lastUpdated={lastUpdate} />
              <button
                onClick={refresh}
                disabled={loading}
                className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                aria-label="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </>
          }
        />

        {/* Symbol tabs — scrollable on mobile when the list is long. */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-accent">
          <div className="btn-group flex-shrink-0">
            {SYMBOLS.map((sym) => (
              <button
                key={sym}
                onClick={() => setSymbol(sym)}
                className={`btn-group-item inline-flex items-center gap-1.5 ${symbol === sym ? 'btn-group-item-active' : ''}`}
                aria-pressed={symbol === sym}
              >
                <TokenIconSimple symbol={sym} size={14} />
                {sym}
              </button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && !loading && (
          <div className="callout callout-warn mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-hub-yellow flex-shrink-0" />
              <p className="text-neutral-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {loading && !data ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <div className="stat-grid-card">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-hub-yellow" />
                  <span className="text-neutral-500 text-xs">Current Price</span>
                </div>
                <div className="text-lg font-bold font-mono text-white">
                  {data ? formatPrice(data.currentPrice) : '--'}
                </div>
                <div className="text-xs text-neutral-600">{symbol}/USDT</div>
              </div>

              <div className="stat-grid-card border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-neutral-500 text-xs">Nearest Long Liq</span>
                </div>
                <div className="text-lg font-bold font-mono text-red-400">
                  {nearestLong ? formatPrice(nearestLong.price) : '--'}
                </div>
                <div className="text-xs text-red-400/50 font-mono">
                  {nearestLong ? `${nearestLong.leverage}x  -${nearestLong.distancePercent.toFixed(1)}%` : '--'}
                </div>
              </div>

              <div className="stat-grid-card border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-neutral-500 text-xs">Nearest Short Liq</span>
                </div>
                <div className="text-lg font-bold font-mono text-green-400">
                  {nearestShort ? formatPrice(nearestShort.price) : '--'}
                </div>
                <div className="text-xs text-green-400/50 font-mono">
                  {nearestShort ? `${nearestShort.leverage}x  +${nearestShort.distancePercent.toFixed(1)}%` : '--'}
                </div>
              </div>

              <div className="stat-grid-card border-hub-yellow/20">
                <div className="flex items-center gap-2 mb-1">
                  <Crosshair className="w-3.5 h-3.5 text-hub-yellow" />
                  <span className="text-neutral-500 text-xs">Total Est. Liq Volume</span>
                </div>
                <div className="text-lg font-bold font-mono text-hub-yellow">
                  {data ? formatUSD(totalEstVolume) : '--'}
                </div>
                <div className="text-xs text-neutral-600 font-mono">
                  {data
                    ? `L: ${formatUSD(data.totalLongLiq)} / S: ${formatUSD(data.totalShortLiq)}`
                    : '--'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Magnet zones + cascade risk (the "what to watch" strip) ───── */}
        {data && (biggestLong || biggestShort) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {/* Biggest long-side magnet */}
            {biggestLong && (
              <div className="bg-gradient-to-br from-red-500/[0.08] to-transparent border border-red-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                    Biggest Long Magnet
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xl font-bold font-mono text-red-400">
                    {formatPrice(biggestLong.price)}
                  </span>
                  <span className="text-xs font-mono text-red-400/60">
                    -{biggestLong.distancePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 font-mono">
                  {biggestLong.leverage}x · ~{formatUSD(biggestLong.estimatedVolume)} forced selling
                </div>
              </div>
            )}

            {/* Biggest short-side magnet */}
            {biggestShort && (
              <div className="bg-gradient-to-br from-green-500/[0.08] to-transparent border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">
                    Biggest Short Magnet
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xl font-bold font-mono text-green-400">
                    {formatPrice(biggestShort.price)}
                  </span>
                  <span className="text-xs font-mono text-green-400/60">
                    +{biggestShort.distancePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 font-mono">
                  {biggestShort.leverage}x · ~{formatUSD(biggestShort.estimatedVolume)} forced buying
                </div>
              </div>
            )}

            {/* Cascade risk */}
            <div className="bg-gradient-to-br from-hub-yellow/[0.06] to-transparent border border-hub-yellow/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-3.5 h-3.5 text-hub-yellow" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-hub-yellow">
                  Cascade Risk · ±{DANGER_ZONE_PCT}%
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xl font-bold font-mono text-hub-yellow">
                  {formatUSD(dangerZone.long + dangerZone.short)}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 font-mono">
                L: {formatUSD(dangerZone.long)} · S: {formatUSD(dangerZone.short)}
              </div>
            </div>
          </div>
        )}

        {/* Long/Short Ratio Bar + bias copy */}
        {data && data.totalLongLiq + data.totalShortLiq > 0 && (() => {
          const total = data.totalLongLiq + data.totalShortLiq;
          const longPct = (data.totalLongLiq / total) * 100;
          return (
            <div className="mb-6 bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-red-400 font-mono">{longPct.toFixed(1)}% Long Liq</span>
                <span className="text-[10px] text-neutral-600 flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  Estimated Long / Short Liq Split
                  <span className="px-1.5 py-0.5 rounded bg-hub-yellow/10 text-hub-yellow text-[9px] font-semibold uppercase tracking-wider">Estimated</span>
                </span>
                <span className="text-xs text-green-400 font-mono">{(100 - longPct).toFixed(1)}% Short Liq</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]">
                <div className="bg-red-500 transition-all duration-500" style={{ width: `${longPct}%` }} />
                <div className="bg-green-500 transition-all duration-500" style={{ width: `${100 - longPct}%` }} />
              </div>
              {biasLabel && (
                <p
                  className={`text-xs mt-3 ${
                    biasLabel.tone === 'bearish'
                      ? 'text-red-400/80'
                      : biasLabel.tone === 'bullish'
                      ? 'text-green-400/80'
                      : 'text-neutral-400'
                  }`}
                >
                  {biasLabel.text}
                </p>
              )}
            </div>
          );
        })()}

        {/* Chart */}
        <div className="mb-6">
          <LiquidationChart data={data} loading={loading && !data} biggestVolume={biggestVolume} />
        </div>

        {/* Leverage Tiers Table */}
        {loading && !data ? (
          <SkeletonTable />
        ) : (
          data && tableRows.length > 0 && (
            <div className="section-card mb-6">
              <div className="section-card-header">
                <div>
                  <h3 className="text-white font-semibold">Leverage Tier Breakdown</h3>
                  <p className="text-neutral-600 text-sm">
                    Estimated liquidation prices and volumes for {symbol} at each leverage level
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto scrollbar-accent">
                <table className="w-full text-sm" aria-label="Liquidation levels">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-neutral-500 font-medium px-4 py-3">Leverage</th>
                      <th className="text-right text-red-400/70 font-medium px-4 py-3">Long Liq Price</th>
                      <th className="text-right text-red-400/70 font-medium px-4 py-3">Distance</th>
                      <th className="text-right text-red-400/70 font-medium px-4 py-3">Est. Volume</th>
                      <th className="text-right text-green-400/70 font-medium px-4 py-3">Short Liq Price</th>
                      <th className="text-right text-green-400/70 font-medium px-4 py-3">Distance</th>
                      <th className="text-right text-green-400/70 font-medium px-4 py-3">Est. Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr
                        key={row.leverage}
                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="text-white font-semibold font-mono">{row.leverage}x</span>
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-red-400">
                          {formatPrice(row.longPrice)}
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-red-400/60 text-xs">
                          -{row.longDist.toFixed(2)}%
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-red-400/80">
                          {formatUSD(row.longVol)}
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-green-400">
                          {formatPrice(row.shortPrice)}
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-green-400/60 text-xs">
                          +{row.shortDist.toFixed(2)}%
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-green-400/80">
                          {formatUSD(row.shortVol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* Educational note */}
        <div className="callout callout-warn">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-hub-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-hub-yellow text-sm font-medium">How This Estimate Works</p>
              <p className="text-neutral-500 text-sm mt-1">
                This liquidation map estimates where leveraged positions would get liquidated based on
                common leverage tiers. Liquidation prices are calculated using the
                simplified formula:
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-neutral-400 text-xs font-mono">
                  Long Liquidation = Entry Price x (1 - 1/Leverage)
                </p>
                <p className="text-neutral-400 text-xs font-mono">
                  Short Liquidation = Entry Price x (1 + 1/Leverage)
                </p>
              </div>
              <p className="text-neutral-500 text-sm mt-2">
                Estimated volumes are weighted by real open interest data from {data ? `${symbol}` : 'the selected asset'} perpetual
                futures across multiple exchanges. Higher leverage tiers carry proportionally less volume
                since fewer traders use extreme leverage.
              </p>
              <p className="text-neutral-700 text-xs mt-3">
                Note: Actual liquidation prices vary by exchange due to different maintenance margin
                requirements, partial liquidation mechanisms, and position sizing. This is a simplified
                model intended to visualize approximate liquidation clusters, not exact levels. Not
                financial advice.
              </p>
            </div>
          </div>
        </div>
      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}
