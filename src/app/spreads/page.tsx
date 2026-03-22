'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, ResponsiveContainer, Area,
} from 'recharts';
import { ArrowLeftRight, Search, ChevronDown, X, Info, RefreshCw, Calculator, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCoinIcon } from '@/lib/coinIcons';

// ─── Colors per exchange (TradingView neon palette) ──────────────────────────
const COLORS: Record<string, string> = {
  Binance: '#F0B90B', Bybit: '#FF6B6B', OKX: '#00FF9D', Bitget: '#00D4FF',
  MEXC: '#A855F7', HTX: '#FF61D2', Hyperliquid: '#00FFCC', dYdX: '#6966FF',
  Kraken: '#FF9500', 'Gate.io': '#3B82F6', Coinbase: '#0052FF', Phemex: '#D4FF00',
};
const PALETTE = ['#F0B90B','#FF6B6B','#00FF9D','#00D4FF','#A855F7','#FF61D2','#00FFCC','#6966FF','#FF9500','#3B82F6'];
function getColor(ex: string, i: number) { return COLORS[ex] || PALETTE[i % PALETTE.length]; }

// ─── Types ───────────────────────────────────────────────────────────────────
type Candle = { t: number; c: number };
type ChartPoint = { time: number; label: string; [ex: string]: number | string };

const SYMBOLS = {
  Majors: ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','LINK','TON','LTC','BCH','ETC','TRX'],
  'Layer 2': ['ARB','OP','MATIC','STRK','ZK','IMX','MANTA','STX','SEI'],
  Alts: ['SUI','APT','NEAR','DOT','FIL','ATOM','INJ','HBAR','RENDER','TIA','ALGO','VET','FTM'],
  DeFi: ['AAVE','UNI','MKR','CRV','DYDX','SNX','COMP','LDO','EIGEN','ENA','ONDO','JUP','PYTH'],
  Memes: ['PEPE','WIF','BONK','FLOKI','SHIB','POPCAT','BRETT','MOG','MEW','TRUMP','PENGU','TURBO','NEIRO'],
  Gaming: ['SAND','MANA','AXS','GALA','BLUR','ENS','WLD','W','ZRO'],
};
const ALL_SYMBOLS = [...SYMBOLS.Majors, ...SYMBOLS.Alts, ...SYMBOLS.Memes];

const EXCHANGES = ['Binance','Bybit','OKX','Bitget','MEXC','HTX','Hyperliquid','dYdX'];

const TIMEFRAMES = [
  { key: '1d', label: '1D', interval: '1h', limit: 24 },
  { key: '7d', label: '7D', interval: '1h', limit: 168 },
  { key: '30d', label: '30D', interval: '4h', limit: 180 },
] as const;
type TfKey = typeof TIMEFRAMES[number]['key'];

function formatPrice(v: number) {
  if (v >= 1000) return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return '$' + v.toFixed(2);
  return '$' + v.toPrecision(4);
}
function formatCompact(v: number) {
  if (v >= 1e9) return '$' + (v/1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v/1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v/1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(2);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SpreadsPage() {
  const [symbol, setSymbol] = useState('BTC');
  const [selected, setSelected] = useState<string[]>(['Binance', 'Bybit', 'OKX', 'Hyperliquid']);
  const [tf, setTf] = useState<TfKey>('1d');
  const [showSymPicker, setShowSymPicker] = useState(false);
  const [symSearch, setSymSearch] = useState('');
  const [showExPicker, setShowExPicker] = useState(false);
  const [klineData, setKlineData] = useState<Record<string, Candle[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [viewMode, setViewMode] = useState<'price' | 'deviation'>('price');
  const [calcSize, setCalcSize] = useState('10000');
  const [calcFee, setCalcFee] = useState('0.1');

  // ── Fetch klines ──
  useEffect(() => {
    const t = TIMEFRAMES.find(x => x.key === tf)!;
    setLoading(true);
    let cancelled = false;
    fetch(`/api/klines-multi?symbol=${symbol}&interval=${t.interval}&limit=${t.limit}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return;
        const ex = json?.exchanges as Record<string, Candle[]> | undefined;
        setKlineData(ex && Object.keys(ex).length > 0 ? ex : null);
      })
      .catch(() => { if (!cancelled) setKlineData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, tf]);

  // ── Build chart data ──
  const { chartData, activeExchanges } = useMemo(() => {
    if (!klineData) return { chartData: [] as ChartPoint[], activeExchanges: [] as string[] };
    const avail = Object.keys(klineData);
    const active = selected.filter(e => avail.includes(e));
    const exs = active.length >= 1 ? active : avail.slice(0, 4);
    if (exs.length < 1) return { chartData: [], activeExchanges: [] };

    // Bucket timestamps
    const allTimes = new Set<number>();
    const maps: Record<string, Map<number, number>> = {};
    for (const ex of exs) {
      const m = new Map<number, number>();
      for (const c of klineData[ex]) if (c.c > 0) { m.set(c.t, c.c); allTimes.add(c.t); }
      maps[ex] = m;
    }

    const sorted = Array.from(allTimes).sort((a,b) => a - b);
    const rows: ChartPoint[] = [];
    const last: Record<string, number> = {};
    for (const t of sorted) {
      const pt: ChartPoint = { time: t, label: '' };
      let hasAny = false;
      for (const ex of exs) {
        const p = maps[ex]?.get(t) ?? last[ex];
        if (p) { last[ex] = p; pt[ex] = p; hasAny = true; }
      }
      if (!hasAny) continue;
      // Compute spread band + deviation %
      const prices = exs.map(e => pt[e] as number).filter(p => typeof p === 'number' && p > 0);
      if (prices.length >= 2) {
        pt._min = Math.min(...prices);
        pt._max = Math.max(...prices);
        pt._spread = (pt._max as number) - (pt._min as number);
        const med = prices.reduce((s, p) => s + p, 0) / prices.length;
        // Add deviation % for each exchange (deviation from mean)
        for (const ex of exs) {
          const p = pt[ex] as number;
          if (typeof p === 'number' && p > 0 && med > 0) {
            pt[`${ex}_dev`] = ((p - med) / med) * 100; // % deviation
          }
        }
        pt._devMin = ((pt._min as number) - med) / med * 100;
        pt._devMax = ((pt._max as number) - med) / med * 100;
      }
      const d = new Date(t);
      pt.label = tf === '30d'
        ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : tf === '7d'
          ? d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rows.push(pt);
    }
    return { chartData: rows, activeExchanges: exs };
  }, [klineData, selected, tf]);

  // ── Spread stats ──
  const stats = useMemo(() => {
    if (chartData.length === 0 || activeExchanges.length < 2) return null;
    let sumSpread = 0, maxSpread = 0, minSpread = Infinity, maxTime = 0, minTime = 0;
    let count = 0;
    for (const pt of chartData) {
      const prices = activeExchanges.map(e => pt[e] as number).filter(p => typeof p === 'number' && p > 0);
      if (prices.length < 2) continue;
      const spread = Math.max(...prices) - Math.min(...prices);
      sumSpread += spread;
      count++;
      if (spread > maxSpread) { maxSpread = spread; maxTime = pt.time; }
      if (spread < minSpread) { minSpread = spread; minTime = pt.time; }
    }
    const avg = count > 0 ? sumSpread / count : 0;
    // Current spread
    const last = chartData[chartData.length - 1];
    const lastPrices = activeExchanges.map(e => ({ ex: e, p: last[e] as number })).filter(x => typeof x.p === 'number' && x.p > 0);
    lastPrices.sort((a,b) => b.p - a.p);
    const current = lastPrices.length >= 2 ? lastPrices[0].p - lastPrices[lastPrices.length-1].p : 0;
    const currentPct = lastPrices.length >= 2 ? (current / lastPrices[lastPrices.length-1].p) * 100 : 0;
    return {
      current, currentPct, avg, max: maxSpread, min: minSpread === Infinity ? 0 : minSpread,
      maxTime, minTime, highest: lastPrices[0], lowest: lastPrices[lastPrices.length-1],
      prices: lastPrices,
    };
  }, [chartData, activeExchanges]);

  // ── Symbol picker filter ──
  const filteredSymbols = useMemo(() => {
    if (!symSearch) return ALL_SYMBOLS;
    const q = symSearch.toUpperCase();
    return ALL_SYMBOLS.filter(s => s.includes(q));
  }, [symSearch]);

  const toggleExchange = useCallback((ex: string) => {
    setSelected(prev => prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex].slice(0, 8));
  }, []);

  // ── Custom Tooltip ──
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0]?.payload;
    if (!pt) return null;
    const prices = activeExchanges.map(ex => ({
      ex, p: pt[ex] as number, dev: pt[`${ex}_dev`] as number
    })).filter(x => typeof x.p === 'number');
    prices.sort((a,b) => b.p - a.p);
    const spread = prices.length >= 2 ? prices[0].p - prices[prices.length-1].p : 0;
    const spreadPct = prices.length >= 2 ? (spread / prices[prices.length-1].p) * 100 : 0;
    return (
      <div className="bg-[#0d0f1a] border border-white/10 rounded-lg px-3 py-2.5 shadow-2xl text-xs min-w-[200px]">
        <p className="text-neutral-400 mb-2 text-[10px]">{pt.label}</p>
        {prices.map((x) => (
          <div key={x.ex} className="flex items-center justify-between gap-4 py-[2px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: getColor(x.ex, activeExchanges.indexOf(x.ex)) }} />
              <span className="text-neutral-300">{x.ex}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-white">{formatPrice(x.p)}</span>
              {typeof x.dev === 'number' && (
                <span className={`font-mono text-[10px] ${x.dev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {x.dev >= 0 ? '+' : ''}{x.dev.toFixed(3)}%
                </span>
              )}
            </span>
          </div>
        ))}
        {prices.length >= 2 && (
          <div className="border-t border-white/10 mt-2 pt-2 flex justify-between">
            <span className="text-neutral-500">Spread</span>
            <span className="font-mono text-hub-yellow">{formatPrice(spread)} <span className="text-neutral-500 text-[10px]">({spreadPct.toFixed(3)}%)</span></span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0e1a] text-white flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-6">

        {/* ── Title Row ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6 text-hub-yellow" />
              Exchange <span className="text-hub-yellow">Spreads</span>
            </h1>
            <p className="text-neutral-500 text-sm mt-1">Compare {symbol}/USDT perp prices across {EXCHANGES.length} exchanges</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCalc(!showCalc)} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white transition flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Arb Calc
            </button>
          </div>
        </div>

        {/* ── Controls Row ── */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Symbol Picker */}
          <div className="relative">
            <button onClick={() => setShowSymPicker(!showSymPicker)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-hub-yellow/30 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getCoinIcon(symbol)} alt="" className="w-5 h-5 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-lg font-bold">{symbol}</span>
              <span className="text-neutral-500 text-sm">/USDT</span>
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            </button>
            {showSymPicker && (
              <div className="absolute top-full mt-1 left-0 z-50 w-56 max-h-80 overflow-y-auto rounded-lg bg-[#141418] border border-white/[0.08] shadow-2xl">
                <div className="p-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.04]">
                    <Search className="w-3.5 h-3.5 text-neutral-500" />
                    <input value={symSearch} onChange={e => setSymSearch(e.target.value)} placeholder="Search..." autoFocus
                      className="bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none w-full" />
                  </div>
                </div>
                {Object.entries(SYMBOLS).map(([group, syms]) => {
                  const filtered = syms.filter(s => !symSearch || s.includes(symSearch.toUpperCase()));
                  if (filtered.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="px-3 py-1 text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">{group}</p>
                      {filtered.map(s => (
                        <button key={s} onClick={() => { setSymbol(s); setShowSymPicker(false); setSymSearch(''); }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/[0.04] flex items-center gap-2 ${s === symbol ? 'text-hub-yellow' : 'text-neutral-300'}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getCoinIcon(s)} alt="" className="w-4 h-4 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          {s}
                          {s === symbol && <span className="ml-auto text-hub-yellow text-[10px]">✓</span>}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timeframe Tabs */}
          <div className="flex items-center gap-[2px] p-[3px] rounded-lg bg-white/[0.03] border border-white/[0.06]">
            {TIMEFRAMES.map(t => (
              <button key={t.key} onClick={() => setTf(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tf === t.key ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-500 hover:text-neutral-300'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Exchange Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {selected.map((ex, i) => (
              <span key={ex} className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] border border-white/[0.06]">
                <span className="w-2 h-2 rounded-full" style={{ background: getColor(ex, i) }} />
                {ex}
                <button onClick={() => toggleExchange(ex)} className="ml-0.5 text-neutral-600 hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <div className="relative">
              <button onClick={() => setShowExPicker(!showExPicker)}
                className="px-2 py-1 rounded-full text-[11px] text-neutral-500 bg-white/[0.03] border border-white/[0.06] hover:border-hub-yellow/30 transition">
                + Exchange
              </button>
              {showExPicker && (
                <div className="absolute top-full mt-1 left-0 z-50 w-44 rounded-lg bg-[#141418] border border-white/[0.08] shadow-2xl py-1">
                  {EXCHANGES.map(ex => (
                    <button key={ex} onClick={() => { toggleExchange(ex); setShowExPicker(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.04] flex items-center justify-between ${selected.includes(ex) ? 'text-hub-yellow' : 'text-neutral-400'}`}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: getColor(ex, EXCHANGES.indexOf(ex)) }} />
                        {ex}
                      </span>
                      {selected.includes(ex) && <span className="text-hub-yellow text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[10px] text-neutral-600">{selected.length} of {EXCHANGES.length}</span>
          </div>
        </div>

        {/* ── Spread Hero ── */}
        {stats && (
          <div className="rounded-xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/[0.08] p-5 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getCoinIcon(symbol)} alt="" className="w-5 h-5 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <p className="text-neutral-500 text-xs">
                  {activeExchanges.length === 2 ? `${stats.highest?.ex} vs ${stats.lowest?.ex}` : `Max spread across ${activeExchanges.length} exchanges`}
                </p>
              </div>
              <div className="flex items-baseline gap-3">
                <span className={`text-3xl font-bold font-mono ${stats.current > 0 ? 'text-hub-yellow' : 'text-neutral-400'}`}>
                  {formatPrice(stats.current)}
                </span>
                <span className="text-neutral-400 text-sm">{stats.currentPct.toFixed(4)}%</span>
                <span className="text-neutral-600 text-xs">({(stats.currentPct * 100).toFixed(1)} bps)</span>
              </div>
            </div>
            <div className="flex gap-4 sm:gap-6 flex-wrap">
              <div className="text-right">
                <p className="text-[10px] text-neutral-500 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> Highest</p>
                <p className="font-mono text-sm text-white">{stats.highest ? formatPrice(stats.highest.p) : '—'}</p>
                <p className="text-[10px] text-green-400">{stats.highest?.ex}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-neutral-500 flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-400" /> Lowest</p>
                <p className="font-mono text-sm text-white">{stats.lowest ? formatPrice(stats.lowest.p) : '—'}</p>
                <p className="text-[10px] text-red-400">{stats.lowest?.ex}</p>
              </div>
              <div className="text-right border-l border-white/[0.06] pl-4">
                <p className="text-[10px] text-neutral-500">Spread Range ({TIMEFRAMES.find(t=>t.key===tf)?.label})</p>
                <p className="font-mono text-sm text-white">{formatPrice(stats.min)} — {formatPrice(stats.max)}</p>
                <p className="text-[10px] text-neutral-500">avg {formatPrice(stats.avg)}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Chart ── */}
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-300">Price Chart</h2>
              <div className="flex items-center gap-[2px] p-[2px] rounded-md bg-white/[0.03] border border-white/[0.06]">
                <button onClick={() => setViewMode('price')}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold transition ${viewMode === 'price' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600 hover:text-neutral-400'}`}>$</button>
                <button onClick={() => setViewMode('deviation')}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold transition ${viewMode === 'deviation' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600 hover:text-neutral-400'}`}>%</button>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {activeExchanges.map((ex, i) => {
                const last = chartData[chartData.length - 1];
                const price = last ? last[ex] as number : 0;
                const median = stats?.prices ? stats.prices.reduce((s, p) => s + p.p, 0) / stats.prices.length : price;
                const devPct = median > 0 ? ((price - median) / median) * 100 : 0;
                return (
                  <span key={ex} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px]"
                    style={{ background: getColor(ex, i) + '15', borderLeft: `3px solid ${getColor(ex, i)}` }}>
                    <span className="text-neutral-300 font-medium">{ex}</span>
                    {price > 0 && (
                      <>
                        <span className="font-mono text-white">{formatPrice(price)}</span>
                        <span className={`font-mono ${devPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {devPct >= 0 ? '+' : ''}{devPct.toFixed(3)}%
                        </span>
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="h-[480px] flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-neutral-700 animate-spin" />
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={480}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 8))}
                />
                <YAxis
                  domain={viewMode === 'deviation' ? ['auto', 'auto'] : ['dataMin', 'dataMax']}
                  tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => viewMode === 'deviation' ? `${v >= 0 ? '+' : ''}${v.toFixed(3)}%` : formatPrice(v)}
                  width={viewMode === 'deviation' ? 70 : 75}
                  padding={{ top: 20, bottom: 20 }}
                />
                <RTooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeDasharray: '4 4' }} />
                {/* Zero reference line in deviation mode */}
                {viewMode === 'deviation' && activeExchanges.length >= 2 && (
                  <Line type="monotone" dataKey={() => 0} stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />
                )}
                {activeExchanges.map((ex, i) => (
                  <Line key={ex} type="monotone"
                    dataKey={viewMode === 'deviation' ? `${ex}_dev` : ex}
                    stroke={getColor(ex, i)}
                    strokeWidth={2.5} dot={false}
                    activeDot={{ r: 5, fill: getColor(ex, i), stroke: '#0b0e1a', strokeWidth: 2 }}
                    connectNulls
                    style={{ filter: `drop-shadow(0 0 4px ${getColor(ex, i)}40)` }} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[480px] flex flex-col items-center justify-center text-neutral-600">
              <ArrowLeftRight className="w-10 h-10 mb-3 text-neutral-700" />
              <p className="text-sm">No price data available for {symbol}</p>
              <p className="text-[10px] text-neutral-700 mt-1">Try a different symbol or check back later</p>
            </div>
          )}
        </div>

        {/* ── Spread History Chart ── */}
        {chartData.length > 0 && activeExchanges.length >= 2 && (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-neutral-300">Spread Over Time</h2>
              <span className="text-[10px] text-neutral-500">Highest minus lowest price across selected exchanges</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 9 }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 6))} />
                <YAxis tick={{ fill: '#4b5563', fontSize: 9 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => formatPrice(v)} width={65} domain={[0, 'auto']} />
                <RTooltip
                  contentStyle={{ background: '#0d0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [formatPrice(v), 'Spread']}
                  labelStyle={{ color: '#9ca3af' }} />
                <Area type="monotone" dataKey="_spread" stroke="#eab308" fill="rgba(234,179,8,0.15)"
                  strokeWidth={1.5} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Spread Stats Cards ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] p-4">
              <p className="text-[10px] text-neutral-500 mb-1">Current Spread</p>
              <p className="text-lg font-bold font-mono text-hub-yellow">{formatPrice(stats.current)}</p>
              <p className="text-[10px] text-neutral-600">{stats.currentPct.toFixed(4)}%</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] p-4">
              <p className="text-[10px] text-neutral-500 mb-1">Avg Spread ({TIMEFRAMES.find(t=>t.key===tf)?.label})</p>
              <p className="text-lg font-bold font-mono text-white">{formatPrice(stats.avg)}</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] p-4">
              <p className="text-[10px] text-neutral-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> Max Spread</p>
              <p className="text-lg font-bold font-mono text-green-400">{formatPrice(stats.max)}</p>
              <p className="text-[10px] text-neutral-600">{stats.maxTime ? new Date(stats.maxTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] p-4">
              <p className="text-[10px] text-neutral-500 mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3 text-cyan-400" /> Min Spread</p>
              <p className="text-lg font-bold font-mono text-cyan-400">{formatPrice(stats.min)}</p>
              <p className="text-[10px] text-neutral-600">{stats.minTime ? new Date(stats.minTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
            </div>
          </div>
        )}

        {/* ── Exchange Price Table ── */}
        {stats && stats.prices.length > 0 && (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-neutral-300">Current Prices by Exchange</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">Exchange</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">vs Median</th>
                  <th className="px-4 py-2 text-right">Spread from Lowest</th>
                </tr>
              </thead>
              <tbody>
                {stats.prices.map((x, i) => {
                  const median = stats.prices.reduce((s, p) => s + p.p, 0) / stats.prices.length;
                  const devPct = ((x.p - median) / median) * 100;
                  const fromLowest = x.p - stats.lowest!.p;
                  return (
                    <tr key={x.ex} className="border-t border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: getColor(x.ex, activeExchanges.indexOf(x.ex)) }} />
                        <span className="font-medium text-white">{x.ex}</span>
                        {i === 0 && <span className="text-[8px] px-1 py-[1px] rounded bg-green-500/10 text-green-400 font-semibold">HIGH</span>}
                        {i === stats.prices.length - 1 && <span className="text-[8px] px-1 py-[1px] rounded bg-red-500/10 text-red-400 font-semibold">LOW</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-white">{formatPrice(x.p)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${devPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {devPct >= 0 ? '+' : ''}{devPct.toFixed(4)}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-neutral-400">
                        {fromLowest > 0 ? `+${formatPrice(fromLowest)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Arb Calculator ── */}
        {showCalc && stats && (
          <div className="rounded-xl bg-white/[0.02] border border-hub-yellow/20 p-4 mb-4">
            <h3 className="text-sm font-semibold text-hub-yellow mb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4" /> Arbitrage Calculator
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-neutral-500 block mb-1">Trade Size (USD)</label>
                <input value={calcSize} onChange={e => setCalcSize(e.target.value)} type="number"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono outline-none focus:border-hub-yellow/30" />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 block mb-1">Fee per side (%)</label>
                <input value={calcFee} onChange={e => setCalcFee(e.target.value)} type="number" step="0.01"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono outline-none focus:border-hub-yellow/30" />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 block mb-1">Estimated Profit</label>
                {(() => {
                  const size = Number(calcSize) || 0;
                  const fee = Number(calcFee) || 0;
                  const grossPct = stats.currentPct;
                  const netPct = grossPct - (fee * 2);
                  const netProfit = size * (netPct / 100);
                  return (
                    <div className={`px-3 py-2 rounded-lg ${netProfit > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                      <span className={`text-lg font-bold font-mono ${netProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {netProfit >= 0 ? '+' : ''}{formatPrice(netProfit)}
                      </span>
                      <span className="text-[10px] text-neutral-500 ml-2">({netPct.toFixed(4)}% net)</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── Info Footer ── */}
        <div className="p-4 rounded-xl bg-hub-yellow/5 border border-hub-yellow/10 border-l-2 border-l-hub-yellow/40">
          <p className="text-neutral-300 text-xs leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
            <span>
              Historical candle data fetched directly from exchange APIs (Binance, Bybit, OKX, Bitget, MEXC, HTX, Hyperliquid, dYdX).
              Each line shows the close price of {symbol}/USDT perpetual futures on that exchange.
              Spread = highest price minus lowest price across selected exchanges. 5-min cache.
            </span>
          </p>
        </div>

      </main>
      <Footer />
    </div>
  );
}
