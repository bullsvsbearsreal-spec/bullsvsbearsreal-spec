'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Header from '@/components/Header';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { Zap, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Volume2, VolumeX, Grid3X3, List, Clock, BarChart3 } from 'lucide-react';
import { useMultiExchangeLiquidations, type Liquidation } from '@/hooks/useMultiExchangeLiquidations';
import Footer from '@/components/Footer';
import { formatLiqValue } from '@/lib/utils/format';

type ViewMode = 'feed' | 'heatmap' | 'timebucket' | 'pricelevel';

const AVAILABLE_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Deribit', 'MEXC', 'BingX'] as const;

export default function LiquidationsPage() {
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([...AVAILABLE_EXCHANGES]);
  const [filter, setFilter] = useState<'all' | 'long' | 'short'>('all');
  const [minValue, setMinValue] = useState(10000);
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '12h' | '24h'>('1h');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Stabilize exchange array reference
  const exchangeKey = selectedExchanges.join(',');
  const stableExchanges = useMemo(() => selectedExchanges, [exchangeKey]);

  // Track exchange breakdown per symbol
  const exchangeBreakdownRef = useRef<Map<string, Record<string, number>>>(new Map());

  const { liquidations, connections, stats, aggregated, clearAll } = useMultiExchangeLiquidations({
    exchanges: stableExchanges,
    minValue,
    maxItems: 200,
    onLiquidation: (liq) => {
      if (soundEnabled && liq.value >= 100000 && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      // Track exchange breakdown
      const bd = exchangeBreakdownRef.current;
      if (!bd.has(liq.symbol)) bd.set(liq.symbol, {});
      const symBd = bd.get(liq.symbol)!;
      symBd[liq.exchange] = (symBd[liq.exchange] || 0) + liq.value;
    },
  });

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRQAEMSo7NGYWgkA');
  }, []);

  // Reset aggregation on timeframe change
  useEffect(() => {
    clearAll();
    exchangeBreakdownRef.current.clear();
    startTimeRef.current = Date.now();
  }, [timeframe, clearAll]);

  // Periodic timeframe reset
  useEffect(() => {
    const timeframeMs = { '1h': 3600000, '4h': 14400000, '12h': 43200000, '24h': 86400000 }[timeframe];
    const interval = setInterval(() => {
      if (Date.now() - startTimeRef.current > timeframeMs) {
        clearAll();
        startTimeRef.current = Date.now();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [timeframe, clearAll]);

  const toggleExchange = (exchange: string) => {
    setSelectedExchanges(prev => {
      if (prev.includes(exchange)) {
        return prev.length > 1 ? prev.filter(e => e !== exchange) : prev;
      }
      return [...prev, exchange];
    });
  };

  const connectedCount = connections.filter(c => c.connected).length;
  const isLoading = connectedCount === 0 && connections.length > 0;

  const filteredLiquidations = liquidations.filter(liq => {
    if (filter === 'long') return liq.side === 'long';
    if (filter === 'short') return liq.side === 'short';
    return true;
  });

  const sortedAggregated = Array.from(aggregated.values())
    .map(item => {
      // Apply long/short filter to heatmap
      if (filter === 'long') return { ...item, totalValue: item.longValue, shortValue: 0 };
      if (filter === 'short') return { ...item, totalValue: item.shortValue, longValue: 0 };
      return item;
    })
    .filter(item => item.totalValue > 0)
    .sort((a, b) => b.totalValue - a.totalValue).slice(0, 20);
  const maxValue = Math.max(...sortedAggregated.map(l => l.totalValue), 1);

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

  const getValueColor = (value: number) => {
    if (value >= 1000000) return 'text-purple-400';
    if (value >= 500000) return 'text-error';
    if (value >= 100000) return 'text-orange-400';
    return 'text-neutral-600';
  };

  const getSizeClass = (value: number) => {
    if (value >= 1000000) return 'text-lg font-bold';
    if (value >= 100000) return 'font-semibold';
    return '';
  };

  const getHeatmapColor = (item: { longValue: number; shortValue: number; totalValue: number }) => {
    const isLongDominant = item.longValue > item.shortValue;
    const intensity = Math.min((item.totalValue / maxValue) * 100, 100);
    if (isLongDominant) {
      if (intensity > 70) return 'bg-red-500 text-white';
      if (intensity > 40) return 'bg-red-600 text-white';
      return 'bg-red-700/80 text-red-100';
    } else {
      if (intensity > 70) return 'bg-green-500 text-white';
      if (intensity > 40) return 'bg-green-600 text-white';
      return 'bg-green-700/80 text-green-100';
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6 page-enter">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">Liquidations</h1>
            <p className="text-neutral-600 text-xs mt-0.5">
              Real-time liquidation feed across {selectedExchanges.length} exchanges
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection status dots */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
              {connections.map(conn => (
                <div
                  key={conn.exchange}
                  title={`${conn.exchange}: ${conn.connected ? 'Connected' : conn.error || 'Disconnected'}`}
                  className="flex items-center gap-1"
                >
                  <ExchangeLogo exchange={conn.exchange.toLowerCase()} size={14} />
                  <span className={`w-1.5 h-1.5 rounded-full ${conn.connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                </div>
              ))}
              <span className="text-xs text-neutral-500 ml-1">{connectedCount}/{connections.length}</span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? 'Disable sound alerts' : 'Enable sound alerts'}
              className={`p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${soundEnabled ? 'bg-hub-yellow/20 text-hub-yellow' : 'bg-white/[0.04] text-neutral-500'}`}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Exchange Toggles */}
        <div className="flex flex-wrap gap-2 mb-6">
          {AVAILABLE_EXCHANGES.map(exchange => {
            const isSelected = selectedExchanges.includes(exchange);
            const conn = connections.find(c => c.exchange === exchange);
            return (
              <button
                key={exchange}
                onClick={() => toggleExchange(exchange)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  isSelected
                    ? 'bg-white/[0.06] border-white/[0.12] text-white'
                    : 'bg-transparent border-white/[0.04] text-neutral-600 hover:text-neutral-400'
                }`}
              >
                <ExchangeLogo exchange={exchange.toLowerCase()} size={16} />
                {exchange}
                {isSelected && conn && (
                  <span className={`w-1.5 h-1.5 rounded-full ${conn.connected ? 'bg-green-400' : 'bg-red-500'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Top Liquidations Ticker */}
        {liquidations.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-xl bg-[#0d0d0d] border border-white/[0.06]">
            <div className="flex animate-scroll-x">
              {[...liquidations].sort((a, b) => b.value - a.value).slice(0, 15).map((liq, i) => (
                <div key={liq.id} className="flex items-center gap-2 px-4 py-2 whitespace-nowrap flex-shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${liq.side === 'long' ? 'bg-red-500' : 'bg-green-500'}`} />
                  <span className="text-white text-xs font-medium">{liq.symbol}</span>
                  <span className={`text-xs font-mono ${liq.side === 'long' ? 'text-red-400' : 'text-green-400'}`}>{formatLiqValue(liq.value)}</span>
                  <span className="text-neutral-600 text-[10px]">{liq.exchange}</span>
                  {i < 14 && <span className="text-neutral-700 mx-1">|</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
            <span className="text-neutral-600 text-sm">{timeframe} Liquidations</span>
            <div className="text-sm font-bold font-mono text-white mt-1">{stats.totalLongs + stats.totalShorts}</div>
          </div>
          <div className="bg-success/10 border border-success/30 rounded-xl p-5">
            <span className="text-success text-sm">Longs Rekt</span>
            <div className="text-sm font-bold font-mono text-success mt-1">{stats.totalLongs}</div>
            <div className="text-sm text-success/70">{formatLiqValue(stats.longValue)}</div>
          </div>
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-5">
            <span className="text-danger text-sm">Shorts Rekt</span>
            <div className="text-sm font-bold font-mono text-danger mt-1">{stats.totalShorts}</div>
            <div className="text-sm text-danger/70">{formatLiqValue(stats.shortValue)}</div>
          </div>
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
            <span className="text-neutral-600 text-sm">Total Value</span>
            <div className="text-sm font-bold font-mono text-white mt-1">{formatLiqValue(stats.longValue + stats.shortValue)}</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
            <span className="text-purple-400 text-sm">Largest Liquidation</span>
            {stats.largestLiq ? (
              <>
                <div className="text-sm font-bold font-mono text-purple-400 mt-1">{formatLiqValue(stats.largestLiq.value)}</div>
                <div className="text-sm text-purple-400/70">
                  {stats.largestLiq.symbol}
                  <span className="text-purple-400/40 ml-1">({stats.largestLiq.exchange})</span>
                </div>
              </>
            ) : (
              <div className="text-sm font-bold font-mono text-neutral-600 mt-1">-</div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex rounded-xl overflow-hidden bg-hub-gray/20 border border-white/[0.06]">
            <button onClick={() => setViewMode('feed')} className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'feed' ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'}`}>
              <List className="w-4 h-4" /> Live Feed
            </button>
            <button onClick={() => setViewMode('heatmap')} className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'heatmap' ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'}`}>
              <Grid3X3 className="w-4 h-4" /> Heatmap
            </button>
            <button onClick={() => setViewMode('timebucket')} className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'timebucket' ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'}`}>
              <Clock className="w-4 h-4" /> Timeline
            </button>
            <button onClick={() => setViewMode('pricelevel')} className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'pricelevel' ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'}`}>
              <BarChart3 className="w-4 h-4" /> By Price
            </button>
          </div>

          <div className="flex rounded-xl overflow-hidden bg-hub-gray/20 border border-white/[0.06]">
            {(['1h', '4h', '12h', '24h'] as const).map((tf) => (
              <button key={tf} onClick={() => setTimeframe(tf)} className={`px-3 py-2 text-sm font-medium transition-colors ${timeframe === tf ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'}`}>
                {tf}
              </button>
            ))}
          </div>

          <div className="flex rounded-xl overflow-hidden bg-hub-gray/20 border border-white/[0.06]">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-medium transition-colors ${filter === 'all' ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'}`}>All</button>
            <button onClick={() => setFilter('long')} className={`px-4 py-2 text-sm font-medium transition-colors ${filter === 'long' ? 'bg-success text-black' : 'text-neutral-600 hover:text-white'}`}>Longs</button>
            <button onClick={() => setFilter('short')} className={`px-4 py-2 text-sm font-medium transition-colors ${filter === 'short' ? 'bg-danger text-white' : 'text-neutral-600 hover:text-white'}`}>Shorts</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-neutral-600 text-sm">Min:</span>
            <select value={minValue} onChange={(e) => setMinValue(Number(e.target.value))} className="px-3 py-2 bg-hub-gray/20 border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-hub-yellow/50">
              <option value={1000}>$1K+</option>
              <option value={10000}>$10K+</option>
              <option value={50000}>$50K+</option>
              <option value={100000}>$100K+</option>
              <option value={500000}>$500K+</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-8">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
              <span className="text-white">Connecting to liquidation streams...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Heatmap View */}
            {viewMode === 'heatmap' && (
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden mb-6">
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-white font-semibold">Liquidation Heatmap</h3>
                  <p className="text-neutral-600 text-sm">Aggregated liquidations by symbol ({timeframe})</p>
                </div>
                {sortedAggregated.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-neutral-600">
                    <RefreshCw className="w-8 h-8 animate-spin mb-3 opacity-50" />
                    <p className="text-sm">Collecting liquidation data...</p>
                  </div>
                ) : (
                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {sortedAggregated.map((item, index) => {
                      const isLongDominant = item.longValue > item.shortValue;
                      const sizeClass = index < 3 ? 'h-32' : index < 8 ? 'h-28' : 'h-24';
                      // Exchange breakdown for this symbol
                      const bd = exchangeBreakdownRef.current.get(item.symbol) || {};
                      const bdEntries = Object.entries(bd).sort((a, b) => b[1] - a[1]);
                      const bdTotal = bdEntries.reduce((s, [, v]) => s + v, 0) || 1;
                      return (
                        <div key={item.symbol} className={`${getHeatmapColor(item)} ${sizeClass} rounded-xl p-3 flex flex-col justify-between transition-all hover:scale-[1.02] cursor-pointer`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <TokenIconSimple symbol={item.symbol} size={20} />
                              <span className="font-bold text-sm md:text-base">{item.symbol}</span>
                            </div>
                            <div className="opacity-70 text-xs">{item.count} liqs</div>
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{formatLiqValue(item.totalValue)}</div>
                            <div className="opacity-60 text-xs mb-1">{isLongDominant ? 'Longs' : 'Shorts'} dominant</div>
                            {/* Exchange breakdown bar */}
                            {bdEntries.length > 1 && (
                              <div className="flex h-1.5 rounded-full overflow-hidden bg-black/20">
                                {bdEntries.slice(0, 4).map(([ex, val]) => (
                                  <div
                                    key={ex}
                                    title={`${ex}: ${formatLiqValue(val)}`}
                                    className="h-full opacity-80"
                                    style={{
                                      width: `${(val / bdTotal) * 100}%`,
                                      backgroundColor: ex === 'Binance' ? '#F0B90B' : ex === 'Bybit' ? '#F7A600' : ex === 'OKX' ? '#fff' : ex === 'Bitget' ? '#00D2AA' : ex === 'Deribit' ? '#5FC694' : '#888',
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="p-4 border-t border-white/[0.06] flex items-center justify-center gap-6 text-xs text-neutral-600">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500" /><span>Long Liquidations</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-500" /><span>Short Liquidations</span></div>
                </div>
              </div>
            )}

            {/* Timeline (Time Bucket) View */}
            {viewMode === 'timebucket' && (() => {
              // Bucket liquidations into 5-min intervals
              const bucketMs = 5 * 60 * 1000;
              const buckets = new Map<number, { long: number; short: number; count: number }>();
              filteredLiquidations.forEach((liq) => {
                const bucketKey = Math.floor(liq.timestamp / bucketMs) * bucketMs;
                const b = buckets.get(bucketKey) || { long: 0, short: 0, count: 0 };
                if (liq.side === 'long') b.long += liq.value;
                else b.short += liq.value;
                b.count++;
                buckets.set(bucketKey, b);
              });
              const bucketArr: Array<{ time: number; long: number; short: number; count: number }> = [];
              buckets.forEach((v, k) => bucketArr.push({ time: k, ...v }));
              bucketArr.sort((a, b) => a.time - b.time);
              const maxBucket = Math.max(...bucketArr.map((b) => b.long + b.short), 1);

              return (
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden mb-6">
                  <div className="p-4 border-b border-white/[0.06]">
                    <h3 className="text-white font-semibold">Liquidation Timeline</h3>
                    <p className="text-neutral-600 text-sm">5-minute buckets showing liquidation intensity</p>
                  </div>
                  {bucketArr.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-600">
                      <RefreshCw className="w-8 h-8 animate-spin mb-3 opacity-50" />
                      <p className="text-sm">Collecting liquidation data...</p>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-end gap-1 h-[200px]">
                        {bucketArr.map((b) => {
                          const total = b.long + b.short;
                          const longPct = total > 0 ? (b.long / total) * 100 : 50;
                          const height = (total / maxBucket) * 100;
                          return (
                            <div
                              key={b.time}
                              className="flex-1 flex flex-col justify-end min-w-[4px] group relative"
                              title={`${new Date(b.time).toLocaleTimeString()} — ${b.count} liqs — Long: ${formatLiqValue(b.long)} / Short: ${formatLiqValue(b.short)}`}
                            >
                              <div className="w-full rounded-t-sm overflow-hidden" style={{ height: `${height}%` }}>
                                <div className="bg-red-500/80" style={{ height: `${longPct}%` }} />
                                <div className="bg-green-500/80" style={{ height: `${100 - longPct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] text-neutral-600">
                        {bucketArr.length > 0 && <span>{new Date(bucketArr[0].time).toLocaleTimeString()}</span>}
                        {bucketArr.length > 1 && <span>{new Date(bucketArr[bucketArr.length - 1].time).toLocaleTimeString()}</span>}
                      </div>
                    </div>
                  )}
                  <div className="p-4 border-t border-white/[0.06] flex items-center justify-center gap-6 text-xs text-neutral-600">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500" /><span>Long Liquidations</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-500" /><span>Short Liquidations</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Price Level View */}
            {viewMode === 'pricelevel' && (() => {
              // Group liquidations by symbol, then by price level clusters
              const symbolPrices = new Map<string, Array<{ price: number; value: number; side: string }>>();
              filteredLiquidations.forEach((liq) => {
                if (!symbolPrices.has(liq.symbol)) symbolPrices.set(liq.symbol, []);
                symbolPrices.get(liq.symbol)!.push({ price: liq.price, value: liq.value, side: liq.side });
              });

              // Top 10 symbols by total liquidation value
              const symbolTotals: Array<{ symbol: string; total: number; entries: Array<{ price: number; value: number; side: string }> }> = [];
              symbolPrices.forEach((entries, symbol) => {
                const total = entries.reduce((s, e) => s + e.value, 0);
                symbolTotals.push({ symbol, total, entries });
              });
              symbolTotals.sort((a, b) => b.total - a.total);
              const top = symbolTotals.slice(0, 8);

              return (
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden mb-6">
                  <div className="p-4 border-b border-white/[0.06]">
                    <h3 className="text-white font-semibold">Liquidations by Price Level</h3>
                    <p className="text-neutral-600 text-sm">Clustered liquidation levels for top symbols</p>
                  </div>
                  {top.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-600">
                      <RefreshCw className="w-8 h-8 animate-spin mb-3 opacity-50" />
                      <p className="text-sm">Collecting liquidation data...</p>
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {top.map(({ symbol, total, entries }) => {
                        // Cluster into price bins
                        const prices = entries.map((e) => e.price).sort((a, b) => a - b);
                        const minP = prices[0];
                        const maxP = prices[prices.length - 1];
                        const range = maxP - minP || 1;
                        const binCount = Math.min(8, entries.length);
                        const binSize = range / binCount;
                        const bins: Array<{ minPrice: number; maxPrice: number; longVal: number; shortVal: number }> = [];
                        for (let i = 0; i < binCount; i++) {
                          bins.push({
                            minPrice: minP + i * binSize,
                            maxPrice: minP + (i + 1) * binSize,
                            longVal: 0,
                            shortVal: 0,
                          });
                        }
                        entries.forEach((e) => {
                          const idx = Math.min(Math.floor((e.price - minP) / binSize), binCount - 1);
                          if (idx >= 0 && idx < bins.length) {
                            if (e.side === 'long') bins[idx].longVal += e.value;
                            else bins[idx].shortVal += e.value;
                          }
                        });
                        const maxBinVal = Math.max(...bins.map((b) => b.longVal + b.shortVal), 1);

                        return (
                          <div key={symbol} className="border border-white/[0.04] rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-3">
                              <TokenIconSimple symbol={symbol} size={18} />
                              <span className="text-sm font-semibold text-white">{symbol}</span>
                              <span className="text-xs text-neutral-500">{formatLiqValue(total)}</span>
                            </div>
                            <div className="space-y-1">
                              {bins.map((bin, i) => {
                                const binTotal = bin.longVal + bin.shortVal;
                                const width = (binTotal / maxBinVal) * 100;
                                const longPct = binTotal > 0 ? (bin.longVal / binTotal) * 100 : 0;
                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-neutral-500 w-24 text-right">
                                      ${bin.minPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                    <div className="flex-1 h-4 bg-white/[0.04] rounded-sm overflow-hidden flex">
                                      {bin.longVal > 0 && (
                                        <div className="bg-red-500/70 h-full" style={{ width: `${longPct * width / 100}%` }} />
                                      )}
                                      {bin.shortVal > 0 && (
                                        <div className="bg-green-500/70 h-full" style={{ width: `${(100 - longPct) * width / 100}%` }} />
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-neutral-600 w-16">
                                      {binTotal > 0 ? formatLiqValue(binTotal) : ''}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="p-4 border-t border-white/[0.06] flex items-center justify-center gap-6 text-xs text-neutral-600">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500" /><span>Long Liquidations</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-500" /><span>Short Liquidations</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Live Feed View */}
            {viewMode === 'feed' && (
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-white font-semibold">Live Feed</h3>
                  <span className="text-neutral-600 text-sm">{filteredLiquidations.length} liquidations</span>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  {filteredLiquidations.length === 0 ? (
                    <div className="p-8 text-center text-neutral-600">
                      <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Waiting for liquidations...</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-hub-gray/20">
                      {filteredLiquidations.map((liq) => (
                        <div key={liq.id} className={`p-4 hover:bg-white/[0.04] transition-colors ${liq.value >= 100000 ? 'animate-pulse-once' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${liq.side === 'long' ? 'bg-success/20' : 'bg-error/20'}`}>
                                {liq.side === 'long' ? <TrendingDown className="w-5 h-5 text-success" /> : <TrendingUp className="w-5 h-5 text-error" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <TokenIconSimple symbol={liq.symbol} size={24} />
                                  <span className="text-white font-semibold">{liq.symbol}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${liq.side === 'long' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
                                    {liq.side.toUpperCase()}
                                  </span>
                                  <span className="flex items-center gap-1 text-neutral-600 text-xs">
                                    <ExchangeLogo exchange={liq.exchange.toLowerCase()} size={12} />
                                    {liq.exchange}
                                  </span>
                                </div>
                                <div className="text-sm text-neutral-600 mt-0.5">
                                  {liq.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} @ ${liq.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`${getValueColor(liq.value)} ${getSizeClass(liq.value)}`}>{formatLiqValue(liq.value)}</div>
                              <div className="text-xs text-neutral-600 mt-0.5">{formatTime(liq.timestamp)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Info */}
        <div className="mt-6 bg-hub-yellow/10 border border-hub-yellow/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-hub-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-hub-yellow text-sm font-medium">Understanding Liquidations</p>
              <p className="text-neutral-600 text-sm mt-1">
                <strong className="text-success">Long liquidation</strong> = Price dropped, long positions forcefully closed.
                <br />
                <strong className="text-danger">Short liquidation</strong> = Price rose, short positions forcefully closed.
                <br />
                <span className="text-neutral-700 text-xs mt-1 block">
                  Data from {selectedExchanges.join(', ')}. Bybit subscribes to top 25 symbols. OKX and Bitget receive all SWAP liquidations. Deribit covers BTC + ETH perpetuals. BingX covers top 5 symbols.
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <style jsx global>{`
        @keyframes pulse-once {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(255, 223, 0, 0.1); }
        }
        .animate-pulse-once {
          animation: pulse-once 1s ease-out;
        }
        @keyframes scroll-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll-x {
          animation: scroll-x 30s linear infinite;
        }
        .animate-scroll-x:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
