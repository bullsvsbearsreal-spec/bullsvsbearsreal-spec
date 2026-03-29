'use client';

import { memo, useRef, useEffect, useState } from 'react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getExchangeReferralUrl } from '@/lib/referralLinks';
import { fp } from '../../lib/spread-math';
import { getExchangeColor } from '../../lib/exchange-colors';
import type { SpreadStats, WsPrice, SpreadInfo } from '../../lib/types';

interface TickerStripProps {
  stats: SpreadStats;
  exs: string[];
  wsPrices: Record<string, WsPrice>;
  wsSpread: SpreadInfo | null;
  wsCount: number;
  sym: string;
}

function TickerStripInner({ stats, exs, wsPrices, wsSpread, wsCount, sym }: TickerStripProps) {
  const prevPricesRef = useRef<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());

  // Tick every second to update freshness
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Reset prev prices on symbol change
  useEffect(() => { prevPricesRef.current = {}; }, [sym]);

  // Update prev prices after render (not during) to preserve StrictMode flash
  useEffect(() => {
    stats.prices.forEach(x => {
      const wsP = wsPrices[x.e];
      prevPricesRef.current[x.e] = wsP?.price || x.p;
    });
  });

  // Find the most recent update time
  const latestTs = Object.values(wsPrices).reduce((max, p) => Math.max(max, p.ts || 0), 0);
  const ageSec = latestTs > 0 ? Math.round((now - latestTs) / 1000) : null;

  const sorted = [...stats.prices].sort((a, b) => {
    const pa = wsPrices[a.e]?.price || a.p;
    const pb = wsPrices[b.e]?.price || b.p;
    return pb - pa;
  });

  const median = stats.prices.length > 0
    ? stats.prices.reduce((s, p) => s + (wsPrices[p.e]?.price || p.p), 0) / stats.prices.length
    : 0;

  return (
    <div className="rounded-xl bg-[#0a0c10] border border-white/[0.06] mb-5 overflow-hidden">
      {/* Main scrollable ticker */}
      <div ref={scrollRef} className="flex items-stretch overflow-x-auto scrollbar-none">
        {sorted.map((x, i) => {
          const wsP = wsPrices[x.e];
          const livePrice = wsP?.price || x.p;
          const prev = prevPricesRef.current[x.e] || livePrice;
          const direction = livePrice > prev ? 'up' : livePrice < prev ? 'down' : 'same';
          const dev = ((livePrice - median) / median) * 100;
          const ref = getExchangeReferralUrl(x.e);
          const isStale = wsP ? (now - wsP.ts) > 30000 : false;
          const isFresh = wsP ? (now - wsP.ts) < 5000 : false;

          return (
            <div key={x.e} className={`flex items-center gap-2 px-3.5 py-2.5 flex-shrink-0 border-r border-white/[0.04] last:border-r-0 transition-opacity ${isStale ? 'opacity-35' : 'hover:bg-white/[0.02]'}`}>
              {/* Color dot */}
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isStale ? 'bg-red-500/60' : ''}`}
                style={isStale ? {} : { backgroundColor: getExchangeColor(x.e, exs.indexOf(x.e)) }}
              />
              {/* Logo + Name */}
              <ExchangeLogo exchange={x.e} size={14} />
              {ref ? (
                <a href={ref} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-neutral-400 hover:text-hub-yellow transition font-medium whitespace-nowrap"
                  title={`Trade on ${x.e} (referral)`}>{x.e}</a>
              ) : (
                <span className="text-[11px] text-neutral-400 font-medium whitespace-nowrap">{x.e}</span>
              )}
              {/* Price */}
              <span className={`font-mono text-[12px] font-semibold tabular-nums transition-colors duration-300 ${
                direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-white'
              }`}>
                ${fp(livePrice)}
              </span>
              {/* Deviation */}
              <span className={`font-mono text-[9px] tabular-nums px-1 py-[1px] rounded ${
                dev >= 0.01 ? 'bg-green-500/8 text-green-400/80' : dev <= -0.01 ? 'bg-red-500/8 text-red-400/80' : 'text-neutral-600'
              }`}>
                {dev >= 0 ? '+' : ''}{dev.toFixed(3)}%
              </span>
              {/* Bid/Ask spread in bps */}
              {wsP && wsP.bid > 0 && wsP.ask > 0 && wsP.ask !== wsP.bid && (
                <span className="text-[8px] font-mono text-neutral-600 tabular-nums"
                  title={`Bid: $${fp(wsP.bid)} / Ask: $${fp(wsP.ask)}`}>
                  {((wsP.ask - wsP.bid) / wsP.bid * 10000).toFixed(1)}bp
                </span>
              )}
              {/* Freshness dot */}
              {wsP && (
                <span className={`w-1 h-1 rounded-full flex-shrink-0 ${
                  isFresh ? 'bg-green-400' : isStale ? 'bg-red-400' : 'bg-neutral-600'
                }`} title={`${Math.round((now - wsP.ts) / 1000)}s ago`} />
              )}
            </div>
          );
        })}

        {/* Spread summary - sticky right */}
        <div className="flex-shrink-0 ml-auto pl-3 pr-4 py-2.5 flex items-center gap-3 bg-gradient-to-r from-transparent via-[#0a0c10] to-[#0a0c10] sticky right-0">
          <div className="w-px h-5 bg-white/[0.08]" />
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">Spread</span>
            <span className="font-mono text-[13px] text-hub-yellow font-bold tabular-nums">
              ${fp(wsSpread?.spread ?? stats.cur)}
            </span>
            <span className="text-[9px] font-mono text-neutral-500 tabular-nums">
              {((wsSpread?.pct ?? stats.pct) * 100).toFixed(1)} bps
            </span>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            {wsCount > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
            )}
            {ageSec !== null && (
              <span className={`text-[9px] font-mono tabular-nums ${ageSec <= 3 ? 'text-green-400/60' : ageSec <= 10 ? 'text-neutral-500' : 'text-red-400/60'}`}>
                {ageSec}s
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TickerStrip = memo(TickerStripInner);
