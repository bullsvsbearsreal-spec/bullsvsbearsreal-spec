'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatLiqValue } from '@/lib/utils/format';

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

          const timeframeMs = {
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
          }[timeframe];

          if (Date.now() - startTimeRef.current > timeframeMs) {
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

  const sortedLiqs = Array.from(liquidations.values())
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 12);

  const maxValue = Math.max(...sortedLiqs.map(l => l.totalValue), 1);

  const getColorIntensity = (value: number, isLong: boolean) => {
    const intensity = Math.min((value / maxValue) * 100, 100);
    if (isLong) {
      if (intensity > 70) return 'bg-red-500';
      if (intensity > 40) return 'bg-red-500/80';
      return 'bg-red-500/60';
    } else {
      if (intensity > 70) return 'bg-green-500';
      if (intensity > 40) return 'bg-green-500/80';
      return 'bg-green-500/60';
    }
  };

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold text-sm">Liquidation Heatmap</h3>
          <p className="text-neutral-600 text-[10px]">
            {connected ? 'Live' : 'Connecting...'} &middot; {timeframe}
          </p>
        </div>

        <div className="flex rounded-md overflow-hidden bg-white/[0.04]">
          {(['1h', '4h', '12h', '24h'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-hub-yellow text-black'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/[0.03] rounded-lg px-2.5 py-2 text-center">
          <div className="text-[10px] text-neutral-600 mb-0.5">Rekt</div>
          <div className="text-sm font-bold text-white font-mono">{formatLiqValue(totals.total)}</div>
        </div>
        <div className="bg-white/[0.03] rounded-lg px-2.5 py-2 text-center">
          <div className="text-[10px] text-neutral-600 mb-0.5">Long</div>
          <div className="text-sm font-bold text-red-400 font-mono">{formatLiqValue(totals.longs)}</div>
        </div>
        <div className="bg-white/[0.03] rounded-lg px-2.5 py-2 text-center">
          <div className="text-[10px] text-neutral-600 mb-0.5">Short</div>
          <div className="text-sm font-bold text-green-400 font-mono">{formatLiqValue(totals.shorts)}</div>
        </div>
      </div>

      {sortedLiqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-neutral-600">
          <RefreshCw className="w-4 h-4 animate-spin mb-2 opacity-50" />
          <p className="text-xs">Collecting liquidation data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
          {sortedLiqs.map((liq, index) => {
            const isLongDominant = liq.longValue > liq.shortValue;
            const bgColor = getColorIntensity(liq.totalValue, isLongDominant);
            const sizeClass = index < 3 ? 'h-20' : index < 6 ? 'h-16' : 'h-14';

            return (
              <div
                key={liq.symbol}
                className={`${bgColor} ${sizeClass} rounded-lg px-2.5 py-2 flex flex-col justify-between`}
              >
                <span className="text-white font-bold text-xs">{liq.symbol}</span>
                <span className="text-white/80 text-[10px] font-mono font-semibold">
                  {formatLiqValue(liq.totalValue)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-neutral-600">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
          <span>Long Liq</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          <span>Short Liq</span>
        </div>
      </div>
    </div>
  );
}
