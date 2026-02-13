'use client';

import { useState, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface CoinData {
  symbol: string;
  name: string;
  slug: string;
  cmcId: number;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

type CountFilter = 50 | 100 | 200;

function formatPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function formatMarketCap(mc: number): string {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

function getChangeColor(change: number): string {
  if (change >= 10) return 'bg-green-500';
  if (change >= 5) return 'bg-green-500/80';
  if (change >= 2) return 'bg-green-600/70';
  if (change >= 0) return 'bg-green-700/50';
  if (change >= -2) return 'bg-red-700/50';
  if (change >= -5) return 'bg-red-600/70';
  if (change >= -10) return 'bg-red-500/80';
  return 'bg-red-500';
}

function getChangeTextColor(change: number): string {
  if (change >= 0) return 'text-green-400';
  return 'text-red-400';
}

// Squarified treemap algorithm
interface TreemapRect {
  coin: CoinData;
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarify(coins: CoinData[], x: number, y: number, w: number, h: number): TreemapRect[] {
  if (coins.length === 0) return [];
  if (coins.length === 1) {
    return [{ coin: coins[0], x, y, w, h }];
  }

  const total = coins.reduce((sum, c) => sum + c.marketCap, 0);
  if (total === 0) return [];

  // Split along the longer side
  const vertical = w >= h;
  const length = vertical ? w : h;

  // Find best split
  let partialSum = 0;
  let bestRatio = Infinity;
  let splitIdx = 0;

  for (let i = 0; i < coins.length - 1; i++) {
    partialSum += coins[i].marketCap;
    const fraction = partialSum / total;
    const remaining = 1 - fraction;

    // Aspect ratio of the two halves
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

  const leftCoins = coins.slice(0, splitIdx + 1);
  const rightCoins = coins.slice(splitIdx + 1);
  const leftFraction = leftCoins.reduce((s, c) => s + c.marketCap, 0) / total;

  let leftRects: TreemapRect[];
  let rightRects: TreemapRect[];

  if (vertical) {
    const splitX = w * leftFraction;
    leftRects = squarify(leftCoins, x, y, splitX, h);
    rightRects = squarify(rightCoins, x + splitX, y, w - splitX, h);
  } else {
    const splitY = h * leftFraction;
    leftRects = squarify(leftCoins, x, y, w, splitY);
    rightRects = squarify(rightCoins, x, y + splitY, w, h - splitY);
  }

  return [...leftRects, ...rightRects];
}

export default function MarketHeatmapPage() {
  const [count, setCount] = useState<CountFilter>(100);
  const [hoveredCoin, setHoveredCoin] = useState<CoinData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { data, error, isLoading, lastUpdate, refresh, isRefreshing } = useApiData<{ coins: CoinData[] }>({
    fetcher: async () => {
      const res = await fetch('/api/top-movers?mode=heatmap');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60000,
  });

  const coins = useMemo(() => {
    if (!data?.coins) return [];
    return data.coins
      .filter(c => c.marketCap > 0 && c.change24h != null)
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, count);
  }, [data, count]);

  const rects = useMemo(() => {
    if (coins.length === 0) return [];
    return squarify(coins, 0, 0, 100, 60);
  }, [coins]);

  const stats = useMemo(() => {
    if (coins.length === 0) return { gainers: 0, losers: 0, avgChange: 0, totalMcap: 0 };
    const gainers = coins.filter(c => c.change24h > 0).length;
    const losers = coins.filter(c => c.change24h < 0).length;
    const avgChange = coins.reduce((s, c) => s + c.change24h, 0) / coins.length;
    const totalMcap = coins.reduce((s, c) => s + c.marketCap, 0);
    return { gainers, losers, avgChange, totalMcap };
  }, [coins]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold text-white">Market Heatmap</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Top {count} coins by market cap, colored by 24h change
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[11px] text-neutral-600">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-neutral-500 mb-1">Gainers</div>
            <div className="text-lg font-bold text-green-400">{stats.gainers}</div>
          </div>
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-neutral-500 mb-1">Losers</div>
            <div className="text-lg font-bold text-red-400">{stats.losers}</div>
          </div>
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-neutral-500 mb-1">Avg Change</div>
            <div className={`text-lg font-bold ${stats.avgChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
            </div>
          </div>
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-neutral-500 mb-1">Total Market Cap</div>
            <div className="text-lg font-bold text-white">{formatMarketCap(stats.totalMcap)}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {([50, 100, 200] as CountFilter[]).map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  count === n
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
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
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && rects.length === 0 && data && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-neutral-500 text-sm mb-2">No heatmap data available</div>
            <div className="text-neutral-600 text-xs">Market data may be temporarily unavailable</div>
          </div>
        )}

        {/* Heatmap */}
        {!isLoading && rects.length > 0 && (
          <div
            className="relative w-full bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden"
            style={{ paddingBottom: '60%' }}
            onMouseMove={handleMouseMove}
          >
            <div className="absolute inset-0">
              {rects.map((rect, i) => {
                const minDim = Math.min(rect.w, rect.h);
                const showSymbol = minDim > 3;
                const showChange = minDim > 5;
                const showPrice = minDim > 8;
                return (
                  <div
                    key={rect.coin.symbol}
                    className={`absolute ${getChangeColor(rect.coin.change24h)} border border-black/30 cursor-pointer transition-opacity hover:opacity-90 flex flex-col items-center justify-center overflow-hidden`}
                    style={{
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.w}%`,
                      height: `${rect.h}%`,
                    }}
                    onMouseEnter={() => setHoveredCoin(rect.coin)}
                    onMouseLeave={() => setHoveredCoin(null)}
                  >
                    {showSymbol && (
                      <span className="text-white font-bold" style={{ fontSize: `${Math.max(0.5, minDim * 0.15)}vw` }}>
                        {rect.coin.symbol}
                      </span>
                    )}
                    {showChange && (
                      <span className="text-white/80" style={{ fontSize: `${Math.max(0.4, minDim * 0.11)}vw` }}>
                        {rect.coin.change24h >= 0 ? '+' : ''}{rect.coin.change24h.toFixed(1)}%
                      </span>
                    )}
                    {showPrice && (
                      <span className="text-white/60" style={{ fontSize: `${Math.max(0.35, minDim * 0.08)}vw` }}>
                        {formatPrice(rect.coin.price)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tooltip */}
            {hoveredCoin && (
              <div
                className="fixed z-50 pointer-events-none bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-3 shadow-xl"
                style={{
                  left: tooltipPos.x + 12,
                  top: tooltipPos.y + 12,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-bold text-white text-sm">{hoveredCoin.symbol}</span>
                  <span className="text-neutral-500 text-xs">{hoveredCoin.name}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">Price</span>
                    <span className="text-white font-mono">{formatPrice(hoveredCoin.price)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">24h Change</span>
                    <span className={`font-mono ${getChangeTextColor(hoveredCoin.change24h)}`}>
                      {hoveredCoin.change24h >= 0 ? '+' : ''}{hoveredCoin.change24h.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">Market Cap</span>
                    <span className="text-white font-mono">{formatMarketCap(hoveredCoin.marketCap)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">Volume 24h</span>
                    <span className="text-white font-mono">{formatVolume(hoveredCoin.volume24h)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        {!isLoading && rects.length > 0 && (
          <div className="flex items-center justify-center gap-1 mt-3">
            <span className="text-[10px] text-neutral-500 mr-1">-10%+</span>
            <div className="w-5 h-3 rounded-sm bg-red-500" />
            <div className="w-5 h-3 rounded-sm bg-red-500/80" />
            <div className="w-5 h-3 rounded-sm bg-red-600/70" />
            <div className="w-5 h-3 rounded-sm bg-red-700/50" />
            <div className="w-5 h-3 rounded-sm bg-green-700/50" />
            <div className="w-5 h-3 rounded-sm bg-green-600/70" />
            <div className="w-5 h-3 rounded-sm bg-green-500/80" />
            <div className="w-5 h-3 rounded-sm bg-green-500" />
            <span className="text-[10px] text-neutral-500 ml-1">+10%+</span>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
