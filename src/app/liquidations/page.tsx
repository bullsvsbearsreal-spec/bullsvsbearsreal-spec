'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { Zap, RefreshCw, Clock, AlertTriangle, TrendingUp, TrendingDown, Volume2, VolumeX } from 'lucide-react';

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

export default function LiquidationsPage() {
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [filter, setFilter] = useState<'all' | 'long' | 'short'>('all');
  const [minValue, setMinValue] = useState(10000);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalLongs: 0,
    totalShorts: 0,
    longValue: 0,
    shortValue: 0,
    largestLiq: null as Liquidation | null,
  });

  useEffect(() => {
    // Create audio element for liquidation sounds
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRQAEMSo7NGYWgkA');

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    setLoading(true);

    // Connect to Binance Futures Liquidation Stream
    const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');

    ws.onopen = () => {
      setConnected(true);
      setLoading(false);
      console.log('Connected to Binance liquidation stream');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === 'forceOrder') {
          const liq: Liquidation = {
            id: `${data.o.s}-${data.o.T}`,
            symbol: data.o.s.replace('USDT', ''),
            side: data.o.S === 'BUY' ? 'short' : 'long', // BUY = short liquidation, SELL = long liquidation
            price: parseFloat(data.o.p),
            quantity: parseFloat(data.o.q),
            value: parseFloat(data.o.p) * parseFloat(data.o.q),
            exchange: 'Binance',
            timestamp: data.o.T,
          };

          // Only add if above minimum value
          if (liq.value >= minValue) {
            setLiquidations(prev => [liq, ...prev].slice(0, 100)); // Keep last 100

            // Play sound for large liquidations
            if (soundEnabled && liq.value >= 100000 && audioRef.current) {
              audioRef.current.play().catch(() => {});
            }

            // Update stats
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

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };

    wsRef.current = ws;
  };

  const filteredLiquidations = liquidations.filter(liq => {
    if (filter === 'long') return liq.side === 'long';
    if (filter === 'short') return liq.side === 'short';
    return true;
  });

  const formatValue = (value: number) => {
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getValueColor = (value: number) => {
    if (value >= 1000000) return 'text-purple-400';
    if (value >= 500000) return 'text-error';
    if (value >= 100000) return 'text-orange-400';
    return 'text-hub-gray-text';
  };

  const getSizeClass = (value: number) => {
    if (value >= 1000000) return 'text-lg font-bold';
    if (value >= 100000) return 'font-semibold';
    return '';
  };

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Zap className="w-8 h-8 text-hub-yellow" />
              Liquidations
            </h1>
            <p className="text-hub-gray-text mt-1">
              Real-time liquidation feed from Binance Futures
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              connected ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
            }`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-error'}`} />
              {connected ? 'Live' : 'Disconnected'}
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl transition-colors ${
                soundEnabled ? 'bg-hub-yellow/20 text-hub-yellow' : 'bg-hub-gray/30 text-hub-gray-text'
              }`}
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
            <span className="text-hub-gray-text text-sm">Total Liquidations</span>
            <div className="text-2xl font-bold text-white mt-1">{liquidations.length}</div>
          </div>
          <div className="bg-success/10 border border-success/30 rounded-2xl p-5">
            <span className="text-success text-sm">Longs Liquidated</span>
            <div className="text-2xl font-bold text-success mt-1">{stats.totalLongs}</div>
            <div className="text-sm text-success/70">{formatValue(stats.longValue)}</div>
          </div>
          <div className="bg-error/10 border border-error/30 rounded-2xl p-5">
            <span className="text-error text-sm">Shorts Liquidated</span>
            <div className="text-2xl font-bold text-error mt-1">{stats.totalShorts}</div>
            <div className="text-sm text-error/70">{formatValue(stats.shortValue)}</div>
          </div>
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-5">
            <span className="text-hub-gray-text text-sm">Total Value</span>
            <div className="text-2xl font-bold text-white mt-1">
              {formatValue(stats.longValue + stats.shortValue)}
            </div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5">
            <span className="text-purple-400 text-sm">Largest Liquidation</span>
            {stats.largestLiq ? (
              <>
                <div className="text-2xl font-bold text-purple-400 mt-1">
                  {formatValue(stats.largestLiq.value)}
                </div>
                <div className="text-sm text-purple-400/70">{stats.largestLiq.symbol}</div>
              </>
            ) : (
              <div className="text-2xl font-bold text-hub-gray-text mt-1">-</div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex rounded-xl overflow-hidden bg-hub-gray/20 border border-hub-gray/30">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-hub-yellow text-black' : 'text-hub-gray-text hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('long')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filter === 'long' ? 'bg-success text-black' : 'text-hub-gray-text hover:text-white'
              }`}
            >
              Longs
            </button>
            <button
              onClick={() => setFilter('short')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filter === 'short' ? 'bg-error text-white' : 'text-hub-gray-text hover:text-white'
              }`}
            >
              Shorts
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-hub-gray-text text-sm">Min Value:</span>
            <select
              value={minValue}
              onChange={(e) => setMinValue(Number(e.target.value))}
              className="px-3 py-2 bg-hub-gray/20 border border-hub-gray/30 rounded-xl text-white text-sm focus:outline-none focus:border-hub-yellow/50"
            >
              <option value={1000}>$1K+</option>
              <option value={10000}>$10K+</option>
              <option value={50000}>$50K+</option>
              <option value={100000}>$100K+</option>
              <option value={500000}>$500K+</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-8">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin" />
              <span className="text-white">Connecting to liquidation stream...</span>
            </div>
          </div>
        ) : (
          /* Liquidations Feed */
          <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-hub-gray/30 flex items-center justify-between">
              <h3 className="text-white font-semibold">Live Feed</h3>
              <span className="text-hub-gray-text text-sm">{filteredLiquidations.length} liquidations</span>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {filteredLiquidations.length === 0 ? (
                <div className="p-8 text-center text-hub-gray-text">
                  <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Waiting for liquidations...</p>
                  <p className="text-sm mt-1">Large liquidations will appear here in real-time</p>
                </div>
              ) : (
                <div className="divide-y divide-hub-gray/20">
                  {filteredLiquidations.map((liq) => (
                    <div
                      key={liq.id}
                      className={`p-4 hover:bg-hub-gray/30 transition-colors ${
                        liq.value >= 100000 ? 'animate-pulse-once' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Side indicator */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            liq.side === 'long' ? 'bg-success/20' : 'bg-error/20'
                          }`}>
                            {liq.side === 'long' ? (
                              <TrendingDown className="w-5 h-5 text-success" />
                            ) : (
                              <TrendingUp className="w-5 h-5 text-error" />
                            )}
                          </div>

                          {/* Symbol and details */}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold">{liq.symbol}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                liq.side === 'long' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
                              }`}>
                                {liq.side.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-sm text-hub-gray-text mt-0.5">
                              {liq.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} @ ${liq.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>

                        {/* Value and time */}
                        <div className="text-right">
                          <div className={`${getValueColor(liq.value)} ${getSizeClass(liq.value)}`}>
                            {formatValue(liq.value)}
                          </div>
                          <div className="text-xs text-hub-gray-text mt-0.5">
                            {formatTime(liq.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 bg-hub-yellow/10 border border-hub-yellow/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-hub-yellow flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-hub-yellow text-sm font-medium">Understanding Liquidations</p>
              <p className="text-hub-gray-text text-sm mt-1">
                <strong className="text-success">Long liquidation</strong> = Price dropped, long positions forcefully closed (bullish signal if excessive).
                <br />
                <strong className="text-error">Short liquidation</strong> = Price rose, short positions forcefully closed (bearish signal if excessive).
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
