'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ArrowLeftRight, Search, ChevronDown, X, RefreshCw, Calculator, TrendingUp, TrendingDown, Activity, BarChart3, Zap, Info } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCoinIcon } from '@/lib/coinIcons';
import { ExchangeLogo } from '@/components/ExchangeLogos';

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
  Commodities: ['XAU','XAG','XAUT'],
  Forex: ['EUR','GBP','JPY'],
  Stocks: ['AAPL','TSLA','NVDA','COIN','MSTR','META','AMZN','GOOGL','MSFT'],
};
const CEX_EXCHANGES = ['Binance','Bybit','OKX','Bitget','MEXC','Kraken','BingX','HTX','Phemex','KuCoin','Bitfinex','WhiteBIT','Coinbase','CoinEx','Bitunix','Deribit'];
const DEX_EXCHANGES = ['Hyperliquid','dYdX','Aster','Lighter','Aevo','Drift','GMX','gTrade','Extended','Variational','edgeX','Nado','Backpack','Orderly','Paradex'];
const EXCHANGES = [...CEX_EXCHANGES, ...DEX_EXCHANGES];
// Exchanges with direct kline API (fast, 1h candles)
// All other exchanges use DB mark_price snapshots (10-min, needs accumulation)
const KLINE_DIRECT = new Set([
  'Binance','Bybit','OKX','Bitget','MEXC','HTX','Kraken','BingX',
  'Phemex','KuCoin','Bitfinex','CoinEx','Deribit','Coinbase','WhiteBIT',
  'Hyperliquid','dYdX','Aevo',
]);
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
  if (v === 0) return '0';
  // For very small numbers, use significant digits instead of fixed decimals
  return Number(v.toPrecision(4)).toString();
}

function SpreadTooltip({ active, payload, exList, colorFn }: any) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;
  const exchanges: string[] = exList || [];
  const ps = exchanges
    .map((e: string) => ({ e, p: pt[e] as number, d: pt[e + '_dev'] as number }))
    .filter((x: any) => x.p > 0)
    .sort((a: any, b: any) => b.p - a.p);
  const sp = ps.length >= 2 ? ps[0].p - ps[ps.length - 1].p : 0;
  return (
    <div className="bg-[#141418] border border-white/[0.08] rounded-lg px-3 py-2.5 shadow-xl text-xs min-w-[200px]">
      <p className="text-neutral-500 text-[10px] mb-2 pb-1.5 border-b border-white/[0.06]">{pt.label}</p>
      {ps.map((x: any) => (
        <div key={x.e} className="flex justify-between gap-4 py-[2px]">
          <span className="flex items-center gap-1.5">
            <ExchangeLogo exchange={x.e} size={14} />
            <span className="text-neutral-300">{x.e}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-white">{'$'}{fp(x.p)}</span>
            {typeof x.d === 'number' && (
              <span className={'font-mono text-[10px] ' + (x.d >= 0 ? 'text-green-400' : 'text-red-400')}>
                {x.d >= 0 ? '+' : ''}{x.d.toFixed(3)}%
              </span>
            )}
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
}

export default function SpreadsPage() {
  // Read initial state from URL params
  const initFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return { sym: 'BTC', sel: ['Binance','Bybit','OKX','Bitget','MEXC'], tf: '1d' as TfK };
    const p = new URLSearchParams(window.location.search);
    return {
      sym: p.get('s') || 'BTC',
      sel: p.get('ex')?.split(',').filter(Boolean) || ['Binance','Bybit','OKX','Bitget','MEXC'],
      tf: (p.get('tf') || '1d') as TfK,
    };
  }, []);
  const init = initFromUrl();
  const [sym, setSym] = useState(init.sym);
  const [sel, setSel] = useState<string[]>(init.sel);
  const [tf, setTf] = useState<TfK>(init.tf);

  // Sync state to URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (sym !== 'BTC') p.set('s', sym);
    if (sel.join(',') !== 'Binance,Bybit,OKX,Bitget,MEXC') p.set('ex', sel.join(','));
    if (tf !== '1d') p.set('tf', tf);
    const qs = p.toString();
    const url = qs ? window.location.pathname + '?' + qs : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [sym, sel, tf]);
  const [showSym, setShowSym] = useState(false);
  const [symQ, setSymQ] = useState('');
  const [showEx, setShowEx] = useState(false);
  const [kd, setKd] = useState<Record<string, Candle[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [calcAmt, setCalcAmt] = useState('10000');
  const [calcFee, setCalcFee] = useState('0.1');

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (showSym && !t.closest('[data-sym-picker]')) setShowSym(false);
      if (showEx && !t.closest('[data-ex-picker]')) setShowEx(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSym, showEx]);

  // Live data from existing APIs
  type TickerEntry = { symbol: string; exchange: string; lastPrice: number; change24h: number; quoteVolume24h: number };
  type FundingEntry = { symbol: string; exchange: string; fundingRate: number; markPrice: number };
  type OIEntry = { symbol: string; exchange: string; openInterestValue: number };
  const [tickers, setTickers] = useState<TickerEntry[]>([]);
  const [funding, setFunding] = useState<FundingEntry[]>([]);
  const [oi, setOI] = useState<OIEntry[]>([]);

  // Fetch klines (exchange APIs) + DB mark_price fallback for non-kline exchanges
  useEffect(() => {
    const t = TFS.find(x => x.key === tf)!;
    const days = tf === '1d' ? 1 : tf === '7d' ? 7 : 30;
    setLoading(true);
    let c = false;
    Promise.allSettled([
      // Source 1: Exchange kline APIs (Binance, Bybit, OKX, etc.)
      fetch('/api/klines-multi?symbol=' + sym + '&interval=' + t.interval + '&limit=' + t.limit).then(r => r.ok ? r.json() : null),
      // Source 2: DB mark_price snapshots (all exchanges including DEX)
      fetch('/api/history/price-multi?symbol=' + sym + '&days=' + days, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([kRes, dbRes]) => {
      if (c) return;
      const klines = (kRes.status === 'fulfilled' && kRes.value?.exchanges) || {};
      const dbPrices = (dbRes.status === 'fulfilled' && dbRes.value?.exchanges) || {};

      // Merge: klines take priority, DB fills gaps for exchanges without kline API
      const merged: Record<string, Candle[]> = { ...klines };
      for (const [ex, pts] of Object.entries(dbPrices) as [string, any[]][]) {
        if (!merged[ex] && pts.length > 0) {
          // Convert DB format {t, price} to kline format {t, c}
          merged[ex] = pts.map((p: any) => ({ t: p.t, c: p.price })).filter((c: Candle) => c.c > 0);
        }
      }

      setKd(Object.keys(merged).length > 0 ? merged : null);
    }).finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [sym, tf]);

  // Fetch live tickers + funding + OI (refresh every 30s)
  useEffect(() => {
    let c = false;
    const load = () => {
      Promise.allSettled([
        fetch('/api/tickers').then(r => r.ok ? r.json() : null),
        fetch('/api/funding').then(r => r.ok ? r.json() : null),
        fetch('/api/openinterest').then(r => r.ok ? r.json() : null),
      ]).then(([tRes, fRes, oRes]) => {
        if (c) return;
        const tData = (tRes.status === 'fulfilled' && tRes.value?.data) || [];
        const fData = (fRes.status === 'fulfilled' && fRes.value?.data) || [];
        const oData = (oRes.status === 'fulfilled' && oRes.value?.data) || [];
        setTickers(tData.filter((t: any) => t.symbol === sym));
        setFunding(fData.filter((f: any) => f.symbol === sym));
        setOI(oData.filter((o: any) => o.symbol === sym));
      });
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { c = true; clearInterval(iv); };
  }, [sym]);

  const { data, exs, available } = useMemo<{ data: Pt[]; exs: string[]; available?: string[] }>(() => {
    if (!kd) return { data: [] as Pt[], exs: [] as string[] };
    const av = Object.keys(kd);
    const active = sel.filter(e => av.includes(e));
    if (active.length === 0) return { data: [] as Pt[], exs: [] as string[], available: av };
    const exs = active;
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
      // Filter out stale/anomalous prices (>2% from mean)
      const sane = prices.filter(p => Math.abs(p - avg) / avg < 0.02);
      const useP = sane.length >= 2 ? sane : prices;
      for (const e of exs) if (pt[e]) pt[e + '_dev'] = ((pt[e] as number) - avg) / avg * 100;
      pt._spread = useP.length >= 2 ? Math.max(...useP) - Math.min(...useP) : 0;
      const d = new Date(t);
      pt.label = tf === '30d' ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : tf === '7d' ? (d.getMonth()+1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0')
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rows.push(pt);
    }
    return { data: rows, exs, available: av };
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

  // Tooltip rendered via renderTip callback below

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
              Cross-exchange price comparison across <span className="text-neutral-400 font-medium">{EXCHANGES.length} exchanges</span> (16 CEX + 12 DEX)
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="flex items-center gap-1.5 text-xs text-neutral-600"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading...</span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> {sel.length} selected · {exs.length} with data</span>
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
          <div className="relative" data-sym-picker>
            <button onClick={() => setShowSym(!showSym)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-hub-yellow/30 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getCoinIcon(sym)} alt="" className="w-5 h-5 rounded-full" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-lg font-bold">{sym}</span>
              <span className="text-neutral-500 text-sm"> Perp</span>
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

        </div>

        {/* Exchange Pills (own row) */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          {sel.map((e) => (
            <span key={e} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-white/[0.04] border border-white/[0.06]">
              <ExchangeLogo exchange={e} size={14} />
              {e}
              <button onClick={() => toggle(e)} className="text-neutral-600 hover:text-white"><X className="w-3 h-3" /></button>
            </span>
          ))}
            <div className="relative" data-ex-picker>
              <button onClick={() => setShowEx(!showEx)} className="px-2.5 py-1 rounded-full text-[11px] text-neutral-500 bg-white/[0.03] border border-white/[0.06] hover:border-hub-yellow/30 transition">
                + Exchange
              </button>
              {showEx && (
                <div className="absolute top-full mt-1 left-0 z-50 w-52 max-h-72 overflow-y-auto rounded-xl bg-[#141418] border border-white/[0.08] shadow-2xl">
                  <div className="p-2 border-b border-white/[0.06] sticky top-0 bg-[#141418] z-10">
                    <p className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold px-1 mb-1">Select exchanges ({sel.length}/8)</p>
                  </div>
                  <div className="py-1">
                    <p className="px-3 py-1 text-[8px] text-neutral-600 uppercase tracking-wider">CEX ({CEX_EXCHANGES.length})</p>
                    {CEX_EXCHANGES.map((e) => (
                      <button key={e} onClick={() => toggle(e)}
                        className={'w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] flex items-center justify-between ' + (sel.includes(e) ? 'text-hub-yellow' : KLINE_DIRECT.has(e) ? 'text-neutral-400' : 'text-neutral-600')}>
                        <span className="flex items-center gap-2.5">
                          <ExchangeLogo exchange={e} size={18} />
                          {e}
                          {!KLINE_DIRECT.has(e) && <span className="text-[7px] px-1 py-[0.5px] rounded bg-neutral-800 text-neutral-500">via DB</span>}
                        </span>
                        {sel.includes(e) ? (
                          <span className="w-4 h-4 rounded bg-hub-yellow/20 flex items-center justify-center text-hub-yellow text-[10px]">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded border border-white/[0.1]" />
                        )}
                      </button>
                    ))}
                    <p className="px-3 py-1 text-[8px] text-neutral-600 uppercase tracking-wider mt-1 border-t border-white/[0.06] pt-2">DEX ({DEX_EXCHANGES.length})</p>
                    {DEX_EXCHANGES.map((e) => (
                      <button key={e} onClick={() => toggle(e)}
                        className={'w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] flex items-center justify-between ' + (sel.includes(e) ? 'text-hub-yellow' : KLINE_DIRECT.has(e) ? 'text-neutral-400' : 'text-neutral-600')}>
                        <span className="flex items-center gap-2.5">
                          <ExchangeLogo exchange={e} size={18} />
                          {e}
                          {!KLINE_DIRECT.has(e) && <span className="text-[7px] px-1 py-[0.5px] rounded bg-neutral-800 text-neutral-500">via DB</span>}
                        </span>
                        {sel.includes(e) ? (
                          <span className="w-4 h-4 rounded bg-hub-yellow/20 flex items-center justify-center text-hub-yellow text-[10px]">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded border border-white/[0.1]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
        </div>

        {/* ── Stats Cards ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-hub-yellow" />
                <span className="text-xs text-neutral-500">
                  {exs.length === 2 ? stats.hi?.e + ' vs ' + stats.lo?.e : 'Current Spread'}
                </span>
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
              <p className="text-2xl font-bold font-mono text-white">{'$'}{stats.hi ? fp(stats.hi.p) : '—'}</p>
              <p className="text-[11px] text-green-400 mt-1">{stats.hi?.e}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-neutral-500">Lowest Price</span>
              </div>
              <p className="text-2xl font-bold font-mono text-white">{'$'}{stats.lo ? fp(stats.lo.p) : '—'}</p>
              <p className="text-[11px] text-red-400 mt-1">{stats.lo?.e}</p>
            </div>
          </div>
        )}

        {/* ── Bloomberg Ticker Strip ── */}
        {stats && (
          <div className="rounded-xl bg-[#0c0e14] border border-white/[0.06] px-4 py-2 mb-5 flex items-center gap-5 overflow-x-auto scrollbar-none">
            {stats.prices.map((x, i) => (
              <div key={x.e} className="flex items-center gap-2 flex-shrink-0">
                <ExchangeLogo exchange={x.e} size={14} />
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
                <h2 className="text-sm font-semibold">{sym} Perp Price by Exchange</h2>
                <p className="text-[11px] text-neutral-500">Close prices across {exs.length} venues · {TFS.find(t=>t.key===tf)?.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {exs.map((e, i) => (
                <span key={e} className="flex items-center gap-1 text-[10px]">
                  <span className="w-3 h-[2px] rounded-full" style={{ background: ec(e, i) }} />
                  <ExchangeLogo exchange={e} size={12} />
                  <span className="text-neutral-400">{e}</span>
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-[420px] flex flex-col gap-3 p-4">
              <div className="flex gap-4 mb-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-3 rounded bg-white/[0.03] animate-pulse" style={{ width: 60 + i * 10 }} />)}
              </div>
              <div className="flex-1 rounded-lg bg-white/[0.02] animate-pulse" />
              <div className="flex justify-between">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-2 w-12 rounded bg-white/[0.03] animate-pulse" />)}
              </div>
            </div>
          ) : data.length > 0 ? (
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(data.length / 7))} />
                <YAxis domain={yDomain} tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => '$' + fp(v)} width={72} allowDataOverflow />
                <RTooltip content={<SpreadTooltip exList={exs} colorFn={ec} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeDasharray: '4 4' }} />
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
              {available && available.length > 0 ? (
                <>
                  <p className="text-sm">Selected exchanges don{"'"}t list {sym}</p>
                  <p className="text-[10px] text-neutral-500 mt-2">Available on: {available.join(', ')}</p>
                  <button onClick={() => setSel(available.slice(0, 5))}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20 text-hub-yellow text-xs hover:bg-hub-yellow/20 transition">
                    Switch to available exchanges
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm">No price data for {sym}</p>
                  <p className="text-[10px] text-neutral-700 mt-1">Try a different symbol or timeframe</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Spread History + Range Analysis ── */}
        {data.length > 0 && exs.length >= 2 && stats && (
          <div className="rounded-2xl bg-[#0c0e14] border border-white/[0.06] p-4 sm:p-5 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-semibold">Spread History ({TFS.find(t => t.key === tf)?.label})</h2>
                <p className="text-[11px] text-neutral-500">
                  Price spread between highest and lowest exchange over time.
                  Use this to find the typical spread range for {sym}.
                </p>
              </div>
              {/* Spread Range Summary */}
              <div className="flex gap-4 sm:gap-6 flex-shrink-0">
                <div className="text-center sm:text-right">
                  <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Max</p>
                  <p className="font-mono text-sm text-green-400">{'$'}{fp(stats.max)}</p>
                  <p className="text-[9px] text-neutral-600">
                    {stats.maxT ? new Date(stats.maxT).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Average</p>
                  <p className="font-mono text-sm text-hub-yellow">{'$'}{fp(stats.avg)}</p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Min</p>
                  <p className="font-mono text-sm text-cyan-400">{'$'}{fp(stats.min)}</p>
                  <p className="text-[9px] text-neutral-600">
                    {stats.minT ? new Date(stats.minT).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={data} margin={{ top: 5, right: 50, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 9, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(data.length / 6))} />
                <YAxis tick={{ fill: '#4b5563', fontSize: 9, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => '$' + fp(v)} width={55} domain={[0, 'auto']} />
                <RTooltip contentStyle={{ background: '#141418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => ['$' + fp(v), 'Spread']} labelStyle={{ color: '#6b7280' }} />
                {/* Max spread line (top range) */}
                <ReferenceLine y={stats.max} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1}
                  label={{ value: 'MAX $' + fp(stats.max), position: 'right', fill: '#22c55e', fontSize: 8 }} />
                {/* Average spread line */}
                <ReferenceLine y={stats.avg} stroke="#F59E0B" strokeDasharray="3 3" strokeWidth={1}
                  label={{ value: 'AVG $' + fp(stats.avg), position: 'right', fill: '#F59E0B', fontSize: 8 }} />
                {/* Min spread line (bottom range) */}
                <ReferenceLine y={stats.min} stroke="#06b6d4" strokeDasharray="6 3" strokeWidth={1}
                  label={{ value: 'MIN $' + fp(stats.min), position: 'right', fill: '#06b6d4', fontSize: 8 }} />
                {/* Spread area fill */}
                <Area type="monotone" dataKey="_spread" stroke="#F59E0B" fill="rgba(245,158,11,0.08)" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-neutral-600 mt-3 text-center">
              The spread typically ranges between {'$'}{fp(stats.min)} (min) and {'$'}{fp(stats.max)} (max).
              Average spread over {TFS.find(t => t.key === tf)?.label}: {'$'}{fp(stats.avg)}.
              Values above the green MAX line indicate unusual spread widening.
            </p>
          </div>
        )}

        {/* ── Exchange Table + Arb Calc side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          {/* Exchange Table */}
          {stats && stats.prices.length > 0 && (
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden lg:col-span-2">
              <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{sym} Market Data by Exchange</h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Live prices, funding, OI, and volume · refreshes every 30s</p>
                </div>
                <span className="text-[10px] text-neutral-600">{tickers.length} exchanges reporting</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-neutral-500 uppercase tracking-wider border-b border-white/[0.06]">
                      <th className="px-4 py-2 text-left">Exchange</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">vs Median</th>
                      <th className="px-3 py-2 text-right">24h Change</th>
                      <th className="px-3 py-2 text-right">Funding Rate</th>
                      <th className="px-3 py-2 text-right">Open Interest</th>
                      <th className="px-3 py-2 text-right">Volume 24h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Merge all data sources by exchange
                      const tickerMap = new Map(tickers.map(t => [t.exchange, t]));
                      const fundingMap = new Map(funding.map(f => [f.exchange, f]));
                      const oiMap = new Map(oi.map(o => [o.exchange, o]));
                      const allExchanges = new Set([...tickers.map(t => t.exchange), ...stats.prices.map(p => p.e)]);
                      // Compute 24h change from klines (first vs last candle)
                      const changeMap = new Map<string, number>();
                      if (kd) {
                        for (const [ex, candles] of Object.entries(kd)) {
                          if (candles.length >= 2) {
                            const first = candles[0].c;
                            const last = candles[candles.length - 1].c;
                            if (first > 0) changeMap.set(ex, ((last - first) / first) * 100);
                          }
                        }
                      }
                      const rows = Array.from(allExchanges).map(e => ({
                        exchange: e,
                        price: tickerMap.get(e)?.lastPrice || stats.prices.find(p => p.e === e)?.p || 0,
                        change: changeMap.get(e) ?? tickerMap.get(e)?.change24h,
                        fundingRate: fundingMap.get(e)?.fundingRate,
                        oiValue: oiMap.get(e)?.openInterestValue,
                        volume: tickerMap.get(e)?.quoteVolume24h,
                      })).filter(r => r.price > 0).sort((a, b) => b.price - a.price);
                      const median = rows.length > 0 ? rows.reduce((s, r) => s + r.price, 0) / rows.length : 0;
                      return rows.map((r, i) => {
                        const dev = median > 0 ? ((r.price - median) / median) * 100 : 0;
                        return (
                          <tr key={r.exchange} className={'border-b border-white/[0.03] hover:bg-white/[0.02] ' + (i === 0 ? 'bg-green-500/[0.02]' : i === rows.length - 1 ? 'bg-red-500/[0.02]' : '')}>
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2">
                                <ExchangeLogo exchange={r.exchange} size={16} />
                                <span className="font-medium text-white">{r.exchange}</span>
                                {i === 0 && <span className="text-[7px] px-1 py-[1px] rounded bg-green-500/10 text-green-400 font-bold">HIGH</span>}
                                {i === rows.length - 1 && <span className="text-[7px] px-1 py-[1px] rounded bg-red-500/10 text-red-400 font-bold">LOW</span>}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-white">{'$'}{fp(r.price)}</td>
                            <td className={'px-3 py-2.5 text-right font-mono ' + (dev >= 0 ? 'text-green-400' : 'text-red-400')}>
                              {dev >= 0 ? '+' : ''}{dev.toFixed(3)}%
                            </td>
                            <td className={'px-3 py-2.5 text-right font-mono ' + (r.change !== undefined ? (r.change >= 0 ? 'text-green-400' : 'text-red-400') : 'text-neutral-600')}>
                              {r.change !== undefined ? (r.change >= 0 ? '+' : '') + r.change.toFixed(2) + '%' : '—'}
                            </td>
                            <td className={'px-3 py-2.5 text-right font-mono ' + (r.fundingRate !== undefined ? (r.fundingRate >= 0 ? 'text-green-400' : 'text-red-400') : 'text-neutral-600')}>
                              {r.fundingRate !== undefined ? (r.fundingRate >= 0 ? '+' : '') + (r.fundingRate * 100).toFixed(4) + '%' : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-neutral-300">
                              {r.oiValue ? '$' + (r.oiValue >= 1e9 ? (r.oiValue/1e9).toFixed(2)+'B' : r.oiValue >= 1e6 ? (r.oiValue/1e6).toFixed(1)+'M' : (r.oiValue/1e3).toFixed(0)+'K') : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-neutral-300">
                              {r.volume ? '$' + (r.volume >= 1e9 ? (r.volume/1e9).toFixed(2)+'B' : r.volume >= 1e6 ? (r.volume/1e6).toFixed(1)+'M' : (r.volume/1e3).toFixed(0)+'K') : '—'}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
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
                      {profit >= 0 ? '+' : '-'}{'$'}{fp(Math.abs(profit))}
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
              <span className="text-hub-yellow font-medium">Chart</span>: historical candle close prices from exchange APIs (5-min cache).{' '}
              <span className="text-hub-yellow font-medium">Table</span>: live prices, funding rates, OI, and volume from /api/tickers, /api/funding, /api/openinterest (30s refresh).{' '}
              <span className="text-hub-yellow font-medium">Spread</span> = highest minus lowest price across selected exchanges.{' '}
              Chart data from: {exs.length > 0 ? exs.join(', ') : 'no exchanges selected'}.
            </span>
          </p>
        </div>

      </main>
      <Footer />
    </div>
  );
}
