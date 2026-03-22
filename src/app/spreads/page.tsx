'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Search, ChevronDown, X, RefreshCw, Calculator, TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCoinIcon } from '@/lib/coinIcons';

// ─── Bloomberg-style neon colors ─────────────────────────────────────────────
const EX_COLORS: Record<string, string> = {
  Binance: '#F0B90B', Bybit: '#FF6B6B', OKX: '#00FF9D', Bitget: '#00D4FF',
  MEXC: '#A855F7', HTX: '#FF61D2', Hyperliquid: '#00FFCC', dYdX: '#6966FF',
};
const PALETTE = ['#F0B90B','#FF6B6B','#00FF9D','#00D4FF','#A855F7','#FF61D2','#00FFCC','#6966FF'];
function cx(ex: string, i: number) { return EX_COLORS[ex] || PALETTE[i % PALETTE.length]; }

// ─── Data ────────────────────────────────────────────────────────────────────
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
const ALL_SYM = Object.values(SYMBOLS).flat();
const EXCHANGES = ['Binance','Bybit','OKX','Bitget','MEXC','HTX','Hyperliquid','dYdX'];
const TFS = [
  { key: '1d', label: '1D', interval: '1h', limit: 24 },
  { key: '7d', label: '7D', interval: '1h', limit: 168 },
  { key: '30d', label: '30D', interval: '4h', limit: 180 },
] as const;
type TfK = typeof TFS[number]['key'];

function fp(v: number) {
  if (v >= 10000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  return v.toPrecision(4);
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function SpreadsTerminal() {
  const [sym, setSym] = useState('BTC');
  const [sel, setSel] = useState<string[]>(['Binance','Bybit','OKX','Hyperliquid']);
  const [tf, setTf] = useState<TfK>('1d');
  const [showSym, setShowSym] = useState(false);
  const [symQ, setSymQ] = useState('');
  const [showEx, setShowEx] = useState(false);
  const [kd, setKd] = useState<Record<string, Candle[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [calcAmt, setCalcAmt] = useState('10000');
  const [calcFee, setCalcFee] = useState('0.1');
  const [now] = useState(Date.now);

  // Fetch
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

  // Chart data
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
        if (p) { last[e] = p; pt[e] = p; pt[`${e}_dev`] = 0; prices.push(p); }
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

  // Stats
  const stats = useMemo(() => {
    if (data.length === 0 || exs.length < 2) return null;
    let sum = 0, max = 0, min = Infinity, maxT = 0, minT = 0, cnt = 0;
    for (const pt of data) {
      const s = pt._spread || 0;
      sum += s; cnt++;
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

  // Tooltip
  const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0]?.payload;
    if (!pt) return null;
    const ps = exs.map(e => ({ e, p: pt[e] as number, d: pt[`${e}_dev`] as number })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
    const sp = ps.length >= 2 ? ps[0].p - ps[ps.length - 1].p : 0;
    return (
      <div className="bg-[#0a0a12] border border-[#1a1f2e] rounded px-2.5 py-2 font-mono text-[10px] shadow-xl min-w-[180px]">
        <div className="text-neutral-500 mb-1.5 border-b border-[#1a1f2e] pb-1">{pt.label}</div>
        {ps.map(x => (
          <div key={x.e} className="flex justify-between gap-3 py-[1px]">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm" style={{ background: cx(x.e, exs.indexOf(x.e)) }} /><span className="text-neutral-400">{x.e}</span></span>
            <span><span className="text-white">{fp(x.p)}</span> <span className={x.d >= 0 ? 'text-green-400' : 'text-red-400'}>{x.d >= 0 ? '+' : ''}{x.d.toFixed(3)}%</span></span>
          </div>
        ))}
        {sp > 0 && <div className="border-t border-[#1a1f2e] mt-1 pt-1 flex justify-between"><span className="text-neutral-600">SPREAD</span><span className="text-amber-400">${fp(sp)}</span></div>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080a10] text-white flex flex-col">
      <Header />
      <main className="flex-1 w-full">

        {/* ── Terminal Header Bar ── */}
        <div className="border-b border-[#1a1f2e] bg-[#0c0e16]">
          <div className="max-w-[1600px] mx-auto px-3 py-2 flex items-center gap-2 flex-wrap">
            {/* Symbol */}
            <div className="relative">
              <button onClick={() => setShowSym(!showSym)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#12141e] border border-[#1a1f2e] rounded hover:border-amber-500/30 transition">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getCoinIcon(sym)} alt="" className="w-4 h-4 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span className="font-mono font-bold text-sm">{sym}</span>
                <span className="text-neutral-600 text-[10px]">/USDT</span>
                <ChevronDown className="w-3 h-3 text-neutral-600" />
              </button>
              {showSym && (
                <div className="absolute top-full mt-1 left-0 z-50 w-52 max-h-[400px] overflow-y-auto bg-[#0c0e16] border border-[#1a1f2e] rounded shadow-2xl">
                  <div className="p-1.5 border-b border-[#1a1f2e] sticky top-0 bg-[#0c0e16]">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#12141e] rounded">
                      <Search className="w-3 h-3 text-neutral-600" />
                      <input value={symQ} onChange={e => setSymQ(e.target.value)} placeholder="Search..." autoFocus className="bg-transparent text-xs text-white placeholder:text-neutral-700 outline-none w-full font-mono" />
                    </div>
                  </div>
                  {Object.entries(SYMBOLS).map(([g, ss]) => {
                    const f = ss.filter(s => !symQ || s.includes(symQ.toUpperCase()));
                    if (!f.length) return null;
                    return (<div key={g}>
                      <div className="px-2.5 py-1 text-[8px] text-neutral-600 uppercase tracking-widest font-bold bg-[#0a0c14]">{g}</div>
                      {f.map(s => (
                        <button key={s} onClick={() => { setSym(s); setShowSym(false); setSymQ(''); }}
                          className={`w-full text-left px-2.5 py-1 text-xs hover:bg-[#12141e] flex items-center gap-1.5 font-mono ${s === sym ? 'text-amber-400' : 'text-neutral-400'}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getCoinIcon(s)} alt="" className="w-3.5 h-3.5 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          {s}
                        </button>
                      ))}
                    </div>);
                  })}
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-[#1a1f2e]" />

            {/* Timeframe */}
            {TFS.map(t => (
              <button key={t.key} onClick={() => setTf(t.key)}
                className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition ${tf === t.key ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'text-neutral-600 hover:text-neutral-400 border border-transparent'}`}>
                {t.label}
              </button>
            ))}

            <div className="h-4 w-px bg-[#1a1f2e]" />

            {/* Exchanges */}
            {sel.map((e, i) => (
              <span key={e} className="flex items-center gap-1 px-1.5 py-0.5 bg-[#12141e] border border-[#1a1f2e] rounded text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-sm" style={{ background: cx(e, i) }} />
                <span className="text-neutral-400">{e}</span>
                <button onClick={() => toggle(e)} className="text-neutral-700 hover:text-red-400 ml-0.5"><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
            <div className="relative">
              <button onClick={() => setShowEx(!showEx)} className="px-1.5 py-0.5 text-[10px] text-neutral-500 border border-[#1a1f2e] rounded hover:border-amber-500/30">+ Add</button>
              {showEx && (
                <div className="absolute top-full mt-1 left-0 z-50 w-36 bg-[#0c0e16] border border-[#1a1f2e] rounded shadow-2xl py-0.5">
                  {EXCHANGES.map((e, i) => (
                    <button key={e} onClick={() => { toggle(e); setShowEx(false); }}
                      className={`w-full text-left px-2.5 py-1 text-[10px] font-mono hover:bg-[#12141e] flex items-center gap-1.5 ${sel.includes(e) ? 'text-amber-400' : 'text-neutral-500'}`}>
                      <span className="w-1.5 h-1.5 rounded-sm" style={{ background: cx(e, i) }} />{e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowCalc(!showCalc)} className="px-2 py-1 text-[10px] text-neutral-500 border border-[#1a1f2e] rounded hover:text-amber-400 hover:border-amber-500/20 transition">
                <Calculator className="w-3 h-3 inline mr-1" />Arb Calc
              </button>
              {loading && <RefreshCw className="w-3 h-3 text-neutral-700 animate-spin" />}
              <span className="text-[9px] text-neutral-600">{exs.length} exchanges</span>
              <span className="text-[9px] text-neutral-700 font-mono hidden sm:inline">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">

          {/* Left: Chart Area */}
          <div className="border-r border-[#1a1f2e]">

            {/* Spread Ticker */}
            {stats && (
              <div className="border-b border-[#1a1f2e] px-3 py-2 flex items-center gap-4 flex-wrap bg-[#0c0e16]">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getCoinIcon(sym)} alt="" className="w-5 h-5 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="font-mono font-bold text-lg">{sym}</span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 block">Spread</span>
                  <span className={`font-mono text-xl font-bold ${stats.cur > stats.avg ? 'text-green-400' : 'text-amber-400'}`}>${fp(stats.cur)}</span>
                  <span className="text-neutral-500 text-xs ml-1.5">{stats.pct.toFixed(3)}%</span>
                  <span className={`text-[10px] ml-1 px-1 py-[1px] rounded ${stats.pct * 100 > 10 ? 'bg-green-500/10 text-green-400' : stats.pct * 100 > 5 ? 'bg-amber-500/10 text-amber-400' : 'bg-white/[0.03] text-neutral-500'}`}>{(stats.pct * 100).toFixed(1)} bps</span>
                </div>
                <div className="h-6 w-px bg-[#1a1f2e]" />
                <div>
                  <span className="text-[9px] text-neutral-500 block">Highest</span>
                  <span className="font-mono text-sm text-green-400">${stats.hi ? fp(stats.hi.p) : '—'}</span>
                  <span className="text-[9px] text-neutral-600 ml-1">{stats.hi?.e}</span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 block">Lowest</span>
                  <span className="font-mono text-sm text-red-400">${stats.lo ? fp(stats.lo.p) : '—'}</span>
                  <span className="text-[9px] text-neutral-600 ml-1">{stats.lo?.e}</span>
                </div>
                <div className="h-6 w-px bg-[#1a1f2e]" />
                <div>
                  <span className="text-[9px] text-neutral-500 block">{TFS.find(t=>t.key===tf)?.label} Range</span>
                  <span className="font-mono text-sm text-white">${fp(stats.min)} <span className="text-neutral-600">to</span> ${fp(stats.max)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 block">Average</span>
                  <span className="font-mono text-sm text-neutral-300">${fp(stats.avg)}</span>
                </div>
              </div>
            )}

            {/* Price Chart */}
            <div className="p-2">
              {loading ? (
                <div className="h-[400px] flex items-center justify-center"><RefreshCw className="w-5 h-5 text-neutral-800 animate-spin" /></div>
              ) : data.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1a1f2e" strokeDasharray="1 4" />
                    <XAxis dataKey="label" tick={{ fill: '#374151', fontSize: 9, fontFamily: 'monospace' }} axisLine={{ stroke: '#1a1f2e' }} tickLine={false}
                      interval={Math.max(0, Math.floor(data.length / 6))} />
                    <YAxis domain={['dataMin', 'dataMax']} tick={{ fill: '#374151', fontSize: 9, fontFamily: 'monospace' }} axisLine={{ stroke: '#1a1f2e' }} tickLine={false}
                      tickFormatter={(v: number) => '$' + fp(v)} width={70} padding={{ top: 15, bottom: 15 }} />
                    <RTooltip content={<Tip />} cursor={{ stroke: '#374151', strokeDasharray: '2 2' }} />
                    {exs.map((e, i) => (
                      <Line key={e} type="monotone" dataKey={e} stroke={cx(e, i)} strokeWidth={2.5} dot={false}
                        activeDot={{ r: 4, fill: cx(e, i), stroke: '#080a10', strokeWidth: 2 }} connectNulls
                        style={{ filter: `drop-shadow(0 0 6px ${cx(e, i)}50)` }} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[400px] flex flex-col items-center justify-center text-neutral-700 text-xs">
                  <Activity className="w-8 h-8 mb-2 text-neutral-800" />
                  <p>No price data for {sym}</p>
                  <p className="text-[10px] text-neutral-800 mt-1">Try a different symbol or timeframe</p>
                </div>
              )}
            </div>

            {/* Spread Chart */}
            {data.length > 0 && exs.length >= 2 && (
              <div className="border-t border-[#1a1f2e] p-2">
                <div className="flex items-center gap-2 px-1 mb-1">
                  <span className="text-[10px] text-neutral-500">Spread History</span>
                  <span className="text-[9px] text-neutral-700">highest − lowest price over time</span>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#1a1f2e" strokeDasharray="1 4" />
                    <XAxis dataKey="label" tick={{ fill: '#374151', fontSize: 8, fontFamily: 'monospace' }} axisLine={{ stroke: '#1a1f2e' }} tickLine={false}
                      interval={Math.max(0, Math.floor(data.length / 6))} />
                    <YAxis tick={{ fill: '#374151', fontSize: 8, fontFamily: 'monospace' }} axisLine={{ stroke: '#1a1f2e' }} tickLine={false}
                      tickFormatter={(v: number) => '$' + fp(v)} width={55} domain={[0, 'auto']} />
                    <RTooltip contentStyle={{ background: '#0a0a12', border: '1px solid #1a1f2e', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}
                      formatter={(v: number) => ['$' + fp(v), 'Spread']} labelStyle={{ color: '#6b7280' }} />
                    {stats && <ReferenceLine y={stats.avg} stroke="#F59E0B" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'AVG', position: 'right', fill: '#F59E0B', fontSize: 8, fontFamily: 'monospace' }} />}
                    {stats && stats.max > 0 && <ReferenceLine y={stats.max} stroke="#22c55e" strokeDasharray="2 4" strokeWidth={0.5} />}
                    {stats && stats.min > 0 && <ReferenceLine y={stats.min} stroke="#06b6d4" strokeDasharray="2 4" strokeWidth={0.5} />}
                    <Area type="monotone" dataKey="_spread" stroke="#F59E0B" fill="rgba(245,158,11,0.08)" strokeWidth={1.5} dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Right Sidebar: Terminal Panels */}
          <div className="bg-[#0c0e16] flex flex-col">

            {/* Exchange Prices Panel */}
            <div className="border-b border-[#1a1f2e]">
              <div className="px-3 py-1.5 bg-[#0a0c14] border-b border-[#1a1f2e]">
                <span className="text-[10px] text-amber-400 font-semibold">Exchange Prices</span>
              </div>
              {stats?.prices.map((x, i) => {
                const median = stats.prices.reduce((s, p) => s + p.p, 0) / stats.prices.length;
                const dev = ((x.p - median) / median) * 100;
                const fromLo = x.p - stats.lo!.p;
                return (
                  <div key={x.e} className={`px-3 py-1.5 flex items-center justify-between border-b border-[#0f1118] ${i === 0 ? 'bg-green-500/[0.03]' : i === stats.prices.length - 1 ? 'bg-red-500/[0.03]' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-sm" style={{ background: cx(x.e, exs.indexOf(x.e)) }} />
                      <span className="text-[10px] font-mono text-neutral-400">{x.e}</span>
                      {i === 0 && <span className="text-[7px] px-1 py-[0.5px] bg-green-500/10 text-green-400 rounded font-medium">high</span>}
                      {i === stats.prices.length - 1 && <span className="text-[7px] px-1 py-[0.5px] bg-red-500/10 text-red-400 rounded font-medium">low</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Deviation bar */}
                      <div className="w-12 h-1.5 bg-[#12141e] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${dev >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(100, Math.abs(dev) * 500)}%`, marginLeft: dev < 0 ? 'auto' : 0 }} />
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[11px] text-white">${fp(x.p)}</span>
                        <span className={`font-mono text-[9px] ml-1 ${dev >= 0 ? 'text-green-400' : 'text-red-400'}`}>{dev >= 0 ? '+' : ''}{dev.toFixed(3)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Spread Stats Panel */}
            {stats && (
              <div className="border-b border-[#1a1f2e]">
                <div className="px-3 py-1.5 bg-[#0a0c14] border-b border-[#1a1f2e]">
                  <span className="text-[10px] text-amber-400 font-semibold">Spread Analytics</span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-[#1a1f2e]">
                  {[
                    { label: 'Current', value: '$' + fp(stats.cur), color: 'text-amber-400' },
                    { label: `Avg (${TFS.find(t=>t.key===tf)?.label})`, value: '$' + fp(stats.avg), color: 'text-white' },
                    { label: 'Max', value: '$' + fp(stats.max), color: 'text-green-400', sub: stats.maxT ? new Date(stats.maxT).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '' },
                    { label: 'Min', value: '$' + fp(stats.min), color: 'text-cyan-400', sub: stats.minT ? new Date(stats.minT).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#0c0e16] px-3 py-2.5">
                      <span className="text-[9px] text-neutral-500 block mb-0.5">{s.label}</span>
                      <span className={`font-mono text-sm font-bold ${s.color}`}>{s.value}</span>
                      {s.sub && <span className="text-[8px] text-neutral-600 block mt-0.5">{s.sub}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Arb Calculator */}
            {showCalc && stats && (
              <div className="border-b border-[#1a1f2e]">
                <div className="px-3 py-1.5 bg-[#0a0c14] border-b border-[#1a1f2e]">
                  <span className="text-[10px] text-amber-400 font-semibold">Arb Calculator</span>
                </div>
                <div className="px-3 py-2 space-y-2">
                  <div>
                    <label className="text-[9px] text-neutral-500">Trade size ($)</label>
                    <input value={calcAmt} onChange={e => setCalcAmt(e.target.value)} type="number"
                      className="w-full px-2 py-1 bg-[#12141e] border border-[#1a1f2e] rounded text-xs font-mono text-white outline-none focus:border-amber-500/30" />
                  </div>
                  <div>
                    <label className="text-[9px] text-neutral-500">Fee per side (%)</label>
                    <input value={calcFee} onChange={e => setCalcFee(e.target.value)} type="number" step="0.01"
                      className="w-full px-2 py-1 bg-[#12141e] border border-[#1a1f2e] rounded text-xs font-mono text-white outline-none focus:border-amber-500/30" />
                  </div>
                  {(() => {
                    const size = Number(calcAmt) || 0;
                    const fee = Number(calcFee) || 0;
                    const net = stats.pct - fee * 2;
                    const profit = size * (net / 100);
                    return (
                      <div className={`px-2 py-1.5 rounded ${profit > 0 ? 'bg-green-500/5 border border-green-500/10' : 'bg-red-500/5 border border-red-500/10'}`}>
                        <span className="text-[9px] text-neutral-500 block">Net profit</span>
                        <span className={`font-mono text-lg font-bold ${profit > 0 ? 'text-green-400' : 'text-red-400'}`}>{profit >= 0 ? '+' : ''}${fp(Math.abs(profit))}</span>
                        <span className="text-[9px] font-mono text-neutral-600 ml-2">({net.toFixed(4)}%)</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="px-3 py-2 border-b border-[#1a1f2e]">
              <div className="px-0 py-1 bg-[#0a0c14] rounded">
                <span className="text-[9px] text-neutral-600 block px-2 mb-1">Legend</span>
                {exs.map((e, i) => {
                  const last = data[data.length - 1];
                  const p = last ? last[e] as number : 0;
                  return (
                    <div key={e} className="flex items-center justify-between px-2 py-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-[2px]" style={{ background: cx(e, i) }} />
                        <span className="text-[9px] font-mono text-neutral-500">{e}</span>
                      </span>
                      <span className="text-[9px] font-mono text-neutral-400">{p > 0 ? '$' + fp(p) : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Data Source */}
            <div className="px-3 py-2 mt-auto">
              <p className="text-[8px] text-neutral-700 leading-relaxed">
                Candle close prices from {exs.join(', ')}. {TFS.find(t=>t.key===tf)?.label} timeframe, 5 min cache. Perpetual futures.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
