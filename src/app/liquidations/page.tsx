'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Header from '@/components/Header';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { Zap, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Volume2, VolumeX, Grid3X3, List, Clock, BarChart3 } from 'lucide-react';
import { useMultiExchangeLiquidations, type Liquidation } from '@/hooks/useMultiExchangeLiquidations';
import Footer from '@/components/Footer';
import { formatLiqValue } from '@/lib/utils/format';
import { DEX_EXCHANGES } from '@/lib/constants/exchanges';
import { LIQ_THRESHOLD, TIMEFRAME_MS, TIMELINE_BUCKET_MS, DISPLAY, EXCHANGE_BRAND_HEX } from '@/lib/constants/thresholds';

type ViewMode = 'feed' | 'heatmap' | 'timebucket' | 'pricelevel';

const AVAILABLE_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Deribit', 'MEXC', 'BingX', 'HTX', 'gTrade'] as const;

// Smart threshold symbol tiers
const MAJOR_SYMBOLS = new Set(['BTC', 'ETH']);
const MIDCAP_SYMBOLS = new Set(['SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK', 'DOT', 'LTC', 'UNI', 'APT', 'ARB', 'OP']);

function passesSmartThreshold(liq: Liquidation): boolean {
  const isDex = DEX_EXCHANGES.has(liq.exchange);
  if (isDex) return liq.value >= LIQ_THRESHOLD.DEX_MIN;
  if (MAJOR_SYMBOLS.has(liq.symbol)) return liq.value >= LIQ_THRESHOLD.MAJOR_CEX;
  if (MIDCAP_SYMBOLS.has(liq.symbol)) return liq.value >= LIQ_THRESHOLD.MIDCAP_CEX;
  return liq.value >= LIQ_THRESHOLD.ALT_CEX;
}

export default function LiquidationsPage() {
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([...AVAILABLE_EXCHANGES]);
  const [filter, setFilter] = useState<'all' | 'long' | 'short'>('all');
  const [minValue, setMinValue] = useState(10000);
  const [thresholdMode, setThresholdMode] = useState<'smart' | 'custom'>('smart');
  const [exchangeFilter, setExchangeFilter] = useState<'all' | 'cex' | 'dex'>('all');
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

  const timeframeMs = TIMEFRAME_MS[timeframe];

  // Use a low minValue for the hook so we capture everything; smart filtering happens in filteredLiquidations
  const hookMinValue = thresholdMode === 'smart' ? 1000 : minValue;

  const { liquidations, connections, stats, aggregated, clearAll } = useMultiExchangeLiquidations({
    exchanges: stableExchanges,
    minValue: hookMinValue,
    maxItems: DISPLAY.MAX_LIQUIDATIONS,
    persistKey: `ih-liq-${timeframe}`,
    persistTtlMs: timeframeMs,
    onLiquidation: (liq) => {
      if (soundEnabled && liq.value >= LIQ_THRESHOLD.SOUND_ALERT && audioRef.current) {
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
    const timeframeMs = TIMEFRAME_MS[timeframe];
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

  // Filter exchanges visible in toggles based on CEX/DEX filter
  const visibleExchanges = AVAILABLE_EXCHANGES.filter(ex => {
    if (exchangeFilter === 'cex') return !DEX_EXCHANGES.has(ex);
    if (exchangeFilter === 'dex') return DEX_EXCHANGES.has(ex);
    return true;
  });

  const filteredLiquidations = liquidations.filter(liq => {
    // Exchange type filter
    if (exchangeFilter === 'cex' && DEX_EXCHANGES.has(liq.exchange)) return false;
    if (exchangeFilter === 'dex' && !DEX_EXCHANGES.has(liq.exchange)) return false;
    // Side filter
    if (filter === 'long' && liq.side !== 'long') return false;
    if (filter === 'short' && liq.side !== 'short') return false;
    // Threshold filter
    if (thresholdMode === 'smart') return passesSmartThreshold(liq);
    return liq.value >= minValue;
  });

  const sortedAggregated = Array.from(aggregated.values())
    .map(item => {
      // Apply long/short filter to heatmap
      if (filter === 'long') return { ...item, totalValue: item.longValue, shortValue: 0 };
      if (filter === 'short') return { ...item, totalValue: item.shortValue, longValue: 0 };
      return item;
    })
    .filter(item => item.totalValue > 0)
    .sort((a, b) => b.totalValue - a.totalValue).slice(0, DISPLAY.HEATMAP_MAX_SYMBOLS);
  const maxValue = Math.max(...sortedAggregated.map(l => l.totalValue), 1);

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

  const getValueColor = (value: number) => {
    if (value >= LIQ_THRESHOLD.HIGHLIGHT_PURPLE) return 'text-purple-400';
    if (value >= LIQ_THRESHOLD.HIGHLIGHT_RED) return 'text-error';
    if (value >= LIQ_THRESHOLD.HIGHLIGHT_ORANGE) return 'text-orange-400';
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
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="heading-page">Liquidations</h1>
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
                  <span className={`conn-dot ${conn.connected ? 'conn-dot-ok animate-pulse' : 'conn-dot-err'}`} />
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

        {/* CEX/DEX Filter + Exchange Toggles */}
        <div className="mb-6">
          {/* CEX / DEX tab filter */}
          <div className="flex items-center gap-2 mb-3">
            {(['all', 'cex', 'dex'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setExchangeFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors border ${
                  exchangeFilter === mode
                    ? mode === 'dex'
                      ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                      : 'bg-hub-yellow/20 border-hub-yellow/30 text-hub-yellow'
                    : 'bg-transparent border-white/[0.04] text-neutral-600 hover:text-neutral-400'
                }`}
              >
                {mode === 'all' ? 'All' : mode.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Exchange toggle buttons */}
          <div className="flex flex-wrap gap-2">
            {visibleExchanges.map(exchange => {
              const isSelected = selectedExchanges.includes(exchange);
              const conn = connections.find(c => c.exchange === exchange);
              const isDex = DEX_EXCHANGES.has(exchange);
              return (
                <button
                  key={exchange}
                  onClick={() => toggleExchange(exchange)}
                  className={`exchange-chip ${isSelected ? 'exchange-chip-active' : 'exchange-chip-inactive'}`}
                >
                  <ExchangeLogo exchange={exchange.toLowerCase()} size={16} />
                  {exchange}
                  <span className={`text-[9px] font-bold uppercase ${isDex ? 'text-purple-400' : 'text-neutral-600'}`}>
                    {isDex ? 'DEX' : 'CEX'}
                  </span>
                  {isSelected && conn && (
                    <span className={`conn-dot ${conn.connected ? 'conn-dot-ok' : 'conn-dot-err'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Top Liquidations Ticker */}
        {liquidations.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-xl bg-hub-darker border border-white/[0.06]">
            <div className="flex animate-scroll-x">
              {[...liquidations].sort((a, b) => b.value - a.value).slice(0, DISPLAY.TICKER_MAX_ITEMS).map((liq, i) => (
                <div key={liq.id} className="flex items-center gap-2 px-4 py-2 whitespace-nowrap flex-shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${liq.side === 'long' ? 'bg-red-500' : 'bg-green-500'}`} />
                  <span className="text-white text-xs font-medium">{liq.symbol}</span>
                  <span className={`text-xs font-mono ${liq.side === 'long' ? 'text-red-400' : 'text-green-400'}`}>{formatLiqValue(liq.value)}</span>
                  <span className="text-neutral-600 text-[10px]">{liq.exchange}</span>
                  {i < DISPLAY.TICKER_MAX_ITEMS - 1 && <span className="text-neutral-700 mx-1">|</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="stat-grid-card">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-hub-yellow" />
              <span className="text-neutral-500 text-xs">{timeframe} Total</span>
            </div>
            <div className="text-lg font-bold font-mono text-white">{formatLiqValue(stats.longValue + stats.shortValue)}</div>
            <div className="text-xs text-neutral-600 font-mono">{stats.totalLongs + stats.totalShorts} liquidations</div>
          </div>
          <div className="stat-grid-card border-red-500/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-neutral-500 text-xs">Longs Rekt</span>
            </div>
            <div className="text-lg font-bold font-mono text-red-400">{formatLiqValue(stats.longValue)}</div>
            <div className="text-xs text-red-400/50 font-mono">{stats.totalLongs} positions</div>
          </div>
          <div className="stat-grid-card border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-neutral-500 text-xs">Shorts Rekt</span>
            </div>
            <div className="text-lg font-bold font-mono text-green-400">{formatLiqValue(stats.shortValue)}</div>
            <div className="text-xs text-green-400/50 font-mono">{stats.totalShorts} positions</div>
          </div>
          <div className="stat-grid-card border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-neutral-500 text-xs">Largest</span>
            </div>
            {stats.largestLiq ? (
              <>
                <div className="text-lg font-bold font-mono text-purple-400">{formatLiqValue(stats.largestLiq.value)}</div>
                <div className="text-xs text-purple-400/50">{stats.largestLiq.symbol} <span className="text-neutral-600">{stats.largestLiq.exchange}</span></div>
              </>
            ) : (
              <div className="text-lg font-bold font-mono text-neutral-700">-</div>
            )}
          </div>
        </div>

        {/* Long/Short Ratio Bar */}
        {(stats.longValue + stats.shortValue > 0) && (() => {
          const total = stats.longValue + stats.shortValue;
          const longPct = (stats.longValue / total) * 100;
          return (
            <div className="mb-6 bg-hub-darker border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-red-400 font-mono">{longPct.toFixed(1)}% Longs</span>
                <span className="text-[10px] text-neutral-600">Long / Short Ratio</span>
                <span className="text-xs text-green-400 font-mono">{(100 - longPct).toFixed(1)}% Shorts</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]">
                <div className="bg-red-500 transition-all duration-500" style={{ width: `${longPct}%` }} />
                <div className="bg-green-500 transition-all duration-500" style={{ width: `${100 - longPct}%` }} />
              </div>
            </div>
          );
        })()}

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="btn-group">
            <button onClick={() => setViewMode('feed')} className={`btn-group-item flex items-center gap-2 ${viewMode === 'feed' ? 'btn-group-item-active' : ''}`}>
              <List className="w-4 h-4" /> Live Feed
            </button>
            <button onClick={() => setViewMode('heatmap')} className={`btn-group-item flex items-center gap-2 ${viewMode === 'heatmap' ? 'btn-group-item-active' : ''}`}>
              <Grid3X3 className="w-4 h-4" /> Heatmap
            </button>
            <button onClick={() => setViewMode('timebucket')} className={`btn-group-item flex items-center gap-2 ${viewMode === 'timebucket' ? 'btn-group-item-active' : ''}`}>
              <Clock className="w-4 h-4" /> Timeline
            </button>
            <button onClick={() => setViewMode('pricelevel')} className={`btn-group-item flex items-center gap-2 ${viewMode === 'pricelevel' ? 'btn-group-item-active' : ''}`}>
              <BarChart3 className="w-4 h-4" /> By Price
            </button>
          </div>

          <div className="btn-group">
            {(['1h', '4h', '12h', '24h'] as const).map((tf) => (
              <button key={tf} onClick={() => setTimeframe(tf)} className={`btn-group-item ${timeframe === tf ? 'btn-group-item-active' : ''}`}>
                {tf}
              </button>
            ))}
          </div>

          <div className="btn-group">
            <button onClick={() => setFilter('all')} className={`btn-group-item ${filter === 'all' ? 'btn-group-item-active' : ''}`}>All</button>
            <button onClick={() => setFilter('long')} className={`btn-group-item ${filter === 'long' ? 'bg-success text-black' : ''}`}>Longs</button>
            <button onClick={() => setFilter('short')} className={`btn-group-item ${filter === 'short' ? 'bg-danger text-white' : ''}`}>Shorts</button>
          </div>

          {/* Threshold mode toggle + custom dropdown */}
          <div className="flex items-center gap-2">
            <div className="btn-group">
              <button
                onClick={() => setThresholdMode('smart')}
                className={`btn-group-item ${thresholdMode === 'smart' ? 'bg-purple-500/30 text-purple-300' : ''}`}
                title="Smart thresholds: $500K+ majors, $100K+ midcaps, $50K+ alts (CEX) / $10K+ (DEX)"
              >
                Smart
              </button>
              <button
                onClick={() => setThresholdMode('custom')}
                className={`btn-group-item ${thresholdMode === 'custom' ? 'btn-group-item-active' : ''}`}
              >
                Custom
              </button>
            </div>
            {thresholdMode === 'custom' && (
              <select value={minValue} onChange={(e) => setMinValue(Number(e.target.value))} className="px-3 py-2 bg-hub-gray/20 border border-white/[0.06] rounded-xl text-white text-sm focus:outline-none focus:border-hub-yellow/50">
                <option value={10000}>$10K+</option>
                <option value={50000}>$50K+</option>
                <option value={100000}>$100K+</option>
                <option value={500000}>$500K+</option>
                <option value={1000000}>$1M+</option>
              </select>
            )}
            {thresholdMode === 'smart' && (
              <span className="text-[10px] text-neutral-600 max-w-[180px] leading-tight">
                CEX: $500K majors, $100K mid, $50K alts. DEX: $10K+ all.
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-8">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
              <span className="text-white">Connecting to liquidation streams...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Heatmap View */}
            {viewMode === 'heatmap' && (
              <div className="section-card mb-6">
                <div className="section-card-header">
                  <div>
                    <h3 className="text-white font-semibold">Liquidation Heatmap</h3>
                    <p className="text-neutral-600 text-sm">Aggregated liquidations by symbol ({timeframe})</p>
                  </div>
                </div>
                {sortedAggregated.length === 0 ? (
                  <div className="empty-state">
                    <RefreshCw className="w-8 h-8 animate-spin mb-3 opacity-50" />
                    <p className="text-sm">Collecting liquidation data...</p>
                  </div>
                ) : (
                  <div className="p-3">
                    {/* Top 3 — large feature tiles */}
                    {sortedAggregated.length > 0 && (
                      <div className={`grid gap-2 mb-2 ${sortedAggregated.length >= 3 ? 'grid-cols-3' : sortedAggregated.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {sortedAggregated.slice(0, 3).map((item) => {
                          const isLongDominant = item.longValue > item.shortValue;
                          const longPct = item.totalValue > 0 ? (item.longValue / item.totalValue) * 100 : 50;
                          const bd = exchangeBreakdownRef.current.get(item.symbol) || {};
                          const bdEntries = Object.entries(bd).sort((a, b) => b[1] - a[1]);
                          const bdTotal = bdEntries.reduce((s, [, v]) => s + v, 0) || 1;
                          return (
                            <div key={item.symbol} className={`${getHeatmapColor(item)} h-36 rounded-xl p-4 flex flex-col justify-between transition-all hover:brightness-110 cursor-pointer relative overflow-hidden`}>
                              <div className="absolute inset-0 opacity-10 bg-gradient-to-b from-white/20 to-transparent" />
                              <div className="relative">
                                <div className="flex items-center gap-2">
                                  <TokenIconSimple symbol={item.symbol} size={24} />
                                  <span className="font-bold text-base">{item.symbol}</span>
                                </div>
                                <div className="opacity-70 text-xs mt-0.5">{item.count} liquidations</div>
                              </div>
                              <div className="relative">
                                <div className="font-bold text-xl">{formatLiqValue(item.totalValue)}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex h-1.5 rounded-full overflow-hidden bg-black/30 flex-1">
                                    <div className="bg-red-400 h-full" style={{ width: `${longPct}%` }} />
                                    <div className="bg-green-400 h-full" style={{ width: `${100 - longPct}%` }} />
                                  </div>
                                  <span className="text-[10px] opacity-70">{isLongDominant ? 'L' : 'S'}</span>
                                </div>
                                {bdEntries.length > 1 && (
                                  <div className="flex h-1 rounded-full overflow-hidden bg-black/20 mt-1">
                                    {bdEntries.slice(0, 4).map(([ex, val]) => (
                                      <div
                                        key={ex}
                                        title={`${ex}: ${formatLiqValue(val)}`}
                                        className="h-full opacity-80"
                                        style={{
                                          width: `${(val / bdTotal) * 100}%`,
                                          backgroundColor: EXCHANGE_BRAND_HEX[ex] || '#888',
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
                    {/* Remaining tiles — compact grid */}
                    {sortedAggregated.length > 3 && (
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {sortedAggregated.slice(3).map((item) => {
                          const isLongDominant = item.longValue > item.shortValue;
                          const bd = exchangeBreakdownRef.current.get(item.symbol) || {};
                          const bdEntries = Object.entries(bd).sort((a, b) => b[1] - a[1]);
                          const bdTotal = bdEntries.reduce((s, [, v]) => s + v, 0) || 1;
                          return (
                            <div key={item.symbol} className={`${getHeatmapColor(item)} h-24 rounded-lg p-3 flex flex-col justify-between transition-all hover:brightness-110 cursor-pointer`}>
                              <div className="flex items-center gap-1.5">
                                <TokenIconSimple symbol={item.symbol} size={16} />
                                <span className="font-bold text-xs">{item.symbol}</span>
                                <span className="opacity-60 text-[10px] ml-auto">{item.count}</span>
                              </div>
                              <div>
                                <div className="font-semibold text-sm">{formatLiqValue(item.totalValue)}</div>
                                {bdEntries.length > 1 && (
                                  <div className="flex h-1 rounded-full overflow-hidden bg-black/20 mt-1">
                                    {bdEntries.slice(0, 4).map(([ex, val]) => (
                                      <div
                                        key={ex}
                                        title={`${ex}: ${formatLiqValue(val)}`}
                                        className="h-full opacity-80"
                                        style={{
                                          width: `${(val / bdTotal) * 100}%`,
                                          backgroundColor: EXCHANGE_BRAND_HEX[ex] || '#888',
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
                  </div>
                )}
                <div className="legend border-t border-white/[0.06]">
                  <div className="legend-item"><div className="legend-swatch bg-red-500" /><span>Long Liquidations</span></div>
                  <div className="legend-item"><div className="legend-swatch bg-green-500" /><span>Short Liquidations</span></div>
                </div>
              </div>
            )}

            {/* Timeline (Time Bucket) View */}
            {viewMode === 'timebucket' && (() => {
              // Bucket liquidations into 5-min intervals
              const bucketMs = TIMELINE_BUCKET_MS;
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
                <div className="section-card mb-6">
                  <div className="section-card-header">
                    <div>
                      <h3 className="text-white font-semibold">Liquidation Timeline</h3>
                      <p className="text-neutral-600 text-sm">5-minute buckets showing liquidation intensity</p>
                    </div>
                  </div>
                  {bucketArr.length === 0 ? (
                    <div className="empty-state">
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
                  <div className="legend border-t border-white/[0.06]">
                    <div className="legend-item"><div className="legend-swatch bg-red-500" /><span>Long Liquidations</span></div>
                    <div className="legend-item"><div className="legend-swatch bg-green-500" /><span>Short Liquidations</span></div>
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
              const top = symbolTotals.slice(0, DISPLAY.PRICE_LEVEL_MAX_SYMBOLS);

              return (
                <div className="section-card mb-6">
                  <div className="section-card-header">
                    <div>
                      <h3 className="text-white font-semibold">Liquidations by Price Level</h3>
                      <p className="text-neutral-600 text-sm">Clustered liquidation levels for top symbols</p>
                    </div>
                  </div>
                  {top.length === 0 ? (
                    <div className="empty-state">
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
                        const binCount = Math.min(DISPLAY.PRICE_LEVEL_MAX_BINS, entries.length);
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
                  <div className="legend border-t border-white/[0.06]">
                    <div className="legend-item"><div className="legend-swatch bg-red-500" /><span>Long Liquidations</span></div>
                    <div className="legend-item"><div className="legend-swatch bg-green-500" /><span>Short Liquidations</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Live Feed View */}
            {viewMode === 'feed' && (
              <div className="section-card">
                <div className="section-card-header">
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
                        <div key={liq.id} className={`liq-row ${liq.value >= LIQ_THRESHOLD.HIGHLIGHT_ORANGE ? 'animate-pulse-once' : ''}`}>
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
                                  {/* DEX arbitrage opportunity badge */}
                                  {DEX_EXCHANGES.has(liq.exchange) && liq.value >= LIQ_THRESHOLD.ARB_BADGE && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400">
                                      ARB opportunity
                                    </span>
                                  )}
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
        <div className="mt-6 callout callout-warn">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-hub-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-hub-yellow text-sm font-medium">Understanding Liquidations</p>
              <p className="text-neutral-600 text-sm mt-1">
                <strong className="text-success">Long liquidation</strong> = Price dropped, long positions forcefully closed.
                <br />
                <strong className="text-danger">Short liquidation</strong> = Price rose, short positions forcefully closed.
              </p>
              <div className="mt-3 space-y-1.5">
                <p className="text-neutral-500 text-xs">
                  <strong className="text-white">CEX liquidations</strong> (Binance, Bybit, OKX, Bitget, Deribit, MEXC, BingX, HTX) — Smart thresholds: $500K+ for BTC/ETH, $100K+ for midcaps, $50K+ for alts. Shows major position unwinds on centralized exchanges.
                </p>
                <p className="text-neutral-500 text-xs">
                  <strong className="text-purple-400">DEX liquidations</strong> (gTrade) — $10K+ threshold. Actionable signals: price gaps from skew imbalance on decentralized protocols create arbitrage opportunities between CEX and DEX venues.
                </p>
                <p className="text-neutral-700 text-xs mt-1">
                  Connected: {selectedExchanges.join(', ')}. Bybit subscribes to top 25 symbols. OKX and Bitget receive all SWAP liquidations. Deribit covers BTC + ETH perpetuals. BingX covers top 5 symbols. HTX covers top 20 symbols. gTrade streams all trade closures.
                </p>
              </div>
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
