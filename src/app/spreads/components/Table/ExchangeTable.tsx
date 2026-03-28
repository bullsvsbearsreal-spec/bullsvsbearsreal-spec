'use client';

import { memo, useState, useEffect, useMemo } from 'react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getExchangeReferralUrl } from '@/lib/referralLinks';
import { fp } from '../../lib/spread-math';
import { getFundingSlang, getDeviationSlang, getOISlang } from '../../lib/trader-slang';
import type { SpreadStats, WsPrice, Candle, TickerEntry, FundingEntry, OIEntry } from '../../lib/types';

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

  // Fetch live tickers + funding + OI
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
          <h3 className="text-sm font-semibold">{sym} Market Data by Exchange</h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">Live prices, funding, OI, and volume · refreshes every 15s</p>
        </div>
        <span className="text-[10px] text-neutral-600">{tickers.length} exchanges reporting</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-neutral-500 uppercase tracking-wider border-b border-white/[0.06]">
              <th className="px-4 py-2 text-left">Exchange</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Bid/Ask</th>
              <th className="px-3 py-2 text-right">vs Median</th>
              <th className="px-3 py-2 text-right">24h Change</th>
              <th className="px-3 py-2 text-right">Funding (8h)</th>
              <th className="px-3 py-2 text-right">Funding (Ann.)</th>
              <th className="px-3 py-2 text-right">Open Interest</th>
              <th className="px-3 py-2 text-right">Volume 24h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dev = median > 0 ? ((r.price - median) / median) * 100 : 0;
              const ws = wsPrices[r.exchange];
              const ref = getExchangeReferralUrl(r.exchange);
              return (
                <tr key={r.exchange} className={`border-b border-white/[0.03] hover:bg-white/[0.02] ${i === 0 ? 'bg-green-500/[0.02]' : i === rows.length - 1 ? 'bg-red-500/[0.02]' : ''}`}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <ExchangeLogo exchange={r.exchange} size={16} />
                      {ref ? (
                        <a href={ref} target="_blank" rel="noopener noreferrer" className="font-medium text-white hover:text-hub-yellow transition">{r.exchange}</a>
                      ) : (
                        <span className="font-medium text-white">{r.exchange}</span>
                      )}
                      {i === 0 && <span className="text-[7px] px-1 py-[1px] rounded bg-green-500/10 text-green-400 font-bold">HIGH</span>}
                      {i === rows.length - 1 && <span className="text-[7px] px-1 py-[1px] rounded bg-red-500/10 text-red-400 font-bold">LOW</span>}
                      {i === 0 && r.fundingRate !== undefined && r.fundingRate < -0.005 && (
                        <span className="text-[7px] px-1 py-[1px] rounded bg-purple-500/10 text-purple-400 font-bold" title="High price + negative funding = short arb opportunity">ARB ↓</span>
                      )}
                      {i === rows.length - 1 && r.fundingRate !== undefined && r.fundingRate > 0.01 && (
                        <span className="text-[7px] px-1 py-[1px] rounded bg-purple-500/10 text-purple-400 font-bold" title="Low price + positive funding = long arb opportunity">ARB ↑</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-white">${fp(r.price)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-400">
                    {ws && ws.bid > 0 && ws.ask > 0 && ws.ask > ws.bid
                      ? <span title={`Bid: $${fp(ws.bid)} / Ask: $${fp(ws.ask)}`}>{((ws.ask - ws.bid) / ws.bid * 10000).toFixed(1)} bp</span>
                      : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${dev >= 0 ? 'text-green-400' : 'text-red-400'}`} title={getDeviationSlang(dev)}>
                    {dev >= 0 ? '+' : ''}{dev.toFixed(3)}%
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${r.change !== undefined ? (r.change >= 0 ? 'text-green-400' : 'text-red-400') : 'text-neutral-600'}`}>
                    {r.change !== undefined ? (r.change >= 0 ? '+' : '') + r.change.toFixed(2) + '%' : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${r.fundingRate !== undefined ? (r.fundingRate >= 0 ? 'text-green-400' : 'text-red-400') : 'text-neutral-600'}`}
                    title={r.fundingRate !== undefined ? getFundingSlang(r.fundingRate) : undefined}>
                    {r.fundingRate !== undefined ? (r.fundingRate >= 0 ? '+' : '') + (r.fundingRate * 100).toFixed(4) + '%' : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono text-[10px] ${r.fundingRate !== undefined ? (r.fundingRate >= 0 ? 'text-green-400/70' : 'text-red-400/70') : 'text-neutral-600'}`}>
                    {r.fundingRate !== undefined ? (r.fundingRate >= 0 ? '+' : '') + (r.fundingRate * 100 * 3 * 365).toFixed(1) + '%' : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-300" title={r.oiValue ? getOISlang(r.oiValue) : undefined}>
                    {r.oiValue ? '$' + (r.oiValue >= 1e9 ? (r.oiValue / 1e9).toFixed(2) + 'B' : r.oiValue >= 1e6 ? (r.oiValue / 1e6).toFixed(1) + 'M' : (r.oiValue / 1e3).toFixed(0) + 'K') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-300">
                    {r.volume ? '$' + (r.volume >= 1e9 ? (r.volume / 1e9).toFixed(2) + 'B' : r.volume >= 1e6 ? (r.volume / 1e6).toFixed(1) + 'M' : (r.volume / 1e3).toFixed(0) + 'K') : '—'}
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
