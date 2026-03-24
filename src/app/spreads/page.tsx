'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ArrowLeftRight, Search, ChevronDown, X, RefreshCw, Calculator, TrendingUp, TrendingDown, Activity, BarChart3, Zap, Info, Wifi, WifiOff, Bell, BellOff } from 'lucide-react';
import { useMultiExchangeWS, WS_SUPPORTED } from '@/hooks/useMultiExchangeWS';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getCoinIcon } from '@/lib/coinIcons';
import { ExchangeLogo } from '@/components/ExchangeLogos';

// ─── Exchange colors ─────────────────────────────────────────────────────────
// Maximally distinct colors — no two should look similar on dark bg
const EX_COLORS: Record<string, string> = {
  Binance: '#F0B90B',     // gold/yellow
  Bybit: '#FF4040',       // bright red
  OKX: '#00FF00',         // pure green
  Bitget: '#00BFFF',      // deep sky blue
  MEXC: '#FF00FF',        // magenta
  HTX: '#FF8C00',         // dark orange
  Hyperliquid: '#00FFFF', // cyan
  dYdX: '#9D4EDD',       // purple
  Kraken: '#FFFF00',      // yellow
  'Gate.io': '#7FFF00',   // chartreuse
  Coinbase: '#4169E1',    // royal blue
  KuCoin: '#00FA9A',      // medium spring green
  BingX: '#FF69B4',       // hot pink
  Phemex: '#D2691E',      // chocolate
  CoinEx: '#48D1CC',      // medium turquoise
  Deribit: '#BA55D3',     // medium orchid
  WhiteBIT: '#ADFF2F',    // green yellow
};
const PALETTE = ['#F0B90B','#FF4040','#00FF00','#00BFFF','#FF00FF','#FF8C00','#00FFFF','#9D4EDD','#FFFF00','#7FFF00'];
function ec(ex: string, i: number) { return EX_COLORS[ex] || PALETTE[i % PALETTE.length]; }

type Candle = { t: number; o: number; h: number; l: number; c: number };
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
// Excluded: gTrade, GMX (oracle-based, no independent prices), edgeX (no ticker API)
const DEX_EXCHANGES = ['Hyperliquid','dYdX','Aster','Lighter','Aevo','Drift','Extended','Variational','Nado','Backpack','Orderly','Paradex'];
const EXCHANGES = [...CEX_EXCHANGES, ...DEX_EXCHANGES];
// Exchanges with direct kline API (fast, 1h candles)
// All other exchanges use DB mark_price snapshots (10-min, needs accumulation)
const TFS = [
  { key: 'live', label: 'Live', source: 'ws' as const },
  { key: '1d', label: '1D', source: 'db' as const, days: 1 },
  { key: '7d', label: '7D', source: 'db' as const, days: 7 },
  { key: '30d', label: '30D', source: 'db' as const, days: 30 },
] as const;
type TfK = typeof TFS[number]['key'];

function fp(v: number) {
  if (v >= 10000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  if (v >= 0.0001) return v.toFixed(6);
  if (v === 0) return '0.00';
  if (v < 0.0001) return v.toExponential(1);
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
    if (typeof window === 'undefined') return { sym: 'BTC', sel: ['Binance','Bybit','OKX','Bitget','Hyperliquid'], tf: 'live' as TfK };
    const p = new URLSearchParams(window.location.search);
    return {
      sym: p.get('s') || 'BTC',
      sel: p.get('ex')?.split(',').filter(e => e && EXCHANGES.includes(e)) || ['Binance','Bybit','OKX','Bitget','Hyperliquid'],
      tf: (p.get('tf') || 'live') as TfK,
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
  const [loading, setLoading] = useState(false); // Don't block initial render
  const [chartLoading, setChartLoading] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [calcAmt, setCalcAmt] = useState('10000');
  const [calcFee, setCalcFee] = useState('0.1');
  const [calcMode, setCalcMode] = useState<'usd' | 'coin'>('usd');
  const [wsEnabled, setWsEnabled] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertActive, setAlertActive] = useState(false);
  const [lastAlert, setLastAlert] = useState<string | null>(null);
  const prevPricesRef = useRef<Record<string, number>>({});

  // ── WebSocket real-time prices ──
  const { prices: wsPrices, connected: wsConnected, history: wsHistory } = useMultiExchangeWS(sym, sel, wsEnabled);
  const wsCount = Object.values(wsConnected).filter(Boolean).length;
  const wsTotal = sel.filter(e => WS_SUPPORTED.includes(e)).length;

  // Compute live spread from WS prices
  const wsSpread = useMemo(() => {
    const wsPriceValues = Object.values(wsPrices).filter(p => p.price > 0);
    if (wsPriceValues.length < 2) return null;
    const sorted = [...wsPriceValues].sort((a, b) => b.price - a.price);
    const spread = sorted[0].price - sorted[sorted.length - 1].price;
    const pct = (spread / sorted[sorted.length - 1].price) * 100;
    return { spread, pct, high: sorted[0], low: sorted[sorted.length - 1], prices: sorted };
  }, [wsPrices]);

  // ── Alert checking ──
  useEffect(() => {
    if (!alertActive || !wsSpread || !alertThreshold) return;
    const threshold = Number(alertThreshold);
    if (threshold <= 0 || isNaN(threshold)) return;
    if (wsSpread.spread >= threshold) {
      const msg = `${sym} spread $${wsSpread.spread.toFixed(2)} exceeded $${threshold} threshold! ${wsSpread.high.exchange} $${fp(wsSpread.high.price)} vs ${wsSpread.low.exchange} $${fp(wsSpread.low.price)}`;
      if (msg !== lastAlert) {
        setLastAlert(msg);
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('InfoHub Spread Alert', { body: msg, icon: '/favicon.ico' });
        }
        // Sound alert
        try { new Audio('/audio/alert.mp3').play().catch(() => {}); } catch {}
      }
    }
  }, [wsSpread, alertActive, alertThreshold, sym, lastAlert]);
  const [chartMode, setChartMode] = useState<'line' | 'candle'>('line');
  const [viewMode, setViewMode] = useState<'price' | 'pct'>('pct'); // Default to % view like reference
  const [candleExchange, setCandleExchange] = useState('');
  const [spreadUnit, setSpreadUnit] = useState<'usd' | 'pct'>('usd');

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

  // Fetch klines + DB mark_price history + spread history for 1D/7D/30D views
  const [dbHistory, setDbHistory] = useState<Array<{ t: number; spread: number; pct: number; high_ex: string; low_ex: string }>>([]);
  // Ref to track current selection for the slow-exchange effect
  const selRef = useRef(sel);
  selRef.current = sel;
  useEffect(() => {
    const t = TFS.find(x => x.key === tf);
    if (!t || t.source !== 'db') { setChartLoading(false); return; } // Live tab uses WS only
    setChartLoading(true);
    let c = false;
    const days = (t as any).days || 7;
    const interval = (t as any).interval || '1h';
    const limit = (t as any).limit || 168;
    // Fetch fast exchanges first for instant chart, then slow ones for selected exchanges
    fetch(`/api/klines-multi?symbol=${sym}&interval=${interval}&limit=${limit}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (c) return;
        const klines = json?.exchanges || {};
        if (Object.keys(klines).length > 0) {
          setKd(klines);
          setChartLoading(false);
        }
        // Fetch any selected slow exchanges that weren't in the fast set
        const FAST = ['Binance','Bybit','OKX','Bitget','MEXC','HTX','Hyperliquid','dYdX'];
        const slow = selRef.current.filter(e => !FAST.includes(e));
        if (slow.length > 0) {
          fetch(`/api/klines-multi?symbol=${sym}&interval=${interval}&limit=${limit}&exchanges=${slow.join(',')}`)
            .then(r => r.ok ? r.json() : null)
            .then(sj => {
              if (c) return;
              const extra = sj?.exchanges || {};
              if (Object.keys(extra).length > 0) {
                setKd(prev => prev ? { ...prev, ...extra } : extra);
              }
            }).catch(() => {});
        }
      }).catch(() => {});
    // DB sources in background (don't block chart)
    Promise.allSettled([
      fetch(`/api/history/price-multi?symbol=${sym}&days=${days}`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/history/spreads?symbol=${sym}&days=${days}`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([dbPriceRes, dbSpreadRes]) => {
      if (c) return;
      const dbPrices = (dbPriceRes.status === 'fulfilled' && dbPriceRes.value?.exchanges) || {};

      // Merge DB mark_price into klines (fills gaps for DEX + exchanges with empty klines)
      if (Object.keys(dbPrices).length > 0) {
        setKd(prev => {
          const merged = prev ? { ...prev } : {};
          for (const [ex, pts] of Object.entries(dbPrices) as [string, any[]][]) {
            if ((!merged[ex] || merged[ex].length === 0) && pts.length > 0) {
              merged[ex] = pts.map((p: any) => ({ t: p.t, o: p.price, h: p.price, l: p.price, c: p.price })).filter((x: Candle) => x.c > 0);
            }
          }
          return merged;
        });
      }
      setDbHistory((dbSpreadRes.status === 'fulfilled' && dbSpreadRes.value?.data) || []);
    }).finally(() => { if (!c) setChartLoading(false); });
    return () => { c = true; };
  }, [sym, tf]);

  // Fetch klines for newly added exchanges that aren't in kd yet
  const kdRef = useRef(kd);
  kdRef.current = kd;
  const selKey = sel.join(',');
  useEffect(() => {
    if (!kdRef.current || tf === 'live') return;
    const cur = kdRef.current;
    const missing = sel.filter(e => !cur[e] || cur[e].length === 0);
    if (missing.length === 0) return;
    const t = TFS.find(x => x.key === tf);
    const interval = (t as any)?.interval || '1h';
    const limit = (t as any)?.limit || 168;
    let c = false;
    fetch(`/api/klines-multi?symbol=${sym}&interval=${interval}&limit=${limit}&exchanges=${missing.join(',')}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (c) return;
        const extra = json?.exchanges || {};
        if (Object.keys(extra).length > 0) {
          setKd(prev => prev ? { ...prev, ...extra } : extra);
        }
      }).catch(() => {});
    return () => { c = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, sym, tf]);

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
    // LIVE mode: use WebSocket + REST history
    if (tf === 'live') {
      if (wsHistory.length < 2) return { data: [] as Pt[], exs: sel };
      // Include all selected exchanges that have data (WS + REST-polled)
      const wsExs = sel.filter(e => wsHistory.some(snap => snap.prices[e] > 0));
      if (wsExs.length === 0) return { data: [] as Pt[], exs: [] as string[] };
      const rows: Pt[] = [];
      for (const snap of wsHistory) {
        const pt: Pt = { time: snap.t, label: '' };
        const prices: number[] = [];
        for (const e of wsExs) {
          const p = snap.prices[e];
          if (p && p > 0) { pt[e] = p; prices.push(p); }
        }
        if (prices.length < 1) continue;
        const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
        for (const e of wsExs) if (pt[e]) pt[e + '_dev'] = ((pt[e] as number) - avg) / avg * 100;
        pt._spread = prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : 0;
        pt._spreadPct = prices.length >= 2 ? ((Math.max(...prices) - Math.min(...prices)) / Math.min(...prices)) * 100 : 0;
        pt.label = new Date(snap.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        rows.push(pt);
      }
      return { data: rows, exs: wsExs };
    }

    // DB mode: use kd if available (legacy), otherwise empty
    if (!kd) return { data: [] as Pt[], exs: [] as string[] };
    const av = Object.keys(kd);
    const active = sel.filter(e => av.includes(e));
    if (active.length === 0 && av.length > 0) {
      // No selected exchanges have kline data — auto-use all available
      const fallback = av;
      const bucketMs2 = tf === '1d' ? 3600_000 : 14400_000;
      const times2 = new Set<number>();
      const maps2: Record<string, Map<number, number>> = {};
      for (const e of fallback) {
        const m = new Map<number, number>();
        for (const c of kd[e]) if (c.c > 0) {
          const bucket = Math.round(c.t / bucketMs2) * bucketMs2;
          m.set(bucket, c.c); times2.add(bucket);
        }
        maps2[e] = m;
      }
      const sorted2 = Array.from(times2).sort((a, b) => a - b);
      const rows2: Pt[] = [];
      const last2: Record<string, number> = {};
      for (const t of sorted2) {
        const pt: Pt = { time: t, label: '' };
        const prices: number[] = [];
        for (const e of fallback) {
          const p = maps2[e]?.get(t) ?? last2[e];
          if (p) { last2[e] = p; pt[e] = p; prices.push(p); }
        }
        if (prices.length < 1) continue;
        const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
        for (const e of fallback) if (pt[e]) pt[e + '_dev'] = ((pt[e] as number) - avg) / avg * 100;
        pt._spread = prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : 0;
        pt._spreadPct = prices.length >= 2 ? ((Math.max(...prices) - Math.min(...prices)) / Math.min(...prices)) * 100 : 0;
        const d = new Date(t);
        pt.label = tf === '30d' ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
          : tf === '7d' ? (d.getMonth()+1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0')
          : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        rows2.push(pt);
      }
      return { data: rows2, exs: fallback, available: av };
    }
    if (active.length === 0) return { data: [] as Pt[], exs: [] as string[], available: av };
    const exs = active;
    // Bucket timestamps to align exchanges (1h for 1D, 4h for 7D/30D)
    const bucketMs = tf === '1d' ? 3600_000 : 14400_000;
    const maps: Record<string, Map<number, number>> = {};
    const allBuckets = new Set<number>();
    for (const e of exs) {
      const m = new Map<number, number>();
      for (const c of kd[e]) {
        if (c.c > 0) {
          const bucket = Math.round(c.t / bucketMs) * bucketMs;
          m.set(bucket, c.c);
          allBuckets.add(bucket);
        }
      }
      maps[e] = m;
    }
    const sorted = Array.from(allBuckets).sort((a, b) => a - b);
    const rows: Pt[] = [];
    const lastSeen: Record<string, { p: number; t: number }> = {};
    for (const t of sorted) {
      const pt: Pt = { time: t, label: '' };
      const prices: number[] = [];
      const exPrices: { e: string; p: number }[] = [];
      for (const e of exs) {
        let p = maps[e]?.get(t);
        if (p && p > 0) {
          lastSeen[e] = { p, t };
        } else if (lastSeen[e] && (t - lastSeen[e].t) <= bucketMs * 2) {
          // Forward-fill only if last seen within 2 buckets (prevent stale data)
          p = lastSeen[e].p;
        }
        if (p && p > 0) { exPrices.push({ e, p }); prices.push(p); }
      }
      if (prices.length < 2) continue;
      // Filter outliers: exclude if >1% from median at this timestamp
      const sortedP = [...prices].sort((a, b) => a - b);
      const median = sortedP[Math.floor(sortedP.length / 2)];
      const sane = exPrices.filter(x => Math.abs(x.p - median) / median < 0.03);
      const useExs = sane.length >= 2 ? sane : exPrices;
      const avg = useExs.reduce((s, x) => s + x.p, 0) / useExs.length;
      for (const x of useExs) {
        pt[x.e] = x.p;
        pt[x.e + '_dev'] = ((x.p - avg) / avg) * 100;
      }
      const usePrices = useExs.map(x => x.p);
      pt._spread = Math.max(...usePrices) - Math.min(...usePrices);
      pt._spreadPct = usePrices.length >= 2 ? ((Math.max(...usePrices) - Math.min(...usePrices)) / Math.min(...usePrices)) * 100 : 0;
      // Spread (A - B) line: difference between first two exchanges in %
      if (useExs.length >= 2 && avg > 0) {
        pt._spreadAB = ((useExs[0].p - useExs[1].p) / avg) * 100;
      }
      const d = new Date(t);
      pt.label = tf === '30d' ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : tf === '7d' ? (d.getMonth()+1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0')
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rows.push(pt);
    }
    return { data: rows, exs, available: av };
  }, [kd, sel, tf, wsHistory]);

  const stats = useMemo(() => {
    if (data.length === 0 || exs.length < 2) return null;
    let sum = 0, max = 0, min = Infinity, maxT = 0, minT = 0, cnt = 0;
    let sumPct = 0, maxPct = 0, minPct = Infinity;
    let maxHi = '', maxLo = '', minHi = '', minLo = '';
    for (const pt of data) {
      const s = pt._spread || 0; sum += s; cnt++;
      const sp = pt._spreadPct || 0; sumPct += sp;
      if (sp > maxPct) maxPct = sp;
      if (sp < minPct) minPct = sp;
      if (s > max) {
        max = s; maxT = pt.time;
        const p = exs.map(e => ({ e, p: pt[e] as number })).filter(x => typeof x.p === 'number' && x.p > 0).sort((a, b) => b.p - a.p);
        if (p.length >= 2) { maxHi = p[0].e; maxLo = p[p.length - 1].e; }
      }
      if (s < min) {
        min = s; minT = pt.time;
        const p = exs.map(e => ({ e, p: pt[e] as number })).filter(x => typeof x.p === 'number' && x.p > 0).sort((a, b) => b.p - a.p);
        if (p.length >= 2) { minHi = p[0].e; minLo = p[p.length - 1].e; }
      }
    }
    const last = data[data.length - 1];
    const prices = exs.map(e => ({ e, p: last[e] as number })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
    const cur = prices.length >= 2 ? prices[0].p - prices[prices.length - 1].p : 0;
    const pct = prices.length >= 2 ? (cur / prices[prices.length - 1].p) * 100 : 0;
    return {
      cur, pct, avg: cnt ? sum / cnt : 0, max, min: min === Infinity ? 0 : min, maxT, minT, maxHi, maxLo, minHi, minLo, prices, hi: prices[0], lo: prices[prices.length - 1],
      avgPct: cnt ? sumPct / cnt : 0, maxPct, minPct: minPct === Infinity ? 0 : minPct,
    };
  }, [data, exs]);

  const toggle = useCallback((e: string) => setSel(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e]), []);

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
              Cross-exchange price comparison across <span className="text-neutral-400 font-medium">{EXCHANGES.length} exchanges</span> ({CEX_EXCHANGES.length} CEX + {DEX_EXCHANGES.length} DEX)
            </p>
          </div>
          <div className="flex items-center gap-3">
            {chartLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-neutral-600"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading...</span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> {sel.length} selected · {exs.length} with data</span>
            )}
            <button onClick={() => setShowCalc(!showCalc)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white transition flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Arb Calc
            </button>
            {/* WS toggle */}
            <button onClick={() => setWsEnabled(!wsEnabled)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                wsEnabled && wsCount > 0
                  ? 'bg-green-500/[0.06] border-green-500/20 text-green-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-neutral-500'
              }`}>
              {wsEnabled ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {wsEnabled ? `WS ${wsCount}/${wsTotal}` : 'WS Off'}
            </button>
            {/* Alert toggle */}
            <div className="flex items-center gap-1">
              <button onClick={() => {
                if (!alertActive && 'Notification' in window) Notification.requestPermission();
                setAlertActive(!alertActive);
              }}
                className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                  alertActive ? 'bg-hub-yellow/10 border-hub-yellow/20 text-hub-yellow' : 'bg-white/[0.04] border-white/[0.08] text-neutral-500'
                }`}>
                {alertActive ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                Alert
              </button>
              {alertActive && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-neutral-600">$</span>
                  <input value={alertThreshold} onChange={e => setAlertThreshold(e.target.value)}
                    type="number" placeholder="100" step="10"
                    className="w-16 px-1.5 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white outline-none focus:border-hub-yellow/30" />
                </div>
              )}
            </div>
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
          {sel.map((e) => {
            const hasChart = kd ? !!kd[e] : false;
            const isInChart = exs.includes(e);
            return (
              <span key={e} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${
                isInChart ? 'bg-white/[0.06] border-white/[0.1]' : 'bg-white/[0.02] border-white/[0.04] opacity-60'
              }`}>
                <ExchangeLogo exchange={e} size={14} />
                {e}
                {tf !== 'live' && !hasChart && <span className="text-[7px] text-neutral-600 px-1 py-[0.5px] rounded bg-white/[0.03]">table</span>}
                <button onClick={() => toggle(e)} className="text-neutral-600 hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            );
          })}
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
                        className={'w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] flex items-center justify-between ' + (sel.includes(e) ? 'text-hub-yellow' : WS_SUPPORTED.includes(e) ? 'text-neutral-400' : 'text-neutral-600')}>
                        <span className="flex items-center gap-2.5">
                          <ExchangeLogo exchange={e} size={18} />
                          {e}
                          {tf === 'live' ? (
                            !WS_SUPPORTED.includes(e) && <span className="text-[7px] px-1 py-[0.5px] rounded bg-neutral-800 text-neutral-500">REST</span>
                          ) : (
                            kd && !kd[e] && <span className="text-[7px] px-1 py-[0.5px] rounded bg-neutral-800 text-neutral-500">table only</span>
                          )}
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
                        className={'w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] flex items-center justify-between ' + (sel.includes(e) ? 'text-hub-yellow' : WS_SUPPORTED.includes(e) ? 'text-neutral-400' : 'text-neutral-600')}>
                        <span className="flex items-center gap-2.5">
                          <ExchangeLogo exchange={e} size={18} />
                          {e}
                          {tf === 'live' ? (
                            !WS_SUPPORTED.includes(e) && <span className="text-[7px] px-1 py-[0.5px] rounded bg-neutral-800 text-neutral-500">REST</span>
                          ) : (
                            kd && !kd[e] && <span className="text-[7px] px-1 py-[0.5px] rounded bg-neutral-800 text-neutral-500">table only</span>
                          )}
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
              {exs.length === 2 && stats.hi && stats.lo ? (
                <>
                  <div className="space-y-0.5 mb-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-green-400 truncate">{stats.hi.e}</span>
                      <span className="font-mono text-xs text-white">{'$'}{fp(stats.hi.p)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-red-400 truncate">{stats.lo.e}</span>
                      <span className="font-mono text-xs text-white">{'$'}{fp(stats.lo.p)}</span>
                    </div>
                  </div>
                  <div className="border-t border-white/[0.06] pt-1.5">
                    <p className="text-xl font-bold font-mono text-hub-yellow">{'$'}{fp(stats.cur)}</p>
                    <p className="text-[11px] text-neutral-500">{stats.pct.toFixed(3)}% · {(stats.pct * 100).toFixed(1)} bps</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold font-mono text-hub-yellow">{'$'}{fp(stats.cur)}</p>
                  <p className="text-[11px] text-neutral-500 mt-1">{stats.pct.toFixed(3)}% · {(stats.pct * 100).toFixed(1)} bps</p>
                </>
              )}
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

        {/* ── Bloomberg Ticker Strip (WS-powered when available) ── */}
        {stats && (
          <div className="rounded-xl bg-[#0c0e14] border border-white/[0.06] px-4 py-2 mb-5 flex items-center gap-5 overflow-x-auto scrollbar-none">
            {[...stats.prices].sort((a, b) => {
              const pa = wsPrices[a.e]?.price || a.p;
              const pb = wsPrices[b.e]?.price || b.p;
              return pb - pa;
            }).map((x, i) => {
              const wsP = wsPrices[x.e];
              const livePrice = wsP?.price || x.p;
              const prev = prevPricesRef.current[x.e] || livePrice;
              const direction = livePrice > prev ? 'up' : livePrice < prev ? 'down' : 'same';
              prevPricesRef.current[x.e] = livePrice;
              const median = stats.prices.reduce((s, p) => s + (wsPrices[p.e]?.price || p.p), 0) / stats.prices.length;
              const dev = ((livePrice - median) / median) * 100;
              return (
                <div key={x.e} className="flex items-center gap-2 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ec(x.e, exs.indexOf(x.e)) }} />
                  <ExchangeLogo exchange={x.e} size={14} />
                  <span className="text-[11px] text-neutral-500">{x.e}</span>
                  <span className={`font-mono text-[12px] font-medium transition-colors duration-300 ${
                    direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-white'
                  }`}>
                    {'$'}{fp(livePrice)}
                  </span>
                  {wsP && <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" title="Live WS" />}
                  <span className={`font-mono text-[10px] ${dev >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {dev >= 0 ? '▲' : '▼'}{Math.abs(dev).toFixed(3)}%
                  </span>
                  {i < stats.prices.length - 1 && <span className="text-neutral-800 mx-1">│</span>}
                </div>
              );
            })}
            <div className="flex-shrink-0 ml-auto pl-4 border-l border-white/[0.06]">
              <span className="text-[10px] text-neutral-600">SPREAD </span>
              <span className="font-mono text-[12px] text-hub-yellow font-bold">
                {'$'}{fp(wsSpread?.spread ?? stats.cur)}
              </span>
              {wsCount > 0 && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />}
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
                <p className="text-[11px] text-neutral-500">
                  {tf === 'live'
                    ? `Live WebSocket prices · ${wsHistory.length} snapshots · updates every 5s`
                    : `${data.length} data points · ${tf === '1d' ? '1h' : '4h'} resolution · ${exs.length} venues`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {/* Chart mode toggle */}
              <div className="flex items-center gap-[2px] p-[2px] rounded-md bg-white/[0.03] border border-white/[0.06]">
                <button onClick={() => setChartMode('line')}
                  className={'px-2 py-0.5 rounded text-[9px] font-semibold transition ' + (chartMode === 'line' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600 hover:text-neutral-400')}>Lines</button>
                <button onClick={() => { setChartMode('candle'); if (!candleExchange && exs.length > 0) setCandleExchange(exs.includes('Binance') ? 'Binance' : exs[0]); }}
                  className={'px-2 py-0.5 rounded text-[9px] font-semibold transition ' + (chartMode === 'candle' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600 hover:text-neutral-400')}>Candles</button>
              </div>
              {/* Price vs % view toggle */}
              {chartMode === 'line' && (
                <div className="flex items-center gap-[2px] p-[2px] rounded-md bg-white/[0.03] border border-white/[0.06]">
                  <button onClick={() => setViewMode('price')}
                    className={'px-2 py-0.5 rounded text-[9px] font-semibold transition ' + (viewMode === 'price' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600 hover:text-neutral-400')}>$</button>
                  <button onClick={() => setViewMode('pct')}
                    className={'px-2 py-0.5 rounded text-[9px] font-semibold transition ' + (viewMode === 'pct' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600 hover:text-neutral-400')}>%</button>
                </div>
              )}
              {chartMode === 'candle' && (
                <div className="flex items-center gap-1">
                  {exs.filter(e => kd?.[e]).map(e => (
                    <button key={e} onClick={() => setCandleExchange(e)}
                      className={`px-2 py-0.5 rounded text-[9px] font-medium transition flex items-center gap-1 ${
                        candleExchange === e ? 'bg-white/[0.08] text-white border border-white/[0.15]' : 'text-neutral-500 hover:text-neutral-300'
                      }`}>
                      <ExchangeLogo exchange={e} size={12} />
                      {e}
                    </button>
                  ))}
                </div>
              )}
              {chartMode === 'line' && exs.map((e, i) => (
                <span key={e} className="flex items-center gap-1 text-[10px]">
                  <span className="w-3 h-[2px] rounded-full" style={{ background: ec(e, i) }} />
                  <ExchangeLogo exchange={e} size={12} />
                  <span className="text-neutral-400">{e}</span>
                </span>
              ))}
              {chartMode === 'line' && viewMode === 'pct' && exs.length >= 2 && (
                <span className="flex items-center gap-1 text-[10px] text-neutral-500">
                  <span className="w-3 h-[1px] border-t border-dashed border-neutral-500" />
                  Spread (A − B)
                </span>
              )}
            </div>
          </div>

          {chartLoading ? (
            <div className="h-[420px] flex flex-col gap-3 p-4">
              <div className="flex gap-4 mb-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-3 rounded bg-white/[0.03] animate-pulse" style={{ width: 60 + i * 10 }} />)}
              </div>
              <div className="flex-1 rounded-lg bg-white/[0.02] animate-pulse" />
              <div className="flex justify-between">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-2 w-12 rounded bg-white/[0.03] animate-pulse" />)}
              </div>
            </div>
          ) : data.length > 0 && chartMode === 'candle' && candleExchange && tf !== 'live' && kd?.[candleExchange] ? (
            /* Proper candlestick chart using custom SVG bars */
            (() => {
              const candles = kd[candleExchange];
              const prices = candles.flatMap(c => [c.h, c.l]).filter(p => p > 0);
              const minP = Math.min(...prices), maxP = Math.max(...prices);
              const pad = (maxP - minP) * 0.05;
              const yMin = minP - pad, yMax = maxP + pad;
              const W = 1200, H = 420, ML = 72, MR = 8, MT = 8, MB = 30;
              const cw = (W - ML - MR) / candles.length;
              const toY = (p: number) => MT + (1 - (p - yMin) / (yMax - yMin)) * (H - MT - MB);
              const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yMax - yMin) * (i / 4));
              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[420px]" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {yTicks.map((v, i) => (
                    <g key={i}>
                      <line x1={ML} x2={W - MR} y1={toY(v)} y2={toY(v)} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                      <text x={ML - 6} y={toY(v) + 3} textAnchor="end" fill="#4b5563" fontSize="9" fontFamily="ui-monospace, monospace">{'$' + fp(v)}</text>
                    </g>
                  ))}
                  {/* Candles */}
                  {candles.map((c, i) => {
                    const x = ML + i * cw + cw / 2;
                    const bullish = c.c >= c.o;
                    const color = bullish ? '#22c55e' : '#ef4444';
                    const bodyTop = toY(Math.max(c.o, c.c));
                    const bodyBot = toY(Math.min(c.o, c.c));
                    const bodyH = Math.max(bodyBot - bodyTop, 1);
                    const barW = Math.max(cw * 0.6, 2);
                    return (
                      <g key={i}>
                        {/* Wick */}
                        <line x1={x} x2={x} y1={toY(c.h)} y2={toY(c.l)} stroke={color} strokeWidth={1} opacity={0.6} />
                        {/* Body */}
                        <rect x={x - barW / 2} y={bodyTop} width={barW} height={bodyH}
                          fill={bullish ? color : color} stroke={color} strokeWidth={0.5}
                          fillOpacity={bullish ? 0.8 : 0.9} rx={1} />
                      </g>
                    );
                  })}
                  {/* X-axis labels */}
                  {candles.filter((_, i) => i % Math.max(1, Math.floor(candles.length / 8)) === 0).map((c, i) => {
                    const idx = candles.indexOf(c);
                    const x = ML + idx * cw + cw / 2;
                    const d = new Date(c.t);
                    const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return <text key={i} x={x} y={H - 6} textAnchor="middle" fill="#4b5563" fontSize="9" fontFamily="ui-monospace, monospace">{label}</text>;
                  })}
                  {/* Current price line */}
                  {candles.length > 0 && (() => {
                    const last = candles[candles.length - 1];
                    const y = toY(last.c);
                    return (
                      <g>
                        <line x1={ML} x2={W - MR} y1={y} y2={y} stroke="#F59E0B" strokeWidth={0.8} strokeDasharray="4 3" opacity={0.6} />
                        <rect x={W - MR - 58} y={y - 8} width={56} height={16} rx={3} fill="#F59E0B" />
                        <text x={W - MR - 30} y={y + 4} textAnchor="middle" fill="#000" fontSize="9" fontWeight="600" fontFamily="ui-monospace, monospace">{'$' + fp(last.c)}</text>
                      </g>
                    );
                  })()}
                </svg>
              );
            })()
          ) : data.length > 0 ? (
            /* Multi-line chart */
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={data} margin={{ top: 8, right: 65, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(data.length / 7))} />
                <YAxis domain={viewMode === 'pct' ? ['auto', 'auto'] : yDomain} tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'ui-monospace, monospace' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => viewMode === 'pct' ? (v >= 0 ? '+' : '') + v.toFixed(3) + '%' : '$' + fp(v)} width={viewMode === 'pct' ? 68 : 72} allowDataOverflow />
                <RTooltip content={<SpreadTooltip exList={exs} colorFn={ec} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeDasharray: '4 4' }} />
                {exs.map((e, i) => (
                  <Line key={e} type="monotone" dataKey={viewMode === 'pct' ? e + '_dev' : e} stroke={ec(e, i)} strokeWidth={2.5} dot={false}
                    activeDot={{ r: 4, fill: ec(e, i), stroke: '#0f0f14', strokeWidth: 2 }} connectNulls
                    style={{ filter: `drop-shadow(0 0 6px ${ec(e, i)}40)` }}
                    label={false} />
                ))}
                {/* Spread (A - B) line in % mode */}
                {viewMode === 'pct' && exs.length >= 2 && (
                  <Line type="monotone" dataKey="_spreadAB" stroke="#9ca3af" strokeWidth={1} dot={false}
                    strokeDasharray="4 3" connectNulls opacity={0.5} name={`Spread (${exs[0]} − ${exs[1]})`} />
                )}
                {/* Zero reference line in % mode */}
                {viewMode === 'pct' && (
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                )}
                {/* Right-side current price labels */}
                {data.length > 0 && exs.map((e, i) => {
                  const last = data[data.length - 1];
                  const val = viewMode === 'pct' ? last[e + '_dev'] as number : last[e] as number;
                  if (typeof val !== 'number') return null;
                  return (
                    <ReferenceLine key={'ref-' + e} y={val} stroke="none"
                      label={{ value: viewMode === 'pct' ? (val >= 0 ? '+' : '') + val.toFixed(3) + '%' : '$' + fp(val),
                        position: 'right', fill: ec(e, i), fontSize: 9, fontFamily: 'ui-monospace, monospace' }} />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[420px] flex flex-col items-center justify-center text-neutral-600">
              <Activity className="w-8 h-8 mb-2 text-neutral-700" />
              {tf === 'live' ? (
                <>
                  <p className="text-sm">Waiting for WebSocket data...</p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    {wsCount > 0 ? `${wsCount} exchanges connected. Chart builds every 5 seconds.` : 'Connecting to exchanges...'}
                  </p>
                  {wsHistory.length > 0 && <p className="text-[10px] text-neutral-600 mt-1">{wsHistory.length} snapshots collected, need 2+ to render</p>}
                </>
              ) : available && available.length > 0 ? (
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
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold">Spread History ({TFS.find(t => t.key === tf)?.label})</h2>
                  <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                    <button onClick={() => setSpreadUnit('usd')} className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${spreadUnit === 'usd' ? 'bg-white/[0.1] text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>USD</button>
                    <button onClick={() => setSpreadUnit('pct')} className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${spreadUnit === 'pct' ? 'bg-white/[0.1] text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>%</button>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  {exs.length === 2
                    ? `${sym} spread: ${exs[0]} vs ${exs[1]}`
                    : `Price spread between highest and lowest exchange. Across: ${exs.join(', ')}.`}
                </p>
              </div>
              {/* Spread Range Summary */}
              <div className="flex gap-4 sm:gap-6 flex-shrink-0">
                <div className="text-center sm:text-right">
                  <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Max Spread</p>
                  <p className="font-mono text-sm text-green-400">{spreadUnit === 'usd' ? '$' + fp(stats.max) : stats.maxPct.toFixed(3) + '%'}</p>
                  <p className="text-[9px] text-green-400/70">
                    {stats.maxHi} vs {stats.maxLo}
                  </p>
                  <p className="text-[9px] text-neutral-600">
                    {stats.maxT ? new Date(stats.maxT).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Average</p>
                  <p className="font-mono text-sm text-hub-yellow">{spreadUnit === 'usd' ? '$' + fp(stats.avg) : stats.avgPct.toFixed(3) + '%'}</p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Min Spread</p>
                  <p className="font-mono text-sm text-cyan-400">{spreadUnit === 'usd' ? '$' + fp(stats.min) : stats.minPct.toFixed(3) + '%'}</p>
                  <p className="text-[9px] text-cyan-400/70">
                    {stats.minHi} vs {stats.minLo}
                  </p>
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
                  tickFormatter={(v: number) => spreadUnit === 'usd' ? '$' + fp(v) : v.toFixed(3) + '%'} width={55} domain={[0, 'auto']} />
                <RTooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0]?.payload;
                  if (!pt) return null;
                  const spread = pt._spread || 0;
                  const spreadPct = pt._spreadPct || 0;
                  const p = exs.map(e => ({ e, p: pt[e] as number })).filter(x => typeof x.p === 'number' && x.p > 0).sort((a, b) => b.p - a.p);
                  return (
                    <div className="bg-[#141418] border border-white/[0.08] rounded-lg px-3 py-2 text-xs">
                      <p className="text-neutral-500 mb-1.5">{pt.label}</p>
                      <div className="flex justify-between gap-4 mb-1">
                        <span className="text-neutral-400">Spread</span>
                        <span className="font-mono text-hub-yellow font-bold">{'$'}{fp(spread)} ({spreadPct.toFixed(3)}%)</span>
                      </div>
                      {p.length >= 2 && (
                        <>
                          <div className="flex justify-between gap-4">
                            <span className="text-neutral-500">Highest</span>
                            <span className="font-mono text-green-400">{p[0].e} {'$'}{fp(p[0].p)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-neutral-500">Lowest</span>
                            <span className="font-mono text-red-400">{p[p.length-1].e} {'$'}{fp(p[p.length-1].p)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                }} />
                {/* Max spread line (top range) */}
                <ReferenceLine y={spreadUnit === 'usd' ? stats.max : stats.maxPct} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1}
                  label={{ value: 'MAX ' + (spreadUnit === 'usd' ? '$' + fp(stats.max) : stats.maxPct.toFixed(3) + '%'), position: 'right', fill: '#22c55e', fontSize: 8 }} />
                {/* Average spread line */}
                <ReferenceLine y={spreadUnit === 'usd' ? stats.avg : stats.avgPct} stroke="#F59E0B" strokeDasharray="3 3" strokeWidth={1}
                  label={{ value: 'AVG ' + (spreadUnit === 'usd' ? '$' + fp(stats.avg) : stats.avgPct.toFixed(3) + '%'), position: 'right', fill: '#F59E0B', fontSize: 8 }} />
                {/* Min spread line (bottom range) */}
                <ReferenceLine y={spreadUnit === 'usd' ? stats.min : stats.minPct} stroke="#06b6d4" strokeDasharray="6 3" strokeWidth={1}
                  label={{ value: 'MIN ' + (spreadUnit === 'usd' ? '$' + fp(stats.min) : stats.minPct.toFixed(3) + '%'), position: 'right', fill: '#06b6d4', fontSize: 8 }} />
                {/* Spread area fill */}
                <Area type="monotone" dataKey={spreadUnit === 'usd' ? '_spread' : '_spreadPct'} stroke="#F59E0B" fill="rgba(245,158,11,0.08)" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-neutral-600 mt-3 text-center">
              {spreadUnit === 'usd'
                ? `Spread ranges between $${fp(stats.min)} (min) and $${fp(stats.max)} (max). Average: $${fp(stats.avg)} over ${TFS.find(t => t.key === tf)?.label}.`
                : `Spread ranges between ${stats.minPct.toFixed(3)}% (min) and ${stats.maxPct.toFixed(3)}% (max). Average: ${stats.avgPct.toFixed(3)}% over ${TFS.find(t => t.key === tf)?.label}.`}
              {' '}Values above the green MAX line indicate unusual spread widening.
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-neutral-500">Trade size</label>
                  <div className="flex items-center gap-[2px] p-[2px] rounded-md bg-white/[0.03] border border-white/[0.06]">
                    <button onClick={() => setCalcMode('usd')}
                      className={`px-2 py-0.5 rounded text-[9px] font-semibold transition ${calcMode === 'usd' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600'}`}>USD</button>
                    <button onClick={() => setCalcMode('coin')}
                      className={`px-2 py-0.5 rounded text-[9px] font-semibold transition ${calcMode === 'coin' ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600'}`}>{sym}</button>
                  </div>
                </div>
                <div className="relative">
                  <input value={calcAmt} onChange={e => setCalcAmt(e.target.value)} type="number"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono outline-none focus:border-hub-yellow/30" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-600">{calcMode === 'usd' ? 'USD' : sym}</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">Fee per side (%)</label>
                <input value={calcFee} onChange={e => setCalcFee(e.target.value)} type="number" step="0.01"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono outline-none focus:border-hub-yellow/30" />
              </div>
              {stats && (() => {
                const rawAmt = Number(calcAmt) || 0;
                const midPrice = stats.prices.length > 0 ? stats.prices.reduce((s, p) => s + p.p, 0) / stats.prices.length : 1;
                const size = calcMode === 'coin' ? rawAmt * midPrice : rawAmt;
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
