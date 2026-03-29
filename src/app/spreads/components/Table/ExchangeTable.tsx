'use client';

import { memo, useState, useEffect, useMemo } from 'react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getExchangeReferralUrl } from '@/lib/referralLinks';
import { fp } from '../../lib/spread-math';
import { getFundingSlang, getDeviationSlang, getOISlang } from '../../lib/trader-slang';
import type { SpreadStats, WsPrice, Candle, TickerEntry, FundingEntry, OIEntry } from '../../lib/types';

/** Format large USD values: $1.23B, $456.7M, $12.3K */
function fmtUsd(v: number): string {
  if (!v || !isFinite(v) || v <= 0) return '—';
  // Sanity: max realistic 24h volume for any single exchange+symbol is ~$50B
  if (v > 50_000_000_000_000) return '—'; // > $50T is clearly bad data
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

interface ExchangeTableProps {
  sym: string;
  stats: SpreadStats;
  wsPrices: Record<string, WsPrice>;
  klineData: Record<string, Candle[]> | null;
}

function ExchangeTableInner({ sym, stats, wsPrices, klineData }: ExchangeTableProps) {
  const [tickers, setTickers] = useState<TickerEntry[]>([]);
  const [funding, setFunding] = useState<FundingEntry[]>([]);
  const [oi, setOI] = useState<OIEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.allSettled([
        fetch('/api/tickers').then(r => r.ok ? r.json() : null),
        fetch('/api/funding').then(r => r.ok ? r.json() : null),
        fetch('/api/openinterest').then(r => r.ok ? r.json() : null),
      ]).then(([tRes, fRes, oRes]) => {
        if (cancelled) return;
        const tData = (tRes.status === 'fulfilled' && tRes.value?.data) || [];
        const fData = (fRes.status === 'fulfilled' && fRes.value?.data) || [];
        const oData = (oRes.status === 'fulfilled' && oRes.value?.data) || [];
        setTickers(tData.filter((t: Record<string, unknown>) => t.symbol === sym));
        setFunding(fData.filter((f: Record<string, unknown>) => f.symbol === sym));
        setOI(oData.filter((o: Record<string, unknown>) => o.symbol === sym));
      });
    };
    const delay = setTimeout(load, 1000);
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearTimeout(delay); clearInterval(iv); };
  }, [sym]);

  const rows = useMemo(() => {
    const tickerMap = new Map(tickers.map(t => [t.exchange, t]));
    const fundingMap = new Map(funding.map(f => [f.exchange, f]));
    const oiMap = new Map(oi.map(o => [o.exchange, o]));
    const allExchanges = new Set([...tickers.map(t => t.exchange), ...stats.prices.map(p => p.e)]);

    const changeMap = new Map<string, number>();
    if (klineData) {
      for (const [ex, candles] of Object.entries(klineData)) {
        if (candles.length >= 2) {
          const first = candles[0].c;
          const last = candles[candles.length - 1].c;
          if (first > 0) changeMap.set(ex, ((last - first) / first) * 100);
        }
      }
    }

    const list = Array.from(allExchanges).map(e => ({
      exchange: e,
      price: tickerMap.get(e)?.lastPrice || stats.prices.find(p => p.e === e)?.p || 0,
      change: changeMap.get(e) ?? tickerMap.get(e)?.change24h,
      fundingRate: fundingMap.get(e)?.fundingRate,
      oiValue: oiMap.get(e)?.openInterestValue,
      volume: tickerMap.get(e)?.quoteVolume24h,
    })).filter(r => r.price > 0).sort((a, b) => b.price - a.price);

    return list;
  }, [tickers, funding, oi, stats.prices, klineData]);

  const median = rows.length > 0 ? rows.reduce((s, r) => s + r.price, 0) / rows.length : 0;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden lg:col-span-2">
      <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{sym} Across Exchanges</h3>
          <p className="text-[10px] text-neutral-500 mt-0.5">{rows.length} exchanges · auto-refreshes every 15s</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="exchange-table">
          <thead>
            <tr className="text-[10px] text-neutral-500 uppercase tracking-wider border-b border-white/[0.06]">
              <th className="px-4 py-2.5 text-left font-medium">Exchange</th>
              <th className="px-3 py-2.5 text-right font-medium">Price</th>
              <th className="px-3 py-2.5 text-right font-medium">Bid/Ask</th>
              <th className="px-3 py-2.5 text-right font-medium">vs Median</th>
              <th className="px-3 py-2.5 text-right font-medium">24h</th>
              <th className="px-3 py-2.5 text-right font-medium">Funding (8h)</th>
              <th className="px-3 py-2.5 text-right font-medium">Ann. Rate</th>
              <th className="px-3 py-2.5 text-right font-medium">Open Interest</th>
              <th className="px-3 py-2.5 text-right font-medium">Volume 24h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dev = median > 0 ? ((r.price - median) / median) * 100 : 0;
              const ws = wsPrices[r.exchange];
              const hasBidAsk = ws && ws.bid > 0 && ws.ask > 0 && ws.ask > ws.bid && Math.abs(ws.ask - ws.bid) / ws.bid < 0.01;
              const ref = getExchangeReferralUrl(r.exchange);
              const isHigh = i === 0;
              const isLow = i === rows.length - 1 && rows.length > 1;
              return (
                <tr key={r.exchange}
                  className={`border-b border-white/[0.03] transition-colors hover:bg-white/[0.02] ${
                    isHigh ? 'bg-green-500/[0.02]' : isLow ? 'bg-red-500/[0.02]' : ''
                  }`}>
                  {/* Exchange */}
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <ExchangeLogo exchange={r.exchange} size={18} />
                      {ref ? (
                        <a href={ref} target="_blank" rel="noopener noreferrer" className="font-medium text-white hover:text-hub-yellow transition">{r.exchange}</a>
                      ) : (
                        <span className="font-medium text-white">{r.exchange}</span>
                      )}
                      {isHigh && <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-green-500/10 text-green-400 font-bold tracking-wide">HIGH</span>}
                      {isLow && <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-red-500/10 text-red-400 font-bold tracking-wide">LOW</span>}
                      {isHigh && r.fundingRate !== undefined && r.fundingRate < -0.005 && (
                        <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-purple-500/10 text-purple-400 font-bold" title="High price + negative funding = short arb opportunity">ARB</span>
                      )}
                      {isLow && r.fundingRate !== undefined && r.fundingRate > 0.01 && (
                        <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-purple-500/10 text-purple-400 font-bold" title="Low price + positive funding = long arb opportunity">ARB</span>
                      )}
                    </span>
                  </td>
                  {/* Price */}
                  <td className="px-3 py-2.5 text-right font-mono text-white tabular-nums">${fp(r.price)}</td>
                  {/* Bid/Ask */}
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {hasBidAsk ? (
                      <span className="text-neutral-300" title={`Bid $${fp(ws.bid)} / Ask $${fp(ws.ask)}`}>
                        <span className="text-green-400/70">{fp(ws.bid)}</span>
                        <span className="text-neutral-600 mx-0.5">/</span>
                        <span className="text-red-400/70">{fp(ws.ask)}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-700">—</span>
                    )}
                  </td>
                  {/* vs Median */}
                  <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${dev >= 0 ? 'text-green-400' : 'text-red-400'}`} title={getDeviationSlang(dev)}>
                    {dev >= 0 ? '+' : ''}{dev.toFixed(3)}%
                  </td>
                  {/* 24h Change */}
                  <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${r.change !== undefined ? (r.change >= 0 ? 'text-green-400/80' : 'text-red-400/80') : ''}`}>
                    {r.change !== undefined ? (r.change >= 0 ? '+' : '') + r.change.toFixed(2) + '%' : <span className="text-neutral-700">—</span>}
                  </td>
                  {/* Funding 8h */}
                  <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${r.fundingRate !== undefined ? (r.fundingRate >= 0 ? 'text-green-400' : 'text-red-400') : ''}`}
                    title={r.fundingRate !== undefined ? getFundingSlang(r.fundingRate) : undefined}>
                    {r.fundingRate !== undefined ? (r.fundingRate >= 0 ? '+' : '') + (r.fundingRate * 100).toFixed(4) + '%' : <span className="text-neutral-700">—</span>}
                  </td>
                  {/* Annualized */}
                  <td className={`px-3 py-2.5 text-right font-mono tabular-nums text-[10px] ${r.fundingRate !== undefined ? (r.fundingRate >= 0 ? 'text-green-400/60' : 'text-red-400/60') : ''}`}>
                    {r.fundingRate !== undefined ? (r.fundingRate >= 0 ? '+' : '') + (r.fundingRate * 100 * 3 * 365).toFixed(1) + '%' : <span className="text-neutral-700">—</span>}
                  </td>
                  {/* OI */}
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-300 tabular-nums" title={r.oiValue ? getOISlang(r.oiValue) : undefined}>
                    {fmtUsd(r.oiValue || 0)}
                  </td>
                  {/* Volume */}
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-300 tabular-nums">
                    {fmtUsd(r.volume || 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const ExchangeTable = memo(ExchangeTableInner);
