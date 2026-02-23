'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { formatUSD, formatPrice } from '@/lib/utils/format';
import {
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Crosshair,
  DollarSign,
  Info,
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
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SYMBOLS = ['BTC', 'ETH', 'SOL'] as const;

// ---------------------------------------------------------------------------
// Chart component (SVG)
// ---------------------------------------------------------------------------
function LiquidationChart({
  data,
  loading,
}: {
  data: LiquidationMapData | null;
  loading: boolean;
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
          <span className="text-neutral-600">No data available</span>
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
                ${price >= 1000 ? price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : price.toFixed(2)}
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
          return (
            <g key={`short-${level.leverage}`}>
              <rect
                x={centerX - barWidth}
                y={y - barHeight / 2}
                width={barWidth}
                height={barHeight}
                fill="rgba(34,197,94,0.5)"
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
                ${level.price >= 1000 ? level.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : level.price.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Long liquidation bars (red, RIGHT side, below current price) */}
        {longLevels.map((level) => {
          const y = priceToY(level.price);
          const barWidth = volumeToWidth(level.estimatedVolume);
          const barHeight = Math.max(plotHeight / (levels.length + 2), 8);
          return (
            <g key={`long-${level.leverage}`}>
              <rect
                x={centerX}
                y={y - barHeight / 2}
                width={barWidth}
                height={barHeight}
                fill="rgba(239,68,68,0.5)"
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
                ${level.price >= 1000 ? level.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : level.price.toFixed(2)}
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
          ${currentPrice >= 1000
            ? currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })
            : currentPrice.toFixed(2)}
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
  const [data, setData] = useState<LiquidationMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async (sym: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/liquidation-map?symbol=${sym}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json: LiquidationMapData = await res.json();
      if (json.currentPrice === 0 || json.levels.length === 0) {
        throw new Error('No liquidation data available');
      }
      setData(json);
      setLastUpdate(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(msg);
      console.error('Liquidation map fetch error:', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(symbol);
    const interval = setInterval(() => fetchData(symbol), 60000);
    return () => clearInterval(interval);
  }, [symbol, fetchData]);

  // Derived data
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

  const totalEstVolume = data ? data.totalLongLiq + data.totalShortLiq : 0;

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
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="heading-page">Liquidation Map</h1>
            <p className="text-neutral-600 text-xs mt-0.5">
              Estimated liquidation clusters based on common leverage tiers and open interest
            </p>
          </div>
          <div className="flex items-center gap-3">
            <UpdatedAgo date={lastUpdate} />
            <button
              onClick={() => fetchData(symbol)}
              disabled={loading}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/[0.04] text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Symbol tabs */}
        <div className="flex items-center gap-2 mb-6">
          <div className="btn-group">
            {SYMBOLS.map((sym) => (
              <button
                key={sym}
                onClick={() => setSymbol(sym)}
                className={`btn-group-item ${symbol === sym ? 'btn-group-item-active' : ''}`}
              >
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

        {/* Long/Short Ratio Bar */}
        {data && data.totalLongLiq + data.totalShortLiq > 0 && (() => {
          const total = data.totalLongLiq + data.totalShortLiq;
          const longPct = (data.totalLongLiq / total) * 100;
          return (
            <div className="mb-6 bg-white/[0.03] border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-red-400 font-mono">{longPct.toFixed(1)}% Long Liq</span>
                <span className="text-[10px] text-neutral-600">Estimated Long / Short Liq Split</span>
                <span className="text-xs text-green-400 font-mono">{(100 - longPct).toFixed(1)}% Short Liq</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]">
                <div className="bg-red-500 transition-all duration-500" style={{ width: `${longPct}%` }} />
                <div className="bg-green-500 transition-all duration-500" style={{ width: `${100 - longPct}%` }} />
              </div>
            </div>
          );
        })()}

        {/* Chart */}
        <div className="mb-6">
          <LiquidationChart data={data} loading={loading && !data} />
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
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
                common leverage tiers (2x through 100x). Liquidation prices are calculated using the
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
      <Footer />
    </div>
  );
}
