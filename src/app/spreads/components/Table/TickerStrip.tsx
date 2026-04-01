'use client';

import { memo, useRef, useEffect, useState } from 'react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getExchangeReferralUrl } from '@/lib/referralLinks';
import { fp } from '../../lib/spread-math';
import { getExchangeColor } from '../../lib/exchange-colors';
import { getFreshness, getFreshnessDotColor, getFreshnessOpacity } from '../../lib/freshness';
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

  // Update prev prices after render
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

  // Compute spread values
  const spread = wsSpread?.spread ?? stats.cur;
  const rawBps = (wsSpread?.pct ?? stats.pct) * 100;
  const spreadBps = isFinite(rawBps) ? rawBps : 0;

  return (
    <div className="rounded-lg bg-[#0a0c10] border border-white/[0.06] mb-5 overflow-hidden">
      <div ref={scrollRef} className="flex items-stretch overflow-x-auto scrollbar-none">
        {sorted.map((x, rank) => {
          const wsP = wsPrices[x.e];
          const livePrice = wsP?.price || x.p;
          const prev = prevPricesRef.current[x.e] || livePrice;
          const direction = livePrice > prev ? 'up' : livePrice < prev ? 'down' : 'same';
          const dev = median > 0 ? ((livePrice - median) / median) * 100 : 0;
          const ref = getExchangeReferralUrl(x.e);
          const age = wsP ? now - wsP.ts : Infinity;
          const freshness = getFreshness(age);
          const isHighest = rank === 0;
          const isLowest = rank === sorted.length - 1;
          const baBps = wsP && wsP.bid > 0 && wsP.ask > 0 && wsP.ask > wsP.bid
            ? (wsP.ask - wsP.bid) / wsP.bid * 10000
            : 0;
          const exColor = getExchangeColor(x.e, exs.indexOf(x.e));

          const nameEl = ref ? (
            <a href={ref} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-neutral-300 hover:text-hub-yellow transition font-medium whitespace-nowrap">
              {x.e}
            </a>
          ) : (
            <span className="text-[11px] text-neutral-300 font-medium whitespace-nowrap">{x.e}</span>
          );

          return (
            <div key={x.e} className={`flex items-center gap-2 px-3.5 py-2.5 flex-shrink-0 border-r border-white/[0.04] last:border-r-0 transition-opacity ${getFreshnessOpacity(freshness)}`}>
              {/* Color accent line at top */}
              <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0" />

              {/* Rank badge for highest/lowest */}
              {(isHighest || isLowest) && sorted.length > 2 ? (
                <span className={`text-[8px] font-bold uppercase tracking-wider px-1 py-px rounded ${
                  isHighest ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                }`}>
                  {isHighest ? 'HI' : 'LO'}
                </span>
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: exColor }}
                />
              )}

              {/* Logo */}
              <ExchangeLogo exchange={x.e} size={14} />

              {/* Name */}
              {nameEl}

              {/* Price with flash color */}
              <span className={`font-mono text-[12px] font-bold tabular-nums ml-0.5 transition-colors duration-300 ${
                direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-white'
              }`}>
                ${fp(livePrice)}
              </span>

              {/* Deviation from median */}
              <span className={`font-mono text-[9px] tabular-nums ${
                dev >= 0.01 ? 'text-green-400/70' : dev <= -0.01 ? 'text-red-400/70' : 'text-neutral-600'
              }`}>
                {dev >= 0 ? '+' : ''}{dev.toFixed(3)}%
              </span>

              {/* Bid/Ask spread — only show if meaningful (>= 0.1 bps) */}
              {baBps >= 0.1 && (
                <span className="text-[8px] font-mono text-neutral-500 tabular-nums"
                  title={`Bid: $${fp(wsP!.bid)} / Ask: $${fp(wsP!.ask)}`}>
                  {baBps.toFixed(1)}bp
                </span>
              )}

              {/* WS freshness indicator */}
              {wsP && (
                <span className={`w-1 h-1 rounded-full flex-shrink-0 ${getFreshnessDotColor(freshness)}`}
                  title={`${Math.round(age / 1000)}s ago`} />
              )}
            </div>
          );
        })}

        {/* ── Spread summary — sticky right ── */}
        <div className="flex-shrink-0 ml-auto pl-6 pr-4 py-2.5 flex items-center gap-3 bg-gradient-to-r from-[#0a0c10]/0 via-[#0a0c10] via-30% to-[#0a0c10] sticky right-0">
          <div className="w-px h-5 bg-white/[0.08]" />
          <div className="flex flex-col items-end gap-0">
            <span className="text-[8px] text-neutral-600 uppercase tracking-wider font-semibold leading-none">Spread</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[14px] text-hub-yellow font-bold tabular-nums leading-tight">
                ${fp(spread)}
              </span>
              <span className="text-[10px] font-mono text-neutral-500 tabular-nums">
                {spreadBps.toFixed(1)} bps
              </span>
            </div>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            {wsCount > 0 && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
              </span>
            )}
            {ageSec !== null && (() => {
              const f = getFreshness(ageSec * 1000);
              return (
                <span className={`text-[9px] font-mono tabular-nums ${f === 'fresh' ? 'text-green-400/60' : f === 'warm' ? 'text-neutral-500' : 'text-red-400/60'}`}>
                  {ageSec}s
                </span>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TickerStrip = memo(TickerStripInner);
