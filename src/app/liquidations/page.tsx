'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { TokenIconSimple } from '@/components/TokenIcon';
import { Zap, RefreshCw, Clock, AlertTriangle, TrendingUp, TrendingDown, Volume2, VolumeX, Grid3X3, List } from 'lucide-react';

interface Liquidation {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  value: number;
  exchange: string;
  timestamp: number;
}

interface AggregatedLiq {
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
  count: number;
}

type ViewMode = 'feed' | 'heatmap';

export default function LiquidationsPage() {
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [aggregated, setAggregated] = useState<Map<string, AggregatedLiq>>(new Map());
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [filter, setFilter] = useState<'all' | 'long' | 'short'>('all');
  const [minValue, setMinValue] = useState(10000);
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '12h' | '24h'>('1h');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Stats
  const [stats, setStats] = useState({
    totalLongs: 0,
    totalShorts: 0,
    longValue: 0,
    shortValue: 0,
    largestLiq: null as Liquidation | null,
  });

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRQAEMSo7NGYWgkA');
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    setAggregated(new Map());
    setStats({ totalLongs: 0, totalShorts: 0, longValue: 0, shortValue: 0, largestLiq: null });
    startTimeRef.current = Date.now();
  }, [timeframe]);

  const connectWebSocket = () => {
    setLoading(true);
    const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');

    ws.onopen = () => {
      setConnected(true);
      setLoading(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === 'forceOrder') {
          const liq: Liquidation = {
            id: `${data.o.s}-${data.o.T}`,
            symbol: data.o.s.replace('USDT', ''),
            side: data.o.S === 'BUY' ? 'short' : 'long',
            price: parseFloat(data.o.p),
            quantity: parseFloat(data.o.q),
            value: parseFloat(data.o.p) * parseFloat(data.o.q),
            exchange: 'Binance',
            timestamp: data.o.T,
          };

          const timeframeMs = { '1h': 3600000, '4h': 14400000, '12h': 43200000, '24h': 86400000 }[timeframe];
          if (Date.now() - startTimeRef.current > timeframeMs) {
            startTimeRef.current = Date.now();
            setAggregated(new Map());
            setStats({ totalLongs: 0, totalShorts: 0, longValue: 0, shortValue: 0, largestLiq: null });
          }

          if (liq.value >= minValue) {
            setLiquidations(prev => [liq, ...prev].slice(0, 100));

            setAggregated(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(liq.symbol) || { symbol: liq.symbol, totalValue: 0, longValue: 0, shortValue: 0, count: 0 };
              existing.totalValue += liq.value;
              existing.count += 1;
              if (liq.side === 'long') existing.longValue += liq.value;
              else existing.shortValue += liq.value;
              newMap.set(liq.symbol, existing);
              return newMap;
            });

            if (soundEnabled && liq.value >= 100000 && audioRef.current) {
              audioRef.current.play().catch(() => {});
            }

            setStats(prev => ({
              totalLongs: prev.totalLongs + (liq.side === 'long' ? 1 : 0),
              totalShorts: prev.totalShorts + (liq.side === 'short' ? 1 : 0),
              longValue: prev.longValue + (liq.side === 'long' ? liq.value : 0),
              shortValue: prev.shortValue + (liq.side === 'short' ? liq.value : 0),
              largestLiq: !prev.largestLiq || liq.value > prev.largestLiq.value ? liq : prev.largestLiq,
            }));
          }
        }
      } catch (err) {
        console.error('Error parsing liquidation:', err);
      }
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connectWebSocket, 3000);
    };
    wsRef.current = ws;
  };

  const filteredLiquidations = liquidations.filter(liq => {
    if (filter === 'long') return liq.side === 'long';
    if (filter === 'short') return liq.side === 'short';
    return true;
  });

  const sortedAggregated = Array.from(aggregated.values()).sort((a, b) => b.totalValue - a.totalValue).slice(0, 20);
  const maxValue = Math.max(...sortedAggregated.map(l => l.totalValue), 1);

  const formatValue = (value: number) => {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

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

  const getHeatmapColor = (item: AggregatedLiq) => {
    const isLongDominant = item.longValue > item.shortValue;
    const intensity = Math.min((item.totalValue / maxValue) * 100, 100);
    if (isLongDominant) {
      if (intensity > 70) return 'bg-red-500';
      if (intensity > 40) return 'bg-red-600';
      return 'bg-red-700';
    } else {
      if (intensity > 70) return 'bg-green-500';
      if (intensity > 40) return 'bg-green-600';
      return 'bg-green-700';
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">Liquidations</h1>
            <p className="text-neutral-600 text-xs mt-0.5">Real-time liquidation feed from Binance Futures</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${connected ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-error'}`} />
              {connected ? 'Live' : 'Disconnected'}
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl transition-colors ${soundEnabled ? 'bg-hub-yellow/20 text-hub-yellow' : 'bg-white/[0.04] text-neutral-600'}`}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
            <span className="text-neutral-600 text-sm">{timeframe} Liquidations</span>
            <div className="text-sm font-bold font-mono text-white mt-1">{stats.totalLongs + stats.totalShorts}</div>
          </div>
          <div className="bg-success/10 border border-success/30 rounded-2xl p-5">
            <span className="text-success text-sm">Longs Rekt</span>
            <div className="text-sm font-bold font-mono text-success mt-1">{stats.totalLongs}</div>
            <div className="text-sm text-success/70">{formatValue(stats.longValue)}</div>
          </div>
          <div className="bg-danger/10 border border-danger/30 rounded-2xl p-5">
            <span className="text-danger text-sm">Shorts Rekt</span>
            <div className="text-sm font-bold font-mono text-danger mt-1">{stats.totalShorts}</div>
            <div className="text-sm text-danger/70">{formatValue(stats.shortValue)}</div>
          </div>
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5">
            <span className="text-neutral-600 text-sm">Total Value</span>
            <div className="text-sm font-bold font-mono text-white mt-1">{formatValue(stats.longValue + stats.shortValue)}</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5">
            <span className="text-purple-400 text-sm">Largest Liquidation</span>
            {stats.largestLiq ? (
              <>
                <div className="text-sm font-bold font-mono text-purple-400 mt-1">{formatValue(stats.largestLiq.value)}</div>
                <div className="text-sm text-purple-400/70">{stats.largestLiq.symbol}</div>
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

        {loading ? (
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-8">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
              <span className="text-white">Connecting to liquidation stream...</span>
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
                      const sizeClass = index < 3 ? 'h-28' : index < 8 ? 'h-24' : 'h-20';
                      return (
                        <div key={item.symbol} className={`${getHeatmapColor(item)} ${sizeClass} rounded-xl p-3 flex flex-col justify-between transition-all hover:scale-[1.02] cursor-pointer`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <TokenIconSimple symbol={item.symbol} size={20} />
                              <span className="text-white font-bold text-sm md:text-base">{item.symbol}</span>
                            </div>
                            <div className="text-white/70 text-xs">{item.count} liqs</div>
                          </div>
                          <div>
                            <div className="text-white font-semibold text-sm">{formatValue(item.totalValue)}</div>
                            <div className="text-white/60 text-xs">{isLongDominant ? 'Longs' : 'Shorts'} dominant</div>
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
                                </div>
                                <div className="text-sm text-neutral-600 mt-0.5">
                                  {liq.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} @ ${liq.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`${getValueColor(liq.value)} ${getSizeClass(liq.value)}`}>{formatValue(liq.value)}</div>
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
              </p>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes pulse-once {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(255, 223, 0, 0.1); }
        }
        .animate-pulse-once {
          animation: pulse-once 1s ease-out;
        }
      `}</style>
    </div>
  );
}
