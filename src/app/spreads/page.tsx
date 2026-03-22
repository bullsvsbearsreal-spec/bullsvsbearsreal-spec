'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ArrowLeftRight, Search, ChevronDown, X, RefreshCw, Calculator, TrendingUp, TrendingDown, Activity, BarChart3, Zap, Info } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCoinIcon, getExchangeIcon } from '@/lib/coinIcons';

// ─── Exchange colors ─────────────────────────────────────────────────────────
const EX_COLORS: Record<string, string> = {
  Binance: '#F0B90B', Bybit: '#FF6B6B', OKX: '#00FF9D', Bitget: '#00D4FF',
  MEXC: '#A855F7', HTX: '#FF61D2', Hyperliquid: '#00FFCC', dYdX: '#6966FF',
};
const PALETTE = ['#F0B90B','#FF6B6B','#00FF9D','#00D4FF','#A855F7','#FF61D2','#00FFCC','#6966FF'];
function ec(ex: string, i: number) { return EX_COLORS[ex] || PALETTE[i % PALETTE.length]; }

type Candle = { t: number; c: number };
type Pt = { time: number; label: string; _spread?: number; [k: string]: any };

const SYMBOLS: Record<string, string[]> = {
  Majors: ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','LINK','TON','LTC','BCH','ETC','TRX'],
  'Layer 2': ['ARB','OP','MATIC','STRK','ZK','IMX','MANTA','STX','SEI'],
  Alts: ['SUI','APT','NEAR','DOT','FIL','ATOM','INJ','HBAR','RENDER','TIA','ALGO','VET','FTM'],
  DeFi: ['AAVE','UNI','MKR','CRV','DYDX','SNX','COMP','LDO','EIGEN','ENA','ONDO','JUP','PYTH'],
  Memes: ['PEPE','WIF','BONK','FLOKI','SHIB','POPCAT','BRETT','MOG','MEW','TRUMP','PENGU','TURBO','NEIRO'],
  Gaming: ['SAND','MANA','AXS','GALA','BLUR','ENS','WLD','W','ZRO'],
};
const EXCHANGES = ['Binance','Bybit','OKX','Bitget','MEXC','HTX','Kraken','Hyperliquid','dYdX','Coinbase','BingX','Phemex','KuCoin','Bitfinex','WhiteBIT','CoinEx','Drift','GMX','Aevo'];
const TFS = [
  { key: '1d', label: '1D', interval: '1h', limit: 24 },
  { key: '7d', label: '7D', interval: '1h', limit: 168 },
  { key: '30d', label: '30D', interval: '4h', limit: 180 },
] as const;
type TfK = typeof TFS[number]['key'];

function fp(v: number) {
  if (v >= 10000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  if (v >= 0.0001) return v.toFixed(6);
  if (v >= 0.0000001) return v.toFixed(10);
  if (v === 0) return '0';
  return v.toExponential(2);
}

export default function SpreadsPage() {
  const [sym, setSym] = useState('BTC');
  const [sel, setSel] = useState<string[]>(['Binance','Bybit','OKX','Bitget','MEXC']);
  const [tf, setTf] = useState<TfK>('1d');
  const [showSym, setShowSym] = useState(false);
  const [symQ, setSymQ] = useState('');
  const [showEx, setShowEx] = useState(false);
  const [kd, setKd] = useState<Record<string, Candle[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [calcAmt, setCalcAmt] = useState('10000');
  const [calcFee, setCalcFee] = useState('0.1');

  useEffect(() => {
    const t = TFS.find(x => x.key === tf)!;
    setLoading(true);
    let c = false;
    fetch(`/api/klines-multi?symbol=${sym}&interval=${t.interval}&limit=${t.limit}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!c) setKd(j?.exchanges && Object.keys(j.exchanges).length > 0 ? j.exchanges : null); })
      .catch(() => { if (!c) setKd(null); })
      .finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [sym, tf]);

  const { data, exs } = useMemo(() => {
    if (!kd) return { data: [] as Pt[], exs: [] as string[] };
    const av = Object.keys(kd);
    const active = sel.filter(e => av.includes(e));
    const exs = active.length >= 1 ? active : av.slice(0, 4);
    const times = new Set<number>();
    const maps: Record<string, Map<number, number>> = {};
    for (const e of exs) {
      const m = new Map<number, number>();
      for (const c of kd[e]) if (c.c > 0) { m.set(c.t, c.c); times.add(c.t); }
      maps[e] = m;
    }
    const sorted = Array.from(times).sort((a, b) => a - b);
    const rows: Pt[] = [];
    const last: Record<string, number> = {};
    for (const t of sorted) {
      const pt: Pt = { time: t, label: '' };
      const prices: number[] = [];
      for (const e of exs) {
        const p = maps[e]?.get(t) ?? last[e];
        if (p) { last[e] = p; pt[e] = p; prices.push(p); }
      }
      if (prices.length < 1) continue;
      const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
      for (const e of exs) if (pt[e]) pt[`${e}_dev`] = ((pt[e] as number) - avg) / avg * 100;
      pt._spread = prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : 0;
      const d = new Date(t);
      pt.label = tf === '30d' ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : tf === '7d' ? `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rows.push(pt);
    }
    return { data: rows, exs };
  }, [kd, sel, tf]);

  const stats = useMemo(() => {
    if (data.length === 0 || exs.length < 2) return null;
    let sum = 0, max = 0, min = Infinity, maxT = 0, minT = 0, cnt = 0;
    for (const pt of data) {
      const s = pt._spread || 0; sum += s; cnt++;
      if (s > max) { max = s; maxT = pt.time; }
      if (s < min) { min = s; minT = pt.time; }
    }
    const last = data[data.length - 1];
    const prices = exs.map(e => ({ e, p: last[e] as number })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
    const cur = prices.length >= 2 ? prices[0].p - prices[prices.length - 1].p : 0;
    const pct = prices.length >= 2 ? (cur / prices[prices.length - 1].p) * 100 : 0;
    return { cur, pct, avg: cnt ? sum / cnt : 0, max, min: min === Infinity ? 0 : min, maxT, minT, prices, hi: prices[0], lo: prices[prices.length - 1] };
  }, [data, exs]);

  const toggle = useCallback((e: string) => setSel(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e].slice(0, 8)), []);

  const yDomain = useMemo(() => {
    if (data.length === 0 || exs.length === 0) return [0, 1];
    const ap: number[] = [];
    for (const pt of data) for (const e of exs) { const p = pt[e] as number; if (typeof p === 'number' && p > 0) ap.push(p); }
    if (ap.length === 0) return [0, 1];
    ap.sort((a, b) => a - b);
    const q1 = ap[Math.floor(ap.length * 0.05)] || ap[0];
    const q3 = ap[Math.floor(ap.length * 0.95)] || ap[ap.length - 1];
    const pad = Math.max((q3 - q1) * 0.3, q1 * 0.001);
    return [q1 - pad, q3 + pad];
  }, [data, exs]);

  const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0]?.payload;
    if (!pt) return null;
    const ps = exs.map(e => ({ e, p: pt[e] as number, d: pt[`${e}_dev`] as number })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
    const sp = ps.length >= 2 ? ps[0].p - ps[ps.length - 1].p : 0;
    return (
      <div className="bg-[#141418] border border-white/[0.08] rounded-lg px-3 py-2.5 shadow-xl text-xs min-w-[200px]">
        <p className="text-neutral-500 text-[10px] mb-2 pb-1.5 border-b border-white/[0.06]">{pt.label}</p>
        {ps.map(x => (
          <div key={x.e} className="flex justify-between gap-4 py-[2px]">
            <span className="flex items-center gap-1.5">
              {getExchangeIcon(x.e) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={getExchangeIcon(x.e)!} alt="" className="w-3.5 h-3.5 rounded-full" onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span className="w-2 h-2 rounded-full" style={{ background: ec(x.e, exs.indexOf(x.e)) }} />
              )}
              <span className="text-neutral-300">{x.e}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-white">{'$'}{fp(x.p)}</span>
              {typeof x.d === 'number' && <span className={`font-mono text-[10px] ${x.d >= 0 ? 'text-green-400' : 'text-red-400'}`}>{x.d >= 0 ? '+' : ''}{x.d.toFixed(3)}%</span>}
            </span>
          </div>
        ))}
        {sp > 0 && (
          <div className="border-t border-white/[0.06] mt-2 pt-1.5 flex justify-between">
            <span className="text-neutral-500">Spread</span>
            <span className="font-mono text-hub-yellow">{'$'}{fp(sp)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-6">

        {/* ── Title ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <ArrowLeftRight className="w-7 h-7 text-hub-yellow" />
              Exchange <span className="text-gradient">Spreads</span>
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Cross-exchange price comparison across <span className="text-neutral-400 font-medium">{EXCHANGES.length} exchanges</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="flex items-center gap-1.5 text-xs text-neutral-600"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading...</span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> {exs.length} exchanges</span>
            )}
            <button onClick={() => setShowCalc(!showCalc)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white transition flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Arb Calculator
            </button>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Symbol */}
          <div className="relative">
            <button onClick={() => setShowSym(!showSym)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-hub-yellow/30 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getCoinIcon(sym)} alt="" className="w-5 h-5 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-lg font-bold">{sym}</span>
              <span className="text-neutral-500 text-sm">/USDT</span>
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            </button>
            {showSym && (
              <div className="absolute top-full mt-1 left-0 z-50 w-56 max-h-80 overflow-y-auto rounded-xl bg-[#141418] border border-white/[0.08] shadow-2xl">
                <div className="p-2 border-b border-white/[0.06] sticky top-0 bg-[#141418]">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04]">
                    <Search className="w-3.5 h-3.5 text-neutral-500" />
                    <input value={symQ} onChange={e => setSymQ(e.target.value)} placeholder="Search coins..." autoFocus
                      className="bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none w-full" />
                  </div>
                </div>
                {Object.entries(SYMBOLS).map(([g, ss]) => {
                  const f = ss.filter(s => !symQ || s.toUpperCase().includes(symQ.toUpperCase()));
                  if (!f.length) return null;
                  return (<div key={g}>
                    <p className="px-3 py-1 text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">{g}</p>
                    {f.map(s => (
                      <button key={s} onClick={() => { setSym(s); setShowSym(false); setSymQ(''); }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/[0.04] flex items-center gap-2 ${s === sym ? 'text-hub-yellow' : 'text-neutral-300'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getCoinIcon(s)} alt="" className="w-4 h-4 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        {s}
                        {s === sym && <span className="ml-auto text-hub-yellow text-xs">✓</span>}
                      </button>
                    ))}
                  </div>);
                })}
              </div>
            )}
          </div>

          {/* Timeframe */}
          <div className="flex items-center gap-[2px] p-[3px] rounded-lg bg-white/[0.03] border border-white/[0.06]">
            {TFS.map(t => (
              <button key={t.key} onClick={() => setTf(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tf === t.key ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-500 hover:text-neutral-300'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Exchanges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {sel.map((e, i) => {
              const icon = getExchangeIcon(e);
              return (
              <span key={e} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] border border-white/[0.06]">
                {icon ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={icon} alt="" className="w-4 h-4 rounded-full" onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span className="w-3 h-3 rounded-full" style={{ background: ec(e, i) }} />
                )}
                {e}
                <button onClick={() => toggle(e)} className="text-neutral-600 hover:text-white ml-0.5"><X className="w-3 h-3" /></button>
              </span>
              );
            })}
            <div className="relative">
              <button onClick={() => setShowEx(!showEx)} className="px-2.5 py-1 rounded-full text-[11px] text-neutral-500 bg-white/[0.03] border border-white/[0.06] hover:border-hub-yellow/30 transition">
                + Exchange
              </button>
              {showEx && (
                <div className="absolute top-full mt-1 left-0 z-50 w-44 rounded-xl bg-[#141418] border border-white/[0.08] shadow-2xl py-1">
                  {EXCHANGES.map((e, i) => (
                    <button key={e} onClick={() => { toggle(e); setShowEx(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.04] flex items-center justify-between ${sel.includes(e) ? 'text-hub-yellow' : 'text-neutral-400'}`}>
                      <span className="flex items-center gap-2">
                        {getExchangeIcon(e) ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={getExchangeIcon(e)!} alt="" className="w-4 h-4 rounded-full" onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="w-3 h-3 rounded-full" style={{ background: ec(e, i) }} />
                        )}
                        {e}
                      </span>
                      {sel.includes(e) && <span className="text-hub-yellow text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-hub-yellow" />
                <span className="text-xs text-neutral-500">Current Spread</span>
              </div>
              <p className="text-2xl font-bold font-mono text-hub-yellow">{'$'}{fp(stats.cur)}</p>
              <p className="text-[11px] text-neutral-500 mt-1">{stats.pct.toFixed(3)}% · {(stats.pct * 100).toFixed(1)} bps</p>
            </div>
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-neutral-500" />
                <span className="text-xs text-neutral-500">Avg Spread ({TFS.find(t=>t.key===tf)?.label})</span>
              </div>
              <p className="text-2xl font-bold font-mono text-white">{'$'}{fp(stats.avg)}</p>
              <p className="text-[11px] text-neutral-500 mt-1">
                Range: {'$'}{fp(stats.min)} — {'$'}{fp(stats.max)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-neutral-500">Highest Price</span>
              </div>
              <p className="text-2xl font-bold font-mono text-white">${stats.hi ? fp(stats.hi.p) : '—'}</p>
              <p className="text-[11px] text-green-400 mt-1">{stats.hi?.e}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-neutral-500">Lowest Price</span>
              </div>
              <p className="text-2xl font-bold font-mono text-white">${stats.lo ? fp(stats.lo.p) : '—'}</p>
              <p className="text-[11px] text-red-400 mt-1">{stats.lo?.e}</p>
            </div>
          </div>
        )}

        {/* ── Bloomberg Ticker Strip ── */}
        {stats && (
          <div className="rounded-xl bg-[#0c0e14] border border-white/[0.06] px-4 py-2 mb-5 flex items-center gap-5 overflow-x-auto scrollbar-none">
            {stats.prices.map((x, i) => (
              <div key={x.e} className="flex items-center gap-2 flex-shrink-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ec(x.e, exs.indexOf(x.e)) }} />
                <span className="text-[11px] text-neutral-500">{x.e}</span>
                <span className="font-mono text-[12px] text-white font-medium">{'$'}{fp(x.p)}</span>
                {(() => {
                  const median = stats.prices.reduce((s, p) => s + p.p, 0) / stats.prices.length;
                  const dev = ((x.p - median) / median) * 100;
                  return (
                    <span className={`font-mono text-[10px] ${dev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {dev >= 0 ? '▲' : '▼'}{Math.abs(dev).toFixed(3)}%
                    </span>
                  );
                })()}
                {i < stats.prices.length - 1 && <span className="text-neutral-800 mx-1">│</span>}
              </div>
            ))}
            <div className="flex-shrink-0 ml-auto pl-4 border-l border-white/[0.06]">
              <span className="text-[10px] text-neutral-600">SPREAD </span>
              <span className="font-mono text-[12px] text-hub-yellow font-bold">{'$'}{fp(stats.cur)}</span>
            </div>
          </div>
        )}

        {/* ── Price Chart ── */}
        <div className="rounded-2xl bg-[#0c0e14] border border-white/[0.06] p-4 sm:p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getCoinIcon(sym)} alt="" className="w-6 h-6 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <h2 className="text-sm font-semibold">{sym}/USDT Price by Exchange</h2>
                <p className="text-[11px] text-neutral-500">Close prices across {exs.length} venues · {TFS.find(t=>t.key===tf)?.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {exs.map((e, i) => (
                <span key={e} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2.5 h-[3px] rounded-full" style={{ background: ec(e, i) }} />
                  <span className="text-neutral-400">{e}</span>
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-[420px] flex items-center justify-center"><RefreshCw className="w-5 h-5 text-neutral-700 animate-spin" /></div>
          ) : data.length > 0 ? (
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(data.length / 7))} />
                <YAxis domain={yDomain} tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => '$' + fp(v)} width={72} allowDataOverflow />
                <RTooltip content={<Tip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeDasharray: '4 4' }} />
                {exs.map((e, i) => (
                  <Line key={e} type="monotone" dataKey={e} stroke={ec(e, i)} strokeWidth={2.5} dot={false}
                    activeDot={{ r: 4, fill: ec(e, i), stroke: '#0f0f14', strokeWidth: 2 }} connectNulls
                    style={{ filter: `drop-shadow(0 0 6px ${ec(e, i)}40)` }} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[420px] flex flex-col items-center justify-center text-neutral-600">
              <Activity className="w-8 h-8 mb-2 text-neutral-700" />
              <p className="text-sm">No price data for {sym}</p>
              <p className="text-[10px] text-neutral-700 mt-1">Try a different symbol or timeframe</p>
            </div>
          )}
        </div>

        {/* ── Spread History ── */}
        {data.length > 0 && exs.length >= 2 && (
          <div className="rounded-2xl bg-[#0c0e14] border border-white/[0.06] p-4 sm:p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold">Spread Over Time</h2>
                <p className="text-[11px] text-neutral-500">Highest minus lowest price across selected exchanges</p>
              </div>
              {stats && <span className="text-[11px] text-neutral-500">Avg: <span className="text-hub-yellow font-mono">{'$'}{fp(stats.avg)}</span></span>}
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 9, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(data.length / 6))} />
                <YAxis tick={{ fill: '#4b5563', fontSize: 9, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => '$' + fp(v)} width={55} domain={[0, 'auto']} />
                <RTooltip contentStyle={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => ['$' + fp(v), 'Spread']} labelStyle={{ color: '#6b7280' }} />
                {stats && <ReferenceLine y={stats.avg} stroke="#F59E0B" strokeDasharray="3 3" strokeWidth={1}
                  label={{ value: 'avg', position: 'right', fill: '#F59E0B', fontSize: 9 }} />}
                <Area type="monotone" dataKey="_spread" stroke="#F59E0B" fill="rgba(245,158,11,0.1)" strokeWidth={1.5} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Exchange Table + Arb Calc side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Exchange Table */}
          {stats && stats.prices.length > 0 && (
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold">Price by Exchange</h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">Sorted by price, highest first</p>
              </div>
              {stats.prices.map((x, i) => {
                const median = stats.prices.reduce((s, p) => s + p.p, 0) / stats.prices.length;
                const dev = ((x.p - median) / median) * 100;
                return (
                  <div key={x.e} className={`px-4 sm:px-5 py-3 flex items-center justify-between border-b border-white/[0.03] ${i === 0 ? 'bg-green-500/[0.02]' : i === stats.prices.length - 1 ? 'bg-red-500/[0.02]' : ''}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: ec(x.e, exs.indexOf(x.e)) }} />
                      <span className="text-sm font-medium">{x.e}</span>
                      {i === 0 && <span className="text-[8px] px-1.5 py-[1px] rounded bg-green-500/10 text-green-400 font-semibold">highest</span>}
                      {i === stats.prices.length - 1 && <span className="text-[8px] px-1.5 py-[1px] rounded bg-red-500/10 text-red-400 font-semibold">lowest</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${dev >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                          style={{ width: `${Math.min(100, Math.abs(dev) * 400)}%` }} />
                      </div>
                      <span className="font-mono text-sm text-white">{'$'}{fp(x.p)}</span>
                      <span className={`font-mono text-[11px] w-16 text-right ${dev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {dev >= 0 ? '+' : ''}{dev.toFixed(3)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Arb Calculator */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 sm:p-5">
            <h3 className="text-sm font-semibold mb-1">Arb Calculator</h3>
            <p className="text-[11px] text-neutral-500 mb-4">Estimate net profit from cross-exchange arbitrage</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">Trade size ($)</label>
                <input value={calcAmt} onChange={e => setCalcAmt(e.target.value)} type="number"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono outline-none focus:border-hub-yellow/30" />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">Fee per side (%)</label>
                <input value={calcFee} onChange={e => setCalcFee(e.target.value)} type="number" step="0.01"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono outline-none focus:border-hub-yellow/30" />
              </div>
              {stats && (() => {
                const size = Number(calcAmt) || 0;
                const fee = Number(calcFee) || 0;
                const net = stats.pct - fee * 2;
                const profit = size * (net / 100);
                return (
                  <div className={`p-4 rounded-xl ${profit > 0 ? 'bg-green-500/[0.05] border border-green-500/10' : 'bg-red-500/[0.05] border border-red-500/10'}`}>
                    <p className="text-[11px] text-neutral-500 mb-1">Estimated net profit</p>
                    <p className={`text-2xl font-bold font-mono ${profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profit >= 0 ? '+' : ''}{'$'}{fp(Math.abs(profit))}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Gross {stats.pct.toFixed(3)}% − fees {(fee * 2).toFixed(2)}% = net {net.toFixed(3)}%
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── Info Footer ── */}
        <div className="p-4 rounded-2xl bg-hub-yellow/5 border border-hub-yellow/10 border-l-2 border-l-hub-yellow/40">
          <p className="text-neutral-300 text-xs leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
            <span>
              Historical candle data from {exs.join(', ')} perpetual futures.
              Each line shows the close price on that exchange. Spread = highest minus lowest price.
              Data refreshes with 5-min cache.
            </span>
          </p>
        </div>

      </main>
      <Footer />
    </div>
  );
}
