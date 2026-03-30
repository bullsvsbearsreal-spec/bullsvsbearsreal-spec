'use client';

import { memo, useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Globe, Layers } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getExchangeReferralUrl } from '@/lib/referralLinks';
import { fp } from '../../lib/spread-math';
import { getFundingSlang, getDeviationSlang, getOISlang } from '../../lib/trader-slang';
import { CEX_EXCHANGES, DEX_EXCHANGES } from '../../lib/symbols';
import type { SpreadStats, WsPrice, Candle, TickerEntry, FundingEntry, OIEntry } from '../../lib/types';

/** Format large USD values: $1.23B, $456.7M, $12.3K */
function fmtUsd(v: number): string {
  if (!v || !isFinite(v) || v <= 0) return '—';
  if (v > 50_000_000_000_000) return '—';
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

type SortKey = 'exchange' | 'price' | 'deviation' | 'change' | 'funding' | 'oi' | 'volume';
type SortDir = 'asc' | 'desc';
type FilterTab = 'all' | 'cex' | 'dex';

interface ExchangeTableProps {
  sym: string;
  stats: SpreadStats;
  wsPrices: Record<string, WsPrice>;
  klineData: Record<string, Candle[]> | null;
}

const cexSet = new Set(CEX_EXCHANGES);
const dexSet = new Set(DEX_EXCHANGES);

function ExchangeTableInner({ sym, stats, wsPrices, klineData }: ExchangeTableProps) {
  const [tickers, setTickers] = useState<TickerEntry[]>([]);
  const [funding, setFunding] = useState<FundingEntry[]>([]);
  const [oi, setOI] = useState<OIEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState<FilterTab>('all');

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
        setLoading(false);
      });
    };
    setLoading(true);
    const delay = setTimeout(load, 800);
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearTimeout(delay); clearInterval(iv); };
  }, [sym]);

  const rows = useMemo(() => {
    const tickerMap = new Map(tickers.map(t => [t.exchange, t]));
    const fundingMap = new Map(funding.map(f => [f.exchange, f]));
    const oiMap = new Map(oi.map(o => [o.exchange, o]));
    // Merge all data sources: tickers + stats.prices + wsPrices
    const allExchanges = new Set([
      ...tickers.map(t => t.exchange),
      ...stats.prices.map(p => p.e),
      ...Object.keys(wsPrices).filter(e => wsPrices[e].price > 0),
    ]);

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

    const list = Array.from(allExchanges).map(e => {
      // Price: prefer WS live price > ticker API > stats
      const wsP = wsPrices[e];
      const price = (wsP?.price && wsP.price > 0 ? wsP.price : 0)
        || tickerMap.get(e)?.lastPrice
        || stats.prices.find(p => p.e === e)?.p
        || 0;

      return {
        exchange: e,
        price,
        change: changeMap.get(e) ?? tickerMap.get(e)?.change24h,
        fundingRate: fundingMap.get(e)?.fundingRate,
        oiValue: oiMap.get(e)?.openInterestValue,
        volume: tickerMap.get(e)?.quoteVolume24h,
        isCex: cexSet.has(e),
        isDex: dexSet.has(e),
        isLive: !!(wsP?.price && wsP.price > 0 && (Date.now() - wsP.ts) < 30000),
      };
    }).filter(r => r.price > 0);

    return list;
  }, [tickers, funding, oi, stats.prices, klineData, wsPrices]);

  // Apply filter
  const filtered = useMemo(() => {
    if (filter === 'cex') return rows.filter(r => r.isCex);
    if (filter === 'dex') return rows.filter(r => r.isDex);
    return rows;
  }, [rows, filter]);

  // Apply sort
  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'exchange': return dir * a.exchange.localeCompare(b.exchange);
        case 'price': return dir * (a.price - b.price);
        case 'deviation': {
          const med = rows.length > 0 ? rows.reduce((s, r) => s + r.price, 0) / rows.length : 0;
          const da = med > 0 ? (a.price - med) / med : 0;
          const db = med > 0 ? (b.price - med) / med : 0;
          return dir * (da - db);
        }
        case 'change': return dir * ((a.change ?? -Infinity) - (b.change ?? -Infinity));
        case 'funding': return dir * ((a.fundingRate ?? -Infinity) - (b.fundingRate ?? -Infinity));
        case 'oi': return dir * ((a.oiValue ?? 0) - (b.oiValue ?? 0));
        case 'volume': return dir * ((a.volume ?? 0) - (b.volume ?? 0));
        default: return 0;
      }
    });
    return list;
  }, [filtered, sortKey, sortDir, rows]);

  const median = rows.length > 0 ? rows.reduce((s, r) => s + r.price, 0) / rows.length : 0;
  const highPrice = rows.length > 0 ? Math.max(...rows.map(r => r.price)) : 0;
  const lowPrice = rows.length > 0 ? Math.min(...rows.map(r => r.price)) : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'exchange' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-2.5 h-2.5 text-neutral-700 ml-0.5 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-2.5 h-2.5 text-hub-yellow ml-0.5 inline" />
      : <ArrowDown className="w-2.5 h-2.5 text-hub-yellow ml-0.5 inline" />;
  };

  const cexCount = rows.filter(r => r.isCex).length;
  const dexCount = rows.filter(r => r.isDex).length;

  // Loading skeleton
  if (loading && rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden lg:col-span-2">
        <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06]">
          <div className="h-4 w-48 bg-white/[0.04] rounded animate-pulse" />
          <div className="h-3 w-32 bg-white/[0.03] rounded animate-pulse mt-1.5" />
        </div>
        <div className="p-1">
          {/* Header skeleton */}
          <div className="flex gap-3 px-4 py-2.5 border-b border-white/[0.04]">
            {[80, 60, 70, 50, 60, 55, 65, 55].map((w, i) => (
              <div key={i} className="h-3 bg-white/[0.03] rounded animate-pulse" style={{ width: w }} />
            ))}
          </div>
          {/* Row skeletons */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.02]">
              <div className="w-[18px] h-[18px] rounded-full bg-white/[0.04] animate-pulse" />
              <div className="h-3 bg-white/[0.04] rounded animate-pulse" style={{ width: 60 + (i % 3) * 15 }} />
              <div className="ml-auto flex gap-4">
                {[50, 45, 40, 50, 55, 50].map((w, j) => (
                  <div key={j} className="h-3 bg-white/[0.03] rounded animate-pulse" style={{ width: w }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden lg:col-span-2">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{sym} Across Exchanges</h3>
          <p className="text-[10px] text-neutral-500 mt-0.5">
            {sorted.length} exchange{sorted.length !== 1 ? 's' : ''} · refreshes every 15s
            {highPrice > 0 && lowPrice > 0 && (
              <> · spread <span className="text-hub-yellow font-medium">${fp(highPrice - lowPrice)}</span></>
            )}
          </p>
        </div>
        {/* CEX / DEX filter tabs */}
        <div className="flex items-center gap-[2px] p-[2px] rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <button onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition ${filter === 'all' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-500 hover:text-neutral-300'}`}>
            All <span className="tabular-nums">{rows.length}</span>
          </button>
          <button onClick={() => setFilter('cex')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition flex items-center gap-1 ${filter === 'cex' ? 'bg-blue-500/15 text-blue-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Globe className="w-2.5 h-2.5" /> CEX <span className="tabular-nums">{cexCount}</span>
          </button>
          <button onClick={() => setFilter('dex')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition flex items-center gap-1 ${filter === 'dex' ? 'bg-purple-500/15 text-purple-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Layers className="w-2.5 h-2.5" /> DEX <span className="tabular-nums">{dexCount}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="exchange-table">
          <thead>
            <tr className="text-[10px] text-neutral-500 uppercase tracking-wider border-b border-white/[0.06]">
              <th className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('exchange')}>
                Exchange <SortIcon col="exchange" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('price')}>
                Price <SortIcon col="price" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium">Bid/Ask</th>
              <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('deviation')}>
                vs Median <SortIcon col="deviation" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('change')}>
                24h <SortIcon col="change" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('funding')}>
                Funding (8h) <SortIcon col="funding" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium">Ann. Rate</th>
              <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('oi')}>
                Open Interest <SortIcon col="oi" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('volume')}>
                Volume 24h <SortIcon col="volume" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const dev = median > 0 ? ((r.price - median) / median) * 100 : 0;
              const ws = wsPrices[r.exchange];
              const hasBidAsk = ws && ws.bid > 0 && ws.ask > 0 && ws.ask > ws.bid && Math.abs(ws.ask - ws.bid) / ws.bid < 0.01;
              const ref = getExchangeReferralUrl(r.exchange);
              const isHigh = r.price === highPrice && rows.length > 1;
              const isLow = r.price === lowPrice && rows.length > 1;
              return (
                <tr key={r.exchange}
                  className={`border-b border-white/[0.03] transition-colors hover:bg-white/[0.02] ${
                    isHigh ? 'bg-green-500/[0.03]' : isLow ? 'bg-red-500/[0.03]' : ''
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
                      {r.isDex && <span className="text-[7px] px-1 py-[0.5px] rounded-full bg-purple-500/10 text-purple-400/70 font-medium">DEX</span>}
                      {isHigh && <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-green-500/10 text-green-400 font-bold tracking-wide">HIGH</span>}
                      {isLow && <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-red-500/10 text-red-400 font-bold tracking-wide">LOW</span>}
                      {isHigh && r.fundingRate !== undefined && r.fundingRate < -0.005 && (
                        <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-purple-500/10 text-purple-400 font-bold" title="High price + negative funding = short arb opportunity">ARB</span>
                      )}
                      {isLow && r.fundingRate !== undefined && r.fundingRate > 0.01 && (
                        <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-purple-500/10 text-purple-400 font-bold" title="Low price + positive funding = long arb opportunity">ARB</span>
                      )}
                      {r.isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" title="Live WS price" />}
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
                  <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${dev >= 0.001 ? 'text-green-400' : dev <= -0.001 ? 'text-red-400' : 'text-neutral-400'}`} title={getDeviationSlang(dev)}>
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

      {/* Table footer with data summary */}
      {rows.length > 1 && (
        <div className="px-4 py-2 border-t border-white/[0.04] flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-neutral-600">
          <span>Median: <span className="text-neutral-400 font-mono tabular-nums">${fp(median)}</span></span>
          <span>Spread: <span className="text-hub-yellow font-mono tabular-nums">${fp(highPrice - lowPrice)}</span></span>
          <span>Spread: <span className="text-hub-yellow font-mono tabular-nums">{median > 0 ? (((highPrice - lowPrice) / lowPrice) * 100).toFixed(3) : '0.000'}%</span></span>
          {(() => {
            const totalOI = rows.reduce((s, r) => s + (r.oiValue || 0), 0);
            return totalOI > 0 ? <span>Total OI: <span className="text-neutral-400 font-mono tabular-nums">{fmtUsd(totalOI)}</span></span> : null;
          })()}
          {(() => {
            const totalVol = rows.reduce((s, r) => s + (r.volume || 0), 0);
            return totalVol > 0 ? <span>Total Vol: <span className="text-neutral-400 font-mono tabular-nums">{fmtUsd(totalVol)}</span></span> : null;
          })()}
        </div>
      )}
    </div>
  );
}

export const ExchangeTable = memo(ExchangeTableInner);
