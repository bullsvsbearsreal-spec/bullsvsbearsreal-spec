'use client';

/**
 * Live trade tape for the /chart terminal.
 *
 * Uses the existing `useRealtimeTrades` hook (Binance Futures
 * aggTrades WS). Each trade row shows side, price, size, age.
 * Big buys/sells get a brighter highlight to draw the eye.
 *
 * V1 = Binance aggregated. The "Aggregated · streaming" badge in the
 * screenshot is forward-looking; multi-venue WS aggregation is in
 * useMultiExchangeWS but mixing aggTrades semantics across venues
 * needs care, so we ship single-venue first and label it honestly.
 */
import { useEffect, useState } from 'react';
import { useRealtimeTrades } from '@/hooks/useRealtimeTrades';

const MAX_DISPLAY = 25;

function formatAge(ms: number): string {
  if (ms < 1_000) return '0s';
  if (ms < 60_000) return `${Math.floor(ms / 1_000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

export function TradeTapePanel({ symbol }: { symbol: string }) {
  const { trades, connected } = useRealtimeTrades(symbol);
  const [now, setNow] = useState(() => Date.now());

  // Tick "now" once per second so the age column updates without
  // re-rendering on every trade. Cheap — 1Hz, no real-time data path.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const recent = trades.slice(0, MAX_DISPLAY);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
            Trade Tape
          </span>
          <span className="text-[10px] text-neutral-500">· Binance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-[10px] uppercase tracking-wider text-emerald-400">
            {connected ? 'streaming' : 'offline'}
          </span>
        </div>
      </div>

      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-1 text-[10px] uppercase tracking-wider text-neutral-600">
        <span>Side</span>
        <span>Price</span>
        <span>Size</span>
        <span>Age</span>
      </div>

      {/* Trades */}
      <div className="flex-1 overflow-y-auto">
        {recent.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[10px] text-neutral-600">
            {connected ? 'waiting for trades…' : 'connecting…'}
          </div>
        )}
        {recent.map((t, i) => {
          const isBig = t.quoteQty > 50_000;
          const sideColor = t.isBuy
            ? (isBig ? 'text-emerald-300' : 'text-emerald-400')
            : (isBig ? 'text-red-300' : 'text-red-400');
          const bgColor = t.isBuy ? 'bg-emerald-500/[0.04]' : 'bg-red-500/[0.04]';
          return (
            <div
              key={`${t.time}-${i}`}
              className={`relative flex items-center justify-between px-3 py-[3px] text-[11px] font-mono ${isBig ? bgColor : ''}`}
            >
              <span className={`text-[10px] font-bold ${sideColor} w-10`}>{t.isBuy ? 'BUY' : 'SELL'}</span>
              <span className={sideColor}>{t.price.toFixed(2)}</span>
              <span className="text-neutral-300">{t.qty.toFixed(3)}</span>
              <span className="text-neutral-500 text-[10px] w-10 text-right">
                {formatAge(now - t.time)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
