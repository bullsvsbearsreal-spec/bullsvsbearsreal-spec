'use client';

import { useState, useEffect, useRef } from 'react';
import { Zap, RefreshCw } from 'lucide-react';

interface LiquidationData {
  symbol: string;
  value: number;
  side: 'long' | 'short';
}

interface AggregatedLiq {
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
}

function formatValue(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export default function LiquidationHeatmap() {
  const [liquidations, setLiquidations] = useState<Map<string, AggregatedLiq>>(new Map());
  const [connected, setConnected] = useState(false);
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '12h' | '24h'>('1h');
  const [totals, setTotals] = useState({ total: 0, longs: 0, shorts: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Reset data when timeframe changes
  useEffect(() => {
    setLiquidations(new Map());
    setTotals({ total: 0, longs: 0, shorts: 0 });
    startTimeRef.current = Date.now();
  }, [timeframe]);

  const connectWebSocket = () => {
    const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === 'forceOrder') {
          const liq: LiquidationData = {
            symbol: data.o.s.replace('USDT', ''),
            side: data.o.S === 'BUY' ? 'short' : 'long',
            value: parseFloat(data.o.p) * parseFloat(data.o.q),
          };

          // Check if within timeframe
          const timeframeMs = {
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
          }[timeframe];

          if (Date.now() - startTimeRef.current > timeframeMs) {
            // Reset if exceeded timeframe
            startTimeRef.current = Date.now();
            setLiquidations(new Map());
            setTotals({ total: 0, longs: 0, shorts: 0 });
          }

          setLiquidations(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(liq.symbol) || {
              symbol: liq.symbol,
              totalValue: 0,
              longValue: 0,
              shortValue: 0,
            };

            existing.totalValue += liq.value;
            if (liq.side === 'long') {
              existing.longValue += liq.value;
            } else {
              existing.shortValue += liq.value;
            }

            newMap.set(liq.symbol, existing);
            return newMap;
          });

          setTotals(prev => ({
            total: prev.total + liq.value,
            longs: prev.longs + (liq.side === 'long' ? liq.value : 0),
            shorts: prev.shorts + (liq.side === 'short' ? liq.value : 0),
          }));

          // Dispatch event for TopStatsBar
          window.dispatchEvent(new CustomEvent('liquidationUpdate', {
            detail: {
              total: totals.total + liq.value,
              longs: totals.longs + (liq.side === 'long' ? liq.value : 0),
              shorts: totals.shorts + (liq.side === 'short' ? liq.value : 0),
            }
          }));
        }
      } catch (err) {
        console.error('Error parsing liquidation:', err);
      }
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(connectWebSocket, 3000);
    };

    wsRef.current = ws;
  };

  // Convert to sorted array for display
  const sortedLiqs = Array.from(liquidations.values())
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 12);

  // Calculate max value for sizing
  const maxValue = Math.max(...sortedLiqs.map(l => l.totalValue), 1);

  // Get color intensity based on value
  const getColorIntensity = (value: number, isLong: boolean) => {
    const intensity = Math.min((value / maxValue) * 100, 100);
    if (isLong) {
      // Red for longs (price dropped)
      if (intensity > 70) return 'bg-danger';
      if (intensity > 40) return 'bg-danger/80';
      return 'bg-danger/60';
    } else {
      // Green for shorts (price rose)
      if (intensity > 70) return 'bg-success';
      if (intensity > 40) return 'bg-success/80';
      return 'bg-success/60';
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Liquidation Heatmap</h3>
            <p className="text-hub-gray-text text-xs">
              {connected ? 'Live' : 'Connecting...'} • {timeframe} data
            </p>
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex rounded-lg overflow-hidden bg-hub-gray/30">
          {(['1h', '4h', '12h', '24h'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-hub-yellow text-black'
                  : 'text-hub-gray-text hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Total Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-hub-gray/20 rounded-lg p-3 text-center">
          <div className="text-xs text-hub-gray-text mb-1">{timeframe} Rekt</div>
          <div className="text-lg font-bold text-white">{formatValue(totals.total)}</div>
        </div>
        <div className="bg-hub-gray/20 rounded-lg p-3 text-center">
          <div className="text-xs text-hub-gray-text mb-1">Long</div>
          <div className="text-lg font-bold text-danger">{formatValue(totals.longs)}</div>
        </div>
        <div className="bg-hub-gray/20 rounded-lg p-3 text-center">
          <div className="text-xs text-hub-gray-text mb-1">Short</div>
          <div className="text-lg font-bold text-success">{formatValue(totals.shorts)}</div>
        </div>
      </div>

      {/* Treemap Grid */}
      {sortedLiqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-hub-gray-text">
          <RefreshCw className="w-6 h-6 animate-spin mb-3 opacity-50" />
          <p className="text-sm">Collecting liquidation data...</p>
          <p className="text-xs mt-1 opacity-70">Large liquidations will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {sortedLiqs.map((liq, index) => {
            // Determine dominant side
            const isLongDominant = liq.longValue > liq.shortValue;
            const bgColor = getColorIntensity(liq.totalValue, isLongDominant);

            // Size based on value (larger values get more height)
            const sizeClass = index < 3 ? 'h-24' : index < 6 ? 'h-20' : 'h-16';

            return (
              <div
                key={liq.symbol}
                className={`${bgColor} ${sizeClass} rounded-lg p-3 flex flex-col justify-between transition-transform hover:scale-[1.02]`}
              >
                <div className="text-white font-bold text-sm md:text-base">
                  {liq.symbol}
                </div>
                <div className="text-white/80 text-xs md:text-sm font-semibold">
                  {formatValue(liq.totalValue)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-hub-gray-text">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-danger" />
          <span>Long Liquidations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-success" />
          <span>Short Liquidations</span>
        </div>
      </div>
    </div>
  );
}
