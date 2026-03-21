'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApi } from '@/hooks/useSWRApi';
import { formatPrice, formatCompact, formatPercent } from '@/lib/utils/format';
import {
  Search, ChevronDown, X, TrendingUp, TrendingDown, Minus,
  ArrowRightLeft, Zap, Calculator, ExternalLink, RefreshCw,
  BarChart3, Info, Copy, Check,
} from 'lucide-react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TickerEntry {
  symbol: string;
  exchange: string;
  lastPrice: number;
  change24h: number;
  volume24h: number;
  quoteVolume24h: number;
}

interface PriceSnapshot {
  t: number;
  prices: Record<string, number>;
}

interface ChartRow {
  time: number;
  label: string;
  spread: number;
  spreadPct: number;
  median: number;
  min: number;
  max: number;
  [ex: string]: number | string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EXCHANGE_COLORS: Record<string, string> = {
  Binance: '#F0B90B', Bybit: '#F7A600', OKX: '#FFFFFF',
  Bitget: '#00C8B3', Hyperliquid: '#06B6D4', MEXC: '#2EBD85',
  Kraken: '#7B61FF', 'dYdX': '#6966FF', Bitfinex: '#97C554',
  KuCoin: '#23AF91', BingX: '#2B6AFF', Phemex: '#D4FF00',
  HTX: '#2B6AED', 'Gate.io': '#2354E6', Coinbase: '#0052FF',
  WhiteBIT: '#02C076', CoinEx: '#48D79E', Deribit: '#5FE1AC',
  Drift: '#E44AFF', GMX: '#4C85E0', Aster: '#A855F7',
  Lighter: '#FB923C', Nado: '#F43F5E', Aevo: '#818CF8',
  Extended: '#34D399', edgeX: '#FBBF24', Variational: '#F472B6',
  Orderly: '#38BDF8', Paradex: '#C084FC', Backpack: '#4ADE80',
};
const DEFAULT_COLOR = '#6B7280';

const PAIR_GROUPS = {
  Majors: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'TRX', 'AVAX', 'LINK', 'TON'],
  Alts: ['SUI', 'APT', 'NEAR', 'DOT', 'ARB', 'OP', 'MATIC', 'FIL', 'ATOM', 'INJ', 'HBAR', 'LTC'],
  Memes: ['PEPE', 'WIF', 'BONK', 'FLOKI', 'POPCAT', 'BRETT', 'MOG', 'MEW', 'TRUMP', 'PENGU', 'SPX', 'GOAT', 'FARTCOIN', 'TURBO', 'USELESS', 'MOODENG'],
};

const DEFAULT_EXCHANGES = ['Binance', 'Bybit'];
const MAX_EXCHANGES = 8;
const SNAPSHOT_INTERVAL = 15_000;
const MAX_SNAPSHOTS = 360; // 1.5h at 15s intervals

const TIMEFRAMES = [
  { key: '5m', label: '5M', ms: 5 * 60_000 },
  { key: '15m', label: '15M', ms: 15 * 60_000 },
  { key: '1h', label: '1H', ms: 60 * 60_000 },
  { key: '6h', label: '6H', ms: 6 * 60 * 60_000 },
] as const;
type TimeframeKey = typeof TIMEFRAMES[number]['key'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColor(ex: string): string {
  return EXCHANGE_COLORS[ex] || DEFAULT_COLOR;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function ExchangeSpreadsPage() {
  // ── State ──
  const [symbol, setSymbol] = useState('BTC');
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(DEFAULT_EXCHANGES);
  const [timeframe, setTimeframe] = useState<TimeframeKey>('15m');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [showExchangePicker, setShowExchangePicker] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [calcAmount, setCalcAmount] = useState('10000');
  const [calcFee, setCalcFee] = useState('0.1');

  // ── Refs ──
  const snapshots = useRef<PriceSnapshot[]>([]);
  const symbolPickerRef = useRef<HTMLDivElement>(null);
  const exchangePickerRef = useRef<HTMLDivElement>(null);

  // ── Fetch live tickers ──
  const { data: tickerData, isLoading, lastUpdate } = useApi<TickerEntry[]>({
    key: 'spreads-tickers',
    fetcher: async () => {
      const res = await fetch('/api/tickers');
      const json = await res.json();
      return (json.data || json) as TickerEntry[];
    },
    refreshInterval: SNAPSHOT_INTERVAL,
  });

  // ── Accumulate snapshots ──
  useEffect(() => {
    if (!tickerData || tickerData.length === 0) return;
    const now = Date.now();
    const prices: Record<string, number> = {};
    tickerData
      .filter(t => t.symbol === symbol && t.lastPrice > 0)
      .forEach(t => { prices[t.exchange] = t.lastPrice; });

    if (Object.keys(prices).length < 2) return;

    // Deduplicate: skip if last snapshot is < 10s ago
    const last = snapshots.current[snapshots.current.length - 1];
    if (last && now - last.t < 10_000) return;

    snapshots.current.push({ t: now, prices });
    if (snapshots.current.length > MAX_SNAPSHOTS) {
      snapshots.current = snapshots.current.slice(-MAX_SNAPSHOTS);
    }
  }, [tickerData, symbol]);

  // Reset snapshots on symbol change
  useEffect(() => { snapshots.current = []; }, [symbol]);

  // ── Derived: available exchanges for current symbol ──
  const { availableExchanges, currentPrices } = useMemo(() => {
    if (!tickerData) return { availableExchanges: [] as string[], currentPrices: {} as Record<string, TickerEntry> };
    const map: Record<string, TickerEntry> = {};
    tickerData
      .filter(t => t.symbol === symbol && t.lastPrice > 0)
      .forEach(t => {
        if (!map[t.exchange] || t.quoteVolume24h > map[t.exchange].quoteVolume24h) {
          map[t.exchange] = t;
        }
      });
    const sorted = Object.keys(map).sort((a, b) => (map[b].quoteVolume24h || 0) - (map[a].quoteVolume24h || 0));
    return { availableExchanges: sorted, currentPrices: map };
  }, [tickerData, symbol]);

  // ── Auto-select exchanges when they become available ──
  useEffect(() => {
    if (availableExchanges.length < 2) return;
    const valid = selectedExchanges.filter(e => availableExchanges.includes(e));
    if (valid.length < 2) {
      setSelectedExchanges(availableExchanges.slice(0, 2));
    }
  }, [availableExchanges]);

  // ── All symbols from tickers ──
  const allSymbols = useMemo(() => {
    if (!tickerData) return [];
    const counts: Record<string, number> = {};
    tickerData.forEach(t => { counts[t.symbol] = (counts[t.symbol] || 0) + 1; });
    return Object.entries(counts)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s);
  }, [tickerData]);

  // ── Current spread metrics ──
  const spreadInfo = useMemo(() => {
    const active = selectedExchanges.filter(e => currentPrices[e]);
    if (active.length < 2) return null;
    const prices = active.map(e => ({ exchange: e, price: currentPrices[e].lastPrice }));
    prices.sort((a, b) => b.price - a.price);
    const highest = prices[0];
    const lowest = prices[prices.length - 1];
    const spread = highest.price - lowest.price;
    const spreadPct = (spread / lowest.price) * 100;
    const spreadBps = spreadPct * 100;
    const med = median(prices.map(p => p.price));
    return { highest, lowest, spread, spreadPct, spreadBps, median: med, prices };
  }, [selectedExchanges, currentPrices]);

  // ── Chart data from snapshots ──
  const chartData = useMemo(() => {
    const tf = TIMEFRAMES.find(t => t.key === timeframe)!;
    const cutoff = Date.now() - tf.ms;
    const active = selectedExchanges.filter(e => availableExchanges.includes(e));
    if (active.length < 2) return [];

    const relevant = snapshots.current.filter(s => s.t >= cutoff);
    if (relevant.length === 0) return [];

    return relevant.map(snap => {
      const exPrices = active.map(e => snap.prices[e]).filter(Boolean);
      if (exPrices.length < 2) return null;
      const med = median(exPrices);
      const min = Math.min(...exPrices);
      const max = Math.max(...exPrices);
      const row: ChartRow = {
        time: snap.t,
        label: new Date(snap.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        spread: max - min,
        spreadPct: ((max - min) / min) * 100,
        median: med,
        min, max,
      };
      active.forEach(e => { row[e] = snap.prices[e] || 0; });
      return row;
    }).filter(Boolean) as ChartRow[];
  }, [selectedExchanges, availableExchanges, timeframe, tickerData]); // tickerData triggers re-render

  // ── Spread stats ──
  const spreadStats = useMemo(() => {
    if (chartData.length === 0) return null;
    const spreads = chartData.map(r => r.spread);
    const avg = spreads.reduce((a, b) => a + b, 0) / spreads.length;
    const max = Math.max(...spreads);
    const min = Math.min(...spreads);
    const maxRow = chartData.find(r => r.spread === max);
    const minRow = chartData.find(r => r.spread === min);
    const current = spreads[spreads.length - 1];
    const currentPct = chartData[chartData.length - 1]?.spreadPct || 0;
    return { avg, max, min, current, currentPct, maxTime: maxRow?.time, minTime: minRow?.time, points: chartData.length };
  }, [chartData]);

  // ── Exchange toggle ──
  const toggleExchange = useCallback((ex: string) => {
    setSelectedExchanges(prev => {
      if (prev.includes(ex)) return prev.length > 1 ? prev.filter(e => e !== ex) : prev;
      if (prev.length >= MAX_EXCHANGES) return prev;
      return [...prev, ex];
    });
  }, []);

  // ── Copy share URL ──
  const copyShareUrl = useCallback(() => {
    const url = `${window.location.origin}/spreads?s=${symbol}&ex=${selectedExchanges.join(',')}&tf=${timeframe}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  }, [symbol, selectedExchanges, timeframe]);

  // ── Close pickers on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (symbolPickerRef.current && !symbolPickerRef.current.contains(e.target as Node)) setShowSymbolPicker(false);
      if (exchangePickerRef.current && !exchangePickerRef.current.contains(e.target as Node)) setShowExchangePicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── URL params ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('s')) setSymbol(params.get('s')!);
    if (params.get('ex')) setSelectedExchanges(params.get('ex')!.split(',').slice(0, MAX_EXCHANGES));
    if (params.get('tf')) setTimeframe(params.get('tf') as TimeframeKey);
  }, []);

  // ── Arb profit calc ──
  const arbProfit = useMemo(() => {
    if (!spreadInfo) return null;
    const amount = parseFloat(calcAmount) || 0;
    const feePct = parseFloat(calcFee) || 0;
    const gross = amount * (spreadInfo.spreadPct / 100);
    const fees = amount * (feePct / 100) * 2; // buy + sell
    const net = gross - fees;
    return { gross, fees, net, roi: amount > 0 ? (net / amount) * 100 : 0 };
  }, [spreadInfo, calcAmount, calcFee]);

  // ── Filtered symbols for picker ──
  const filteredSymbols = useMemo(() => {
    const q = symbolSearch.toLowerCase();
    if (!q) {
      return Object.entries(PAIR_GROUPS).map(([group, symbols]) => ({
        group,
        symbols: symbols.filter(s => allSymbols.includes(s)),
      })).filter(g => g.symbols.length > 0);
    }
    const matched = allSymbols.filter(s => s.toLowerCase().includes(q));
    return [{ group: 'Results', symbols: matched.slice(0, 30) }];
  }, [symbolSearch, allSymbols]);

  // ── Custom tooltip ──
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as ChartRow;
    if (!row) return null;
    const active_ = selectedExchanges.filter(e => availableExchanges.includes(e));
    const entries = active_
      .map(e => ({ exchange: e, price: (row[e] as number) || 0 }))
      .filter(e => e.price > 0)
      .sort((a, b) => b.price - a.price);
    return (
      <div className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2.5 shadow-xl min-w-[220px]">
        <div className="text-[10px] text-neutral-500 mb-2">{row.label}</div>
        {entries.map(e => (
          <div key={e.exchange} className="flex items-center justify-between gap-4 py-[2px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: getColor(e.exchange) }} />
              <span className="text-[11px] text-neutral-300">{e.exchange}</span>
            </div>
            <span className="text-[11px] font-mono text-white">{formatPrice(e.price)}</span>
          </div>
        ))}
        <div className="border-t border-white/5 mt-1.5 pt-1.5 flex justify-between">
          <span className="text-[10px] text-neutral-500">Spread</span>
          <span className="text-[11px] font-mono text-hub-yellow">
            ${row.spread.toFixed(2)} ({row.spreadPct.toFixed(3)}%)
          </span>
        </div>
      </div>
    );
  };

  // ── Right-side labels (sorted by price) ──
  const rightLabels = useMemo(() => {
    const active = selectedExchanges.filter(e => currentPrices[e]);
    return active
      .map(e => {
        const t = currentPrices[e];
        const med = spreadInfo?.median || t.lastPrice;
        const devPct = ((t.lastPrice - med) / med) * 100;
        return { exchange: e, price: t.lastPrice, devPct, change24h: t.change24h };
      })
      .sort((a, b) => b.price - a.price);
  }, [selectedExchanges, currentPrices, spreadInfo]);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <ArrowRightLeft className="w-6 h-6 text-hub-yellow" />
              Exchange <span className="text-gradient">Spreads</span>
            </h1>
            <p className="text-neutral-600 text-sm mt-1">
              Real-time cross-exchange price comparison across {availableExchanges.length} exchanges
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-[10px] text-neutral-600">
                Updated {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
            <button onClick={copyShareUrl} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-neutral-400 hover:text-white text-xs transition">
              {copiedUrl ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copiedUrl ? 'Copied' : 'Share'}
            </button>
            <button onClick={() => setShowCalc(v => !v)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition ${showCalc ? 'bg-hub-yellow/10 border-hub-yellow/30 text-hub-yellow' : 'bg-white/[0.04] border-white/[0.06] text-neutral-400 hover:text-white'}`}>
              <Calculator className="w-3 h-3" />
              Arb Calc
            </button>
          </div>
        </div>

        {/* ── Controls Row ── */}
        <div className="flex flex-wrap items-center gap-3 mb-4">

          {/* Symbol Picker */}
          <div className="relative" ref={symbolPickerRef}>
            <button
              onClick={() => { setShowSymbolPicker(v => !v); setSymbolSearch(''); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-hub-yellow/30 transition min-w-[120px]"
            >
              <span className="font-bold text-white text-sm">{symbol}</span>
              <span className="text-neutral-500 text-xs">/USDT</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500 ml-auto" />
            </button>
            {showSymbolPicker && (
              <div className="absolute top-full mt-1 left-0 z-50 w-[260px] max-h-[360px] overflow-auto bg-[#0d1117] border border-white/[0.08] rounded-xl shadow-2xl">
                <div className="sticky top-0 bg-[#0d1117] p-2 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.04]">
                    <Search className="w-3.5 h-3.5 text-neutral-500" />
                    <input
                      autoFocus
                      value={symbolSearch}
                      onChange={e => setSymbolSearch(e.target.value)}
                      placeholder="Search symbol..."
                      className="bg-transparent text-sm text-white outline-none w-full placeholder:text-neutral-600"
                    />
                  </div>
                </div>
                {filteredSymbols.map(group => (
                  <div key={group.group}>
                    <div className="px-3 py-1.5 text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">{group.group}</div>
                    {group.symbols.map(s => (
                      <button
                        key={s}
                        onClick={() => { setSymbol(s); setShowSymbolPicker(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.04] flex items-center justify-between ${s === symbol ? 'text-hub-yellow' : 'text-neutral-300'}`}
                      >
                        <span className="font-medium">{s}</span>
                        {s === symbol && <Check className="w-3 h-3 text-hub-yellow" />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeframe Tabs */}
          <div className="flex items-center gap-[2px] p-[3px] rounded-lg bg-white/[0.03] border border-white/[0.06]">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                  timeframe === tf.key
                    ? 'bg-hub-yellow/15 text-hub-yellow'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Exchange Pills */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {selectedExchanges.map(ex => (
              <button
                key={ex}
                onClick={() => toggleExchange(ex)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition group"
              >
                <div className="w-2 h-2 rounded-full" style={{ background: getColor(ex) }} />
                <span className="text-neutral-300">{ex}</span>
                <X className="w-3 h-3 text-neutral-600 group-hover:text-red-400 transition" />
              </button>
            ))}
            <div className="relative" ref={exchangePickerRef}>
              <button
                onClick={() => { setShowExchangePicker(v => !v); setExchangeSearch(''); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] bg-white/[0.04] border border-dashed border-white/[0.12] text-neutral-500 hover:text-hub-yellow hover:border-hub-yellow/30 transition"
              >
                + Exchange
              </button>
              {showExchangePicker && (
                <div className="absolute top-full mt-1 right-0 z-50 w-[220px] max-h-[300px] overflow-auto bg-[#0d1117] border border-white/[0.08] rounded-xl shadow-2xl">
                  <div className="sticky top-0 bg-[#0d1117] p-2 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/[0.04]">
                      <Search className="w-3 h-3 text-neutral-500" />
                      <input
                        autoFocus
                        value={exchangeSearch}
                        onChange={e => setExchangeSearch(e.target.value)}
                        placeholder="Search..."
                        className="bg-transparent text-xs text-white outline-none w-full placeholder:text-neutral-600"
                      />
                    </div>
                  </div>
                  {availableExchanges
                    .filter(e => !exchangeSearch || e.toLowerCase().includes(exchangeSearch.toLowerCase()))
                    .map(ex => (
                      <button
                        key={ex}
                        onClick={() => { toggleExchange(ex); if (selectedExchanges.length >= MAX_EXCHANGES - 1) setShowExchangePicker(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.04] flex items-center justify-between ${
                          selectedExchanges.includes(ex) ? 'text-hub-yellow' : 'text-neutral-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: getColor(ex) }} />
                          <span>{ex}</span>
                        </div>
                        {selectedExchanges.includes(ex) && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <span className="text-[10px] text-neutral-600 ml-1">
              {selectedExchanges.length} of {availableExchanges.length}
            </span>
          </div>
        </div>

        {/* ── Spread Hero + Arb Calc ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 mb-4">
          {/* Spread Hero */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 sm:p-5">
            {spreadInfo ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="text-neutral-500 text-xs mb-1 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-hub-yellow" />
                    {selectedExchanges.length === 2 ? (
                      <span>{spreadInfo.highest.exchange} vs {spreadInfo.lowest.exchange}</span>
                    ) : (
                      <span>Max spread across {selectedExchanges.length} exchanges</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className={`text-3xl sm:text-4xl font-bold font-mono ${spreadInfo.spread > 0 ? 'text-green-400' : 'text-neutral-400'}`}>
                      ${spreadInfo.spread.toFixed(2)}
                    </span>
                    <span className={`text-lg font-mono ${spreadInfo.spreadPct > 0.01 ? 'text-green-400' : 'text-neutral-500'}`}>
                      {spreadInfo.spreadPct.toFixed(4)}%
                    </span>
                    <span className="text-xs text-neutral-600 font-mono">
                      ({spreadInfo.spreadBps.toFixed(1)} bps)
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 text-xs">
                  <div className="text-center">
                    <div className="text-neutral-600 mb-0.5 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-green-500" /> Highest
                    </div>
                    <div className="font-mono text-white font-semibold">{formatPrice(spreadInfo.highest.price)}</div>
                    <div className="text-neutral-500" style={{ color: getColor(spreadInfo.highest.exchange) }}>{spreadInfo.highest.exchange}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-neutral-600 mb-0.5 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-red-500" /> Lowest
                    </div>
                    <div className="font-mono text-white font-semibold">{formatPrice(spreadInfo.lowest.price)}</div>
                    <div className="text-neutral-500" style={{ color: getColor(spreadInfo.lowest.exchange) }}>{spreadInfo.lowest.exchange}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-neutral-600 text-sm text-center py-4">
                {isLoading ? 'Loading prices...' : 'Select at least 2 exchanges to compare'}
              </div>
            )}
          </div>

          {/* Arb Calculator (collapsible) */}
          {showCalc && spreadInfo && (
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 w-full lg:w-[260px]">
              <div className="text-xs text-neutral-500 mb-3 font-semibold flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-hub-yellow" /> Quick Arb Calculator
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-neutral-600">Trade Size ($)</label>
                  <input
                    value={calcAmount}
                    onChange={e => setCalcAmount(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm font-mono text-white outline-none focus:border-hub-yellow/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-600">Fee per side (%)</label>
                  <input
                    value={calcFee}
                    onChange={e => setCalcFee(e.target.value)}
                    className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm font-mono text-white outline-none focus:border-hub-yellow/30"
                  />
                </div>
                {arbProfit && (
                  <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-500">Gross</span>
                      <span className="text-green-400 font-mono">${arbProfit.gross.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-500">Fees (2x)</span>
                      <span className="text-red-400 font-mono">-${arbProfit.fees.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t border-white/[0.04]">
                      <span className="text-neutral-300">Net Profit</span>
                      <span className={`font-mono ${arbProfit.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${arbProfit.net.toFixed(2)} ({arbProfit.roi.toFixed(3)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Main Chart + Right Labels ── */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 mb-4">
          <div className="flex gap-4">
            {/* Chart */}
            <div className="flex-1 min-w-0">
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={420}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#4b5563', fontSize: 10 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={['dataMin', 'dataMax']}
                      tick={{ fill: '#4b5563', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => formatPrice(v)}
                      width={70}
                    />
                    <RTooltip content={<CustomTooltip />} />
                    {/* Spread band */}
                    <Area dataKey="max" stroke="none" fill="rgba(234,179,8,0.06)" />
                    <Area dataKey="min" stroke="none" fill="#0b0e1a" />
                    {/* Exchange price lines */}
                    {selectedExchanges
                      .filter(e => availableExchanges.includes(e))
                      .map(ex => (
                        <Line
                          key={ex}
                          type="monotone"
                          dataKey={ex}
                          stroke={getColor(ex)}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: getColor(ex), stroke: '#0b0e1a', strokeWidth: 2 }}
                          connectNulls
                        />
                      ))}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[420px] flex flex-col items-center justify-center text-neutral-600">
                  <BarChart3 className="w-10 h-10 mb-3 text-neutral-700" />
                  <p className="text-sm mb-1">Accumulating price data...</p>
                  <p className="text-[10px] text-neutral-700">
                    {snapshots.current.length} snapshot{snapshots.current.length !== 1 ? 's' : ''} collected, need 2+ to render chart.
                    Updates every 15s.
                  </p>
                </div>
              )}
            </div>

            {/* Right Labels */}
            <div className="hidden md:flex flex-col gap-1.5 min-w-[160px] pt-2">
              <div className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold mb-1">Live Prices</div>
              {rightLabels.map(l => (
                <div
                  key={l.exchange}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition"
                  style={{ background: `${getColor(l.exchange)}10`, borderLeft: `3px solid ${getColor(l.exchange)}` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-white truncate">{l.exchange}</div>
                    <div className="text-[10px] font-mono text-neutral-400">{formatPrice(l.price)}</div>
                  </div>
                  <div className={`text-[10px] font-mono font-semibold ${l.devPct > 0 ? 'text-green-400' : l.devPct < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                    {l.devPct >= 0 ? '+' : ''}{l.devPct.toFixed(3)}%
                  </div>
                </div>
              ))}
              <div className="mt-2 px-2 text-[9px] text-neutral-700">
                Session data, refreshes every 15s
              </div>
            </div>
          </div>
        </div>

        {/* ── Spread Stats ── */}
        {spreadStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <div className="text-[10px] text-neutral-600 mb-1">Current Spread</div>
              <div className="text-lg font-bold font-mono text-white">${spreadStats.current.toFixed(2)}</div>
              <div className="text-[10px] font-mono text-hub-yellow">{spreadStats.currentPct.toFixed(4)}%</div>
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <div className="text-[10px] text-neutral-600 mb-1">Avg Spread</div>
              <div className="text-lg font-bold font-mono text-neutral-300">${spreadStats.avg.toFixed(2)}</div>
              <div className="text-[10px] text-neutral-600">{spreadStats.points} snapshots</div>
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <div className="text-[10px] text-neutral-600 mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-500" /> Max Spread
              </div>
              <div className="text-lg font-bold font-mono text-green-400">${spreadStats.max.toFixed(2)}</div>
              {spreadStats.maxTime && <div className="text-[10px] text-neutral-600">{new Date(spreadStats.maxTime).toLocaleTimeString()}</div>}
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <div className="text-[10px] text-neutral-600 mb-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-500" /> Min Spread
              </div>
              <div className="text-lg font-bold font-mono text-red-400">${spreadStats.min.toFixed(2)}</div>
              {spreadStats.minTime && <div className="text-[10px] text-neutral-600">{new Date(spreadStats.minTime).toLocaleTimeString()}</div>}
            </div>
          </div>
        )}

        {/* ── Related Pages + Info ── */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-2.5 flex-1">
              <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
              <div className="text-[11px] text-neutral-500 leading-relaxed">
                <span className="text-hub-yellow font-medium">Live prices</span> from {availableExchanges.length} exchanges, updated every 15 seconds.
                Chart accumulates data during your session. Spread = highest price minus lowest price across selected exchanges.
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a href="/funding" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-neutral-400 hover:text-hub-yellow hover:border-hub-yellow/20 transition">
                <Zap className="w-3 h-3" /> Funding Rates
              </a>
              <a href="/basis" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-neutral-400 hover:text-hub-yellow hover:border-hub-yellow/20 transition">
                <BarChart3 className="w-3 h-3" /> Basis Trades
              </a>
              <a href="/execution-costs" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-neutral-400 hover:text-hub-yellow hover:border-hub-yellow/20 transition">
                <ArrowRightLeft className="w-3 h-3" /> Execution Costs
              </a>
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}
