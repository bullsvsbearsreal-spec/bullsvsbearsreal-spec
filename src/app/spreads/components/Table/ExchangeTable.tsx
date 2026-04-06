'use client';

import { memo, useState, useEffect, useMemo, useRef } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Globe, Layers, SlidersHorizontal } from 'lucide-react';
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

type SortKey = 'exchange' | 'price' | 'spreadFromMin' | 'deviation' | 'change' | 'funding' | 'oi' | 'volume';
type SortDir = 'asc' | 'desc';
type FilterTab = 'all' | 'cex' | 'dex';

// Columns that can be toggled on/off
type ColumnKey = 'trend' | 'bidask' | 'median' | 'vslow' | 'change' | 'funding' | 'annrate' | 'oi' | 'volume';
const ALL_COLUMNS: { key: ColumnKey; label: string; defaultOn: boolean }[] = [
  { key: 'trend', label: 'Trend', defaultOn: true },
  { key: 'bidask', label: 'Bid/Ask', defaultOn: true },
  { key: 'median', label: 'vs Median', defaultOn: true },
  { key: 'vslow', label: 'vs Low', defaultOn: true },
  { key: 'change', label: '24h', defaultOn: true },
  { key: 'funding', label: 'Funding', defaultOn: true },
  { key: 'annrate', label: 'Ann. Rate', defaultOn: false },
  { key: 'oi', label: 'OI', defaultOn: true },
  { key: 'volume', label: 'Volume', defaultOn: true },
];

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
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(() => {
    if (typeof window === 'undefined') return new Set(ALL_COLUMNS.filter(c => c.defaultOn).map(c => c.key));
    try {
      const saved = localStorage.getItem('spreads-cols');
      if (saved) return new Set(JSON.parse(saved) as ColumnKey[]);
    } catch {}
    return new Set(ALL_COLUMNS.filter(c => c.defaultOn).map(c => c.key));
  });
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // Close column picker on outside click
  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setShowColPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColPicker]);

  const toggleCol = (key: ColumnKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('spreads-cols', JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };
  const col = (key: ColumnKey) => visibleCols.has(key);

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
        case 'spreadFromMin': {
          const low = rows.length > 0 ? Math.min(...rows.map(r => r.price)) : 0;
          const sa = low > 0 ? (a.price - low) / low : 0;
          const sb = low > 0 ? (b.price - low) / low : 0;
          return dir * (sa - sb);
        }
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
        <div className="flex items-center gap-2">
          {/* Column picker */}
          <div className="relative" ref={colPickerRef}>
            <button onClick={() => setShowColPicker(!showColPicker)}
              className={`p-1.5 rounded-lg border text-[10px] transition ${
                showColPicker ? 'bg-hub-yellow/10 border-hub-yellow/20 text-hub-yellow' : 'bg-white/[0.03] border-white/[0.06] text-neutral-500 hover:text-neutral-300'
              }`} title="Toggle columns">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-1 z-20 p-2 rounded-xl bg-[#141619] border border-white/[0.1] shadow-xl min-w-[140px]">
                <p className="text-[9px] text-neutral-500 uppercase tracking-wider px-1 mb-1.5">Columns</p>
                {ALL_COLUMNS.map(c => (
                  <label key={c.key} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-white/[0.04] cursor-pointer text-[11px]">
                    <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)}
                      className="w-3 h-3 rounded accent-hub-yellow" />
                    <span className={visibleCols.has(c.key) ? 'text-neutral-200' : 'text-neutral-600'}>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
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
      </div>

      {/* ── Mobile card layout ── */}
      <div className="sm:hidden divide-y divide-white/[0.04]">
        {sorted.map((r, idx) => {
          const fromLow = lowPrice > 0 ? ((r.price - lowPrice) / lowPrice) * 100 : 0;
          const ref = getExchangeReferralUrl(r.exchange);
          const isHigh = r.price === highPrice && rows.length > 1;
          const isLow = r.price === lowPrice && rows.length > 1;
          const annMultiplier = r.fundingInterval === '1h' ? 8760 : r.fundingInterval === '4h' ? 2190 : 1095;
          return (
            <div key={r.exchange} className={`px-4 py-3 ${
              isHigh ? 'bg-green-500/[0.04]' : isLow ? 'bg-red-500/[0.04]' : idx % 2 === 1 ? 'bg-white/[0.015]' : ''
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-2">
                  <ExchangeLogo exchange={r.exchange} size={18} />
                  {ref ? (
                    <a href={ref} target="_blank" rel="noopener noreferrer" className="font-medium text-white hover:text-hub-yellow transition text-sm">{r.exchange}</a>
                  ) : (
                    <span className="font-medium text-white text-sm">{r.exchange}</span>
                  )}
                  {r.isDex && <span className="text-[7px] px-1 py-[0.5px] rounded-full bg-purple-500/10 text-purple-400/70 font-medium">DEX</span>}
                  {isHigh && <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-green-500/10 text-green-400 font-bold">HIGH</span>}
                  {isLow && <span className="text-[7px] px-1.5 py-[1px] rounded-full bg-red-500/10 text-red-400 font-bold">LOW</span>}
                  {r.isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
                </span>
                <span className="font-mono text-white text-sm font-semibold tabular-nums">${fp(r.price)}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums">
                {fromLow >= 0.001 && (
                  <span className={fromLow < 0.01 ? 'text-yellow-400/60' : fromLow < 0.05 ? 'text-yellow-400' : 'text-orange-400'}>
                    vs Low +{fromLow.toFixed(3)}%
                  </span>
                )}
                {r.fundingRate !== undefined && (() => {
                  const rate8h = r.fundingRate * (r.fundingInterval === '1h' ? 8 : r.fundingInterval === '4h' ? 2 : 1);
                  return (
                  <span className={rate8h >= 0 ? 'text-green-400' : 'text-red-400'}>
                    F: {rate8h >= 0 ? '+' : ''}{rate8h.toFixed(4)}%
                  </span>
                  );
                })()}
                {r.change !== undefined && (
                  <span className={r.change >= 0 ? 'text-green-400/70' : 'text-red-400/70'}>
                    24h {r.change >= 0 ? '+' : ''}{r.change.toFixed(2)}%
                  </span>
                )}
                {r.oiValue && r.oiValue > 0 && (
                  <span className="text-neutral-500">OI {fmtUsd(r.oiValue)}</span>
                )}
                {r.volume && r.volume > 0 && (
                  <span className="text-neutral-500">Vol {fmtUsd(r.volume)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table ── */}
      <div className="overflow-x-auto hidden sm:block">
        <table className="w-full text-xs" data-testid="exchange-table">
          <thead>
            <tr className="text-[10px] text-neutral-500 uppercase tracking-wider border-b border-white/[0.06]">
              <th className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('exchange')}>
                Exchange <SortIcon col="exchange" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('price')}>
                Price <SortIcon col="price" />
              </th>
              {col('trend') && <th className="px-2 py-2.5 text-center font-medium">Trend</th>}
              {col('bidask') && <th className="px-3 py-2.5 text-right font-medium">Bid/Ask</th>}
              {col('median') && <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('deviation')}>
                vs Median <SortIcon col="deviation" />
              </th>}
              {col('vslow') && <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('spreadFromMin')}>
                vs Low <SortIcon col="spreadFromMin" />
              </th>}
              {col('change') && <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('change')}>
                24h <SortIcon col="change" />
              </th>}
              {col('funding') && <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('funding')}>
                Funding (8h) <SortIcon col="funding" />
              </th>}
              {col('annrate') && <th className="px-3 py-2.5 text-right font-medium">Ann. Rate</th>}
              {col('oi') && <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('oi')}>
                Open Interest <SortIcon col="oi" />
              </th>}
              {col('volume') && <th className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-neutral-300 transition select-none" onClick={() => handleSort('volume')}>
                Volume 24h <SortIcon col="volume" />
              </th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => {
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
                  className={`border-b border-white/[0.03] transition-colors hover:bg-white/[0.03] ${
                    isHigh ? 'bg-green-500/[0.04]' : isLow ? 'bg-red-500/[0.04]' : idx % 2 === 1 ? 'bg-white/[0.015]' : ''
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
                  {col('trend') && <td className="px-2 py-2.5 text-center">
                    <Sparkline data={r.sparkData} />
                  </td>}
                  {/* Bid/Ask */}
                  {col('bidask') && <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {hasBidAsk ? (
                      <span className="text-neutral-300" title={`Bid $${fp(ws.bid)} / Ask $${fp(ws.ask)}`}>
                        <span className="text-green-400/70">{fp(ws.bid)}</span>
                        <span className="text-neutral-600 mx-0.5">/</span>
                        <span className="text-red-400/70">{fp(ws.ask)}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-700">—</span>
                    )}
                  </td>}
                  {/* vs Median */}
                  {col('median') && <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${dev >= 0.001 ? 'text-green-400' : dev <= -0.001 ? 'text-red-400' : 'text-neutral-400'}`} title={getDeviationSlang(dev)}>
                    {dev >= 0 ? '+' : ''}{dev.toFixed(3)}%
                  </td>}
                  {/* Spread from Min */}
                  {col('vslow') && (() => {
                    const fromLow = lowPrice > 0 ? ((r.price - lowPrice) / lowPrice) * 100 : 0;
                    const bps = fromLow * 100;
                    return (
                      <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                        fromLow < 0.001 ? 'text-neutral-400' : fromLow < 0.01 ? 'text-yellow-400/60' : fromLow < 0.05 ? 'text-yellow-400' : 'text-orange-400'
                      }`} title={`${bps.toFixed(1)} bps from lowest price`}>
                        {fromLow < 0.001 ? '—' : `+${fromLow.toFixed(3)}%`}
                      </td>
                    );
                  })()}
                  {/* 24h Change */}
                  {col('change') && <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${r.change !== undefined ? (r.change >= 0 ? 'text-green-400/80' : 'text-red-400/80') : ''}`}>
                    {r.change !== undefined ? (r.change >= 0 ? '+' : '') + r.change.toFixed(2) + '%' : <span className="text-neutral-700">—</span>}
                  </td>}
                  {/* Funding 8h */}
                  {col('funding') && (() => {
                    const rate8h = r.fundingRate !== undefined ? r.fundingRate * (r.fundingInterval === '1h' ? 8 : r.fundingInterval === '4h' ? 2 : 1) : undefined;
                    return <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${rate8h !== undefined ? (rate8h >= 0 ? 'text-green-400' : 'text-red-400') : ''}`}
                    title={rate8h !== undefined ? getFundingSlang(rate8h) : undefined}>
                    {rate8h !== undefined ? (rate8h >= 0 ? '+' : '') + rate8h.toFixed(4) + '%' : <span className="text-neutral-700">—</span>}
                  </td>;
                  })()}
                  {/* Annualized */}
                  {col('annrate') && <td className={`px-3 py-2.5 text-right font-mono tabular-nums text-[10px] ${r.fundingRate !== undefined ? (r.fundingRate >= 0 ? 'text-green-400/60' : 'text-red-400/60') : ''}`}>
                    {r.fundingRate !== undefined ? (r.fundingRate >= 0 ? '+' : '') + (r.fundingRate * annMultiplier).toFixed(1) + '%' : <span className="text-neutral-700">—</span>}
                  </td>}
                  {/* OI */}
                  {col('oi') && <td className="px-3 py-2.5 text-right font-mono text-neutral-300 tabular-nums" title={r.oiValue ? getOISlang(r.oiValue) : undefined}>
                    {fmtUsd(r.oiValue || 0)}
                  </td>}
                  {/* Volume */}
                  {col('volume') && <td className="px-3 py-2.5 text-right font-mono text-neutral-300 tabular-nums">
                    {fmtUsd(r.volume || 0)}
                  </td>}
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
