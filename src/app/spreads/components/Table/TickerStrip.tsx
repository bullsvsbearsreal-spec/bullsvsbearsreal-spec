'use client';

import { memo, useRef, useEffect } from 'react';
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

  // Reset prev prices on symbol change to avoid stale flash directions
  useEffect(() => { prevPricesRef.current = {}; }, [sym]);

  return (
    <div className="rounded-xl bg-[#0c0e14] border border-white/[0.06] px-4 py-2 mb-5 flex items-center gap-5 overflow-x-auto scrollbar-none">
      {[...stats.prices].sort((a, b) => {
        const pa = wsPrices[a.e]?.price || a.p;
        const pb = wsPrices[b.e]?.price || b.p;
        return pb - pa;
      }).map((x, i) => {
        const wsP = wsPrices[x.e];
        const livePrice = wsP?.price || x.p;
        const prev = prevPricesRef.current[x.e] || livePrice;
        const direction = livePrice > prev ? 'up' : livePrice < prev ? 'down' : 'same';
        prevPricesRef.current[x.e] = livePrice;
        const median = stats.prices.reduce((s, p) => s + (wsPrices[p.e]?.price || p.p), 0) / stats.prices.length;
        const dev = ((livePrice - median) / median) * 100;
        const ref = getExchangeReferralUrl(x.e);
        return (
          <div key={x.e} className={`flex items-center gap-2 flex-shrink-0 ${wsP && (Date.now() - wsP.ts) > 30000 ? 'opacity-40' : ''}`}>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${wsP && (Date.now() - wsP.ts) > 30000 ? 'bg-red-500' : ''}`}
              style={wsP && (Date.now() - wsP.ts) > 30000 ? {} : { backgroundColor: getExchangeColor(x.e, exs.indexOf(x.e)) }}
            />
            <ExchangeLogo exchange={x.e} size={14} />
            {ref ? (
              <a href={ref} target="_blank" rel="noopener noreferrer" className="text-[11px] text-neutral-500 hover:text-hub-yellow transition" title={`Trade on ${x.e} (referral)`}>{x.e}</a>
            ) : (
              <span className="text-[11px] text-neutral-500">{x.e}</span>
            )}
            <span className={`font-mono text-[12px] font-medium transition-colors duration-300 ${
              direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-white'
            }`}>
              ${fp(livePrice)}
            </span>
            {wsP && wsP.bid > 0 && wsP.ask > 0 && wsP.ask !== wsP.bid && (
              <span className="text-[8px] font-mono text-neutral-600" title={`Bid: $${fp(wsP.bid)} / Ask: $${fp(wsP.ask)}`}>
                {((wsP.ask - wsP.bid) / wsP.bid * 10000).toFixed(1)}bp
              </span>
            )}
            {wsP && (() => {
              const age = Math.round((Date.now() - wsP.ts) / 1000);
              const stale = age > 15;
              const fresh = age < 5;
              return <span className={`text-[8px] font-mono ${stale ? 'text-red-400' : fresh ? 'text-green-500' : 'text-neutral-600'}`} title={`Last update ${age}s ago${stale ? ' — STALE' : ''}`}>{age}s</span>;
            })()}
            <span className={`font-mono text-[10px] ${dev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {dev >= 0 ? '▲' : '▼'}{Math.abs(dev).toFixed(3)}%
            </span>
            {i < stats.prices.length - 1 && <span className="text-neutral-600 mx-1" aria-hidden="true">│</span>}
          </div>
        );
      })}
      <div className="flex-shrink-0 ml-auto pl-4 border-l border-white/[0.06] flex items-center gap-2">
        <div>
          <span className="text-[10px] text-neutral-600">SPREAD </span>
          <span className="font-mono text-[12px] text-hub-yellow font-bold">
            ${fp(wsSpread?.spread ?? stats.cur)}
          </span>
        </div>
        <span className="text-[10px] font-mono text-neutral-500" title="Spread in basis points">
          {((wsSpread?.pct ?? stats.pct) * 100).toFixed(1)} bps
        </span>
        {wsCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />}
      </div>
    </div>
  );
}

export const TickerStrip = memo(TickerStripInner);
