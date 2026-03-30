'use client';

import { memo, useState, useEffect, useMemo, useRef } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Globe, Layers } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { getExchangeReferralUrl } from '@/lib/referralLinks';
import { fp } from '../../lib/spread-math';
import { getFundingSlang, getDeviationSlang, getOISlang } from '../../lib/trader-slang';
import { CEX_EXCHANGES, DEX_EXCHANGES } from '../../lib/symbols';
import type { SpreadStats, WsPrice, Candle } from '../../lib/types';

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

/** Tiny inline sparkline SVG from price history */
function Sparkline({ data, width = 60, height = 20 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <span className="w-[60px]" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  const last = data[data.length - 1];
  const first = data[0];
  const color = last >= first ? '#22c55e' : '#ef4444';
  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - ((last - min) / range) * (height - 2) - 1} r="1.5" fill={color} />
    </svg>
  );
}

type SortKey = 'exchange' | 'price' | 'deviation' | 'change' | 'funding' | 'oi' | 'volume';
type SortDir = 'asc' | 'desc';
type FilterTab = 'all' | 'cex' | 'dex';

interface EnrichedEntry {
  exchange: string;
  lastPrice: number;
  change24h?: number;
  quoteVolume24h?: number;
  fundingRate?: number;
  fundingInterval?: string;
  markPrice?: number;
  openInterestValue?: number;
}

interface ExchangeTableProps {
  sym: string;
  stats: SpreadStats;
  wsPrices: Record<string, WsPrice>;
  klineData: Record<string, Candle[]> | null;
}

const cexSet = new Set(CEX_EXCHANGES);
const dexSet = new Set(DEX_EXCHANGES);

function ExchangeTableInner({ sym, stats, wsPrices, klineData }: ExchangeTableProps) {
  const [enriched, setEnriched] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState<FilterTab>('all');

  // Price history for sparklines (last 30 snapshots per exchange)
  const priceHistoryRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`/api/enriched?symbol=${sym}`)
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          if (cancelled) return;
          setEnriched(json?.data || []);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    };
    setLoading(true);
    priceHistoryRef.current = {}; // reset on symbol change
    const delay = setTimeout(load, 500);
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearTimeout(delay); clearInterval(iv); };
  }, [sym]);

  // Track price history from WS for sparklines
  useEffect(() => {
    const hist = priceHistoryRef.current;
    for (const [ex, ws] of Object.entries(wsPrices)) {
      if (ws.price > 0) {
        if (!hist[ex]) hist[ex] = [];
        const arr = hist[ex];
        // Only push if price actually changed
        if (arr.length === 0 || arr[arr.length - 1] !== ws.price) {
          arr.push(ws.price);
          if (arr.length > 30) arr.shift();
        }
      }
    }
  }, [wsPrices]);

  const rows = useMemo(() => {
    const enrichedMap = new Map(enriched.map(e => [e.exchange, e]));
    // Merge all sources: enriched API + stats.prices + wsPrices
    const allExchanges = new Set([
      ...enriched.map(e => e.exchange),
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

    return Array.from(allExchanges).map(e => {
      const en = enrichedMap.get(e);
      const wsP = wsPrices[e];
      // Price: prefer live WS > enriched API > stats
      const price = (wsP?.price && wsP.price > 0 ? wsP.price : 0)
        || en?.lastPrice
        || stats.prices.find(p => p.e === e)?.p
        || 0;

      return {
        exchange: e,
        price,
        change: changeMap.get(e) ?? en?.change24h,
        fundingRate: en?.fundingRate,
        fundingInterval: en?.fundingInterval,
        oiValue: en?.openInterestValue,
        volume: en?.quoteVolume24h,
        isCex: cexSet.has(e),
        isDex: dexSet.has(e),
        isLive: !!(wsP?.price && wsP.price > 0 && (Date.now() - wsP.ts) < 30000),
        sparkData: priceHistoryRef.current[e] || [],
      };
    }).filter(r => r.price > 0);
  }, [enriched, stats.prices, klineData, wsPrices]);

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
    const med = rows.length > 0 ? rows.reduce((s, r) => s + r.price, 0) / rows.length : 0;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'exchange': return dir * a.exchange.localeCompare(b.exchange);
        case 'price': return dir * (a.price - b.price);
        case 'deviation': {
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
          <div className="flex gap-3 px-4 py-2.5 border-b border-white/[0.04]">
            {[80, 60, 70, 50, 60, 55, 65, 55].map((w, i) => (
              <div key={i} className="h-3 bg-white/[0.03] rounded animate-pulse" style={{ width: w }} />
            ))}
          </div>
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
            {highPrice > 0 && lowPrice > 0 && rows.length > 1 && (
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
              <th className="px-2 py-2.5 text-center font-medium">Trend</th>
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
              // Funding annualized: adjust for interval
              const annMultiplier = r.fundingInterval === '1h' ? 8760 : r.fundingInterval === '4h' ? 2190 : 1095; // 1h=8760, 4h=2190, 8h=1095
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
                  {/* Sparkline */}
                  <td className="px-2 py-2.5 text-center">
                    <Sparkline data={r.sparkData} />
                  </td>
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
                    {r.fundingRate !== undefined ? (r.fundingRate >= 0 ? '+' : '') + (r.fundingRate * 100 * annMultiplier).toFixed(1) + '%' : <span className="text-neutral-700">—</span>}
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

      {/* Table footer */}
      {rows.length > 1 && (
        <div className="px-4 py-2 border-t border-white/[0.04] flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-neutral-600">
          <span>Median: <span className="text-neutral-400 font-mono tabular-nums">${fp(median)}</span></span>
          <span>Spread: <span className="text-hub-yellow font-mono tabular-nums">${fp(highPrice - lowPrice)}</span></span>
          <span>Spread: <span className="text-hub-yellow font-mono tabular-nums">{lowPrice > 0 ? (((highPrice - lowPrice) / lowPrice) * 100).toFixed(3) : '0.000'}%</span></span>
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
