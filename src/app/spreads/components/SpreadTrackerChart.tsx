'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Search, ChevronDown, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimeRange = '1h' | '4h' | '1d' | '7d' | '30d' | '90d';
type YAxisMode = '$' | '%' | 'bps';

interface RawPoint {
  t: number;
  price: number;
}

interface ChartRow {
  time: number;
  spread: number;
  spreadBps: number;
  spreadPct: number;
  min: number;
  max: number;
  median: number;
  [exchange: string]: number;
}

interface SpreadStats {
  current: { usd: number; bps: number; pct: number };
  avg: { usd: number; bps: number; pct: number };
  max: { usd: number; bps: number; time: number };
  min: { usd: number; bps: number; time: number };
  median: number;
}

interface ExchangeLabel {
  name: string;
  price: number;
  deviation: number; // % from median
  color: string;
}

export interface SpreadTrackerChartProps {
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXCHANGE_COLORS: Record<string, string> = {
  'Binance': '#2196F3',
  'Bybit': '#F59E0B',
  'OKX': '#10B981',
  'Bitget': '#8B5CF6',
  'Hyperliquid': '#06B6D4',
  'MEXC': '#EC4899',
  'Kraken': '#F97316',
  'dYdX': '#14B8A6',
  'Bitfinex': '#EF4444',
  'KuCoin': '#A855F7',
  'BingX': '#84CC16',
  'Phemex': '#FB923C',
};
const DEFAULT_COLOR = '#9CA3AF';

const DEFAULT_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid'];
const POPULAR_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK', 'AVAX', 'ADA', 'SUI', 'ARB'];

const TIME_RANGES: { key: TimeRange; label: string; days: number }[] = [
  { key: '1h', label: '1H', days: 0.042 },
  { key: '4h', label: '4H', days: 0.167 },
  { key: '1d', label: '1D', days: 1 },
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
];

const BUCKET_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPrice(val: number): string {
  if (val >= 10000) return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (val >= 100) return `$${val.toFixed(2)}`;
  if (val >= 1) return `$${val.toFixed(4)}`;
  if (val >= 0.01) return `$${val.toFixed(6)}`;
  return `$${val.toPrecision(4)}`;
}

function fmtSpread(val: number): string {
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

function fmtDateAxis(ts: number, range: TimeRange): string {
  const d = new Date(ts);
  if (range === '1h' || range === '4h' || range === '1d') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getColor(exchange: string): string {
  return EXCHANGE_COLORS[exchange] || DEFAULT_COLOR;
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function SpreadTooltip({ active, payload, selectedExchanges, yMode }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  const exchanges = selectedExchanges
    .map((ex: string) => ({ name: ex, price: row[ex] as number | undefined }))
    .filter((e: any) => e.price && e.price > 0)
    .sort((a: any, b: any) => b.price - a.price);

  return (
    <div className="bg-[#0e0e12] border border-white/[0.1] rounded-lg px-3 py-2.5 shadow-2xl max-w-[280px] backdrop-blur-sm">
      <p className="text-neutral-500 text-[10px] mb-1.5 font-mono">
        {row.time ? new Date(row.time).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }) : ''}
      </p>
      <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-white/[0.06]">
        <span className="text-neutral-500 text-[10px]">Spread</span>
        <span className="text-hub-yellow font-mono text-xs font-semibold">
          {fmtSpread(row.spread)}{' '}
          <span className="text-neutral-500 text-[9px]">
            ({row.spreadBps.toFixed(1)} bps)
          </span>
        </span>
      </div>
      {exchanges.map((e: any) => {
        const dev = row.median > 0 ? ((e.price - row.median) / row.median) * 100 : 0;
        return (
          <div key={e.name} className="flex items-center justify-between gap-3 py-[2px]">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: getColor(e.name) }}
              />
              <span className="text-neutral-300 text-[10px] truncate">{e.name}</span>
            </span>
            <span className="flex items-center gap-2 flex-shrink-0">
              <span className="text-white font-mono text-[10px]">{fmtPrice(e.price)}</span>
              <span className={`font-mono text-[9px] ${
                dev > 0 ? 'text-red-400' : dev < 0 ? 'text-green-400' : 'text-neutral-500'
              }`}>
                {dev >= 0 ? '+' : ''}{dev.toFixed(2)}%
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right-side labels (TradingView style)
// ---------------------------------------------------------------------------

function RightLabels({ labels, chartHeight }: { labels: ExchangeLabel[]; chartHeight: number }) {
  if (labels.length === 0) return null;
  const labelHeight = 24;
  const totalRequired = labels.length * labelHeight;
  const usableHeight = chartHeight - 40; // margin
  const startY = Math.max(10, (usableHeight - totalRequired) / 2);

  return (
    <div
      className="hidden md:flex flex-col gap-0.5 flex-shrink-0 pt-2"
      style={{ width: 160 }}
    >
      {labels.map((label, i) => (
        <div
          key={label.name}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md"
          style={{ backgroundColor: `${label.color}15` }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: label.color }}
          />
          <span className="text-[10px] font-medium truncate" style={{ color: label.color }}>
            {label.name}
          </span>
          <span className="text-[9px] font-mono text-white/70 ml-auto flex-shrink-0">
            {fmtPrice(label.price)}
          </span>
          <span className={`text-[8px] font-mono flex-shrink-0 ${
            label.deviation > 0 ? 'text-red-400' : label.deviation < 0 ? 'text-green-400' : 'text-neutral-500'
          }`}>
            {label.deviation >= 0 ? '+' : ''}{label.deviation.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SpreadTrackerChart({ compact = false }: SpreadTrackerChartProps) {
  // State
  const [symbol, setSymbol] = useState('BTC');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [yMode, setYMode] = useState<YAxisMode>('$');
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([...DEFAULT_EXCHANGES]);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [showExchangePicker, setShowExchangePicker] = useState(false);
  const [rawData, setRawData] = useState<Record<string, RawPoint[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allSymbols, setAllSymbols] = useState<string[]>(POPULAR_SYMBOLS);

  const exchangePickerRef = useRef<HTMLDivElement>(null);
  const symbolPickerRef = useRef<HTMLDivElement>(null);

  const chartHeight = compact ? 350 : 500;

  // Fetch symbols from tickers
  useEffect(() => {
    fetch('/api/tickers')
      .then(r => r.json())
      .then(d => {
        const data = d.data || d;
        const symSet = new Set<string>();
        data.forEach((t: any) => { if (t.symbol) symSet.add(t.symbol); });
        const syms = Array.from(symSet).sort();
        if (syms.length > 0) setAllSymbols(syms);
      })
      .catch(() => {});
  }, []);

  // Fetch price history
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rangeCfg = TIME_RANGES.find(r => r.key === timeRange)!;
      const days = Math.max(1, Math.ceil(rangeCfg.days));
      let exchanges: Record<string, RawPoint[]> | undefined;
      try {
        const res = await fetch(
          `/api/history/price-multi?symbol=${encodeURIComponent(symbol)}&days=${days}`
        );
        if (res.ok) {
          const json = await res.json();
          exchanges = json.exchanges as Record<string, RawPoint[]> | undefined;
        }
      } catch { /* DB unavailable, will fallback to tickers */ }

      if (!exchanges || Object.keys(exchanges).length === 0) {
        // Fallback: try current tickers
        const tickerRes = await fetch('/api/tickers');
        const tickerJson = await tickerRes.json();
        const tickerData = tickerJson.data || tickerJson;
        const matching = tickerData.filter(
          (t: any) => t.symbol === symbol && t.lastPrice > 0
        );
        if (matching.length >= 2) {
          const now = Date.now();
          const snapshot: Record<string, RawPoint[]> = {};
          matching.forEach((t: any) => {
            snapshot[t.exchange] = [{ t: now, price: t.lastPrice }];
          });
          setRawData(snapshot);
          const sorted = Object.keys(snapshot).sort();
          setAvailableExchanges(sorted);
          const overlap = selectedExchanges.filter(e => sorted.includes(e));
          if (overlap.length === 0) setSelectedExchanges(sorted.slice(0, 5));
        } else {
          setError(
            'Price history is accumulating. Mark prices are recorded every 10 minutes. ' +
            'Data will appear within a few hours.'
          );
          setRawData(null);
        }
      } else {
        // Filter by time window
        const now = Date.now();
        const windowMs = rangeCfg.days * 24 * 60 * 60 * 1000;
        const cutoff = now - windowMs;

        const filtered: Record<string, RawPoint[]> = {};
        for (const [ex, pts] of Object.entries(exchanges)) {
          const inRange = pts.filter(p => p.t >= cutoff);
          if (inRange.length > 0) filtered[ex] = inRange;
        }

        const useData = Object.keys(filtered).length > 0 ? filtered : exchanges;
        setRawData(useData);
        const sorted = Object.entries(useData)
          .filter(([, pts]) => pts.length > 0)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([ex]) => ex);
        setAvailableExchanges(sorted);
        const overlap = selectedExchanges.filter(e => sorted.includes(e));
        if (overlap.length === 0 && sorted.length > 0) {
          setSelectedExchanges(sorted.slice(0, Math.min(5, sorted.length)));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load price history');
      setRawData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close pickers on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exchangePickerRef.current && !exchangePickerRef.current.contains(e.target as Node))
        setShowExchangePicker(false);
      if (symbolPickerRef.current && !symbolPickerRef.current.contains(e.target as Node))
        setShowSymbolPicker(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Transform data
  const { chartData, stats, rightLabels } = useMemo(() => {
    const empty = {
      chartData: [] as ChartRow[],
      stats: null as SpreadStats | null,
      rightLabels: [] as ExchangeLabel[],
    };
    if (!rawData) return empty;

    const active = selectedExchanges.filter(ex => rawData[ex] && rawData[ex].length > 0);
    if (active.length < 2) return empty;

    // Bucket timestamps
    const bucket = (ts: number) => Math.round(ts / BUCKET_MS) * BUCKET_MS;
    const lookups: Record<string, Map<number, number>> = {};
    const bucketSet = new Set<number>();

    for (const ex of active) {
      const map = new Map<number, number>();
      for (const pt of rawData[ex]) {
        const b = bucket(pt.t);
        map.set(b, pt.price);
        bucketSet.add(b);
      }
      lookups[ex] = map;
    }

    const sortedTimes = Array.from(bucketSet).sort((a, b) => a - b);

    // Build rows with forward-fill
    const lastKnown: Record<string, number> = {};
    const rows: ChartRow[] = [];

    for (const ts of sortedTimes) {
      const prices: number[] = [];
      const row: ChartRow = {
        time: ts, spread: 0, spreadBps: 0, spreadPct: 0,
        min: 0, max: 0, median: 0,
      };

      for (const ex of active) {
        const val = lookups[ex].get(ts);
        if (val && val > 0) {
          lastKnown[ex] = val;
          row[ex] = val;
          prices.push(val);
        } else if (lastKnown[ex]) {
          row[ex] = lastKnown[ex];
          prices.push(lastKnown[ex]);
        }
      }

      if (prices.length >= 2) {
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const med = computeMedian(prices);
        row.min = minP;
        row.max = maxP;
        row.median = med;
        row.spread = maxP - minP;
        row.spreadBps = med > 0 ? ((maxP - minP) / med) * 10000 : 0;
        row.spreadPct = med > 0 ? ((maxP - minP) / med) * 100 : 0;

        // For % and bps modes, add deviation keys
        if (yMode !== '$') {
          for (const ex of active) {
            const p = row[ex] as number;
            if (p && med > 0) {
              const devPct = ((p - med) / med) * 100;
              row[`${ex}_dev`] = yMode === 'bps' ? devPct * 100 : devPct;
            }
          }
        }

        rows.push(row);
      }
    }

    if (rows.length === 0) return empty;

    // Stats
    const lastRow = rows[rows.length - 1];
    const spreads = rows.map(r => r.spread);
    const bpsSpreads = rows.map(r => r.spreadBps);
    const avgSpread = spreads.reduce((s, v) => s + v, 0) / spreads.length;
    const avgBps = bpsSpreads.reduce((s, v) => s + v, 0) / bpsSpreads.length;
    const avgPct = avgBps / 100;

    let maxIdx = 0, minIdx = 0;
    for (let i = 1; i < spreads.length; i++) {
      if (spreads[i] > spreads[maxIdx]) maxIdx = i;
      if (spreads[i] < spreads[minIdx]) minIdx = i;
    }

    const statsResult: SpreadStats = {
      current: { usd: lastRow.spread, bps: lastRow.spreadBps, pct: lastRow.spreadPct },
      avg: { usd: avgSpread, bps: avgBps, pct: avgPct },
      max: { usd: spreads[maxIdx], bps: bpsSpreads[maxIdx], time: rows[maxIdx].time },
      min: { usd: spreads[minIdx], bps: bpsSpreads[minIdx], time: rows[minIdx].time },
      median: lastRow.median,
    };

    // Right labels: sorted by current price
    const labels: ExchangeLabel[] = active
      .map(ex => {
        const price = lastRow[ex] as number;
        const dev = lastRow.median > 0 ? ((price - lastRow.median) / lastRow.median) * 100 : 0;
        return { name: ex, price, deviation: dev, color: getColor(ex) };
      })
      .filter(l => l.price > 0)
      .sort((a, b) => b.price - a.price);

    return { chartData: rows, stats: statsResult, rightLabels: labels };
  }, [rawData, selectedExchanges, yMode]);

  // Exchange toggle
  const toggleExchange = (ex: string) => {
    setSelectedExchanges(prev =>
      prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex]
    );
  };

  // Filtered symbol list
  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) {
      const popular = POPULAR_SYMBOLS.filter(s => allSymbols.includes(s));
      const rest = allSymbols.filter(s => !POPULAR_SYMBOLS.includes(s));
      return [...popular, ...rest].slice(0, 50);
    }
    return allSymbols
      .filter(s => s.toLowerCase().includes(symbolSearch.toLowerCase()))
      .slice(0, 30);
  }, [allSymbols, symbolSearch]);

  // Active exchanges for chart lines
  const activeForChart = selectedExchanges.filter(
    ex => rawData?.[ex] && rawData[ex].length > 0
  );

  // Y-axis config
  const getDataKey = (ex: string) => (yMode === '$' ? ex : `${ex}_dev`);
  const yTickFormatter = (val: number) => {
    if (yMode === '$') return fmtPrice(val);
    if (yMode === 'bps') return `${val.toFixed(0)}`;
    return `${val.toFixed(3)}%`;
  };
  const yLabel = yMode === '$' ? '' : yMode === 'bps' ? 'bps' : '% deviation';

  const rangeLabel = TIME_RANGES.find(r => r.key === timeRange)?.label ?? timeRange;

  // ---- Render ----
  return (
    <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Symbol Picker */}
          <div className="relative" ref={symbolPickerRef}>
            <button
              onClick={() => setShowSymbolPicker(!showSymbolPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors text-white font-semibold text-sm"
            >
              {symbol}
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            {showSymbolPicker && (
              <div className="absolute top-full mt-1 left-0 z-50 w-[200px] bg-[#111114] border border-white/[0.1] rounded-lg shadow-2xl overflow-hidden">
                <div className="p-2 border-b border-white/[0.06]">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600" />
                    <input
                      type="text"
                      value={symbolSearch}
                      onChange={e => setSymbolSearch(e.target.value)}
                      placeholder="Search symbol..."
                      className="w-full pl-7 pr-2 py-1.5 bg-white/[0.04] rounded text-[11px] text-white placeholder-neutral-600 outline-none border border-white/[0.06] focus:border-hub-yellow/30"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-[240px] overflow-y-auto scrollbar-thin">
                  {filteredSymbols.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setSymbol(s);
                        setShowSymbolPicker(false);
                        setSymbolSearch('');
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/[0.06] transition-colors ${
                        s === symbol
                          ? 'text-hub-yellow bg-hub-yellow/[0.06]'
                          : 'text-neutral-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white leading-none">
              Spread Tracker
            </h3>
            <span className="text-[10px] text-neutral-600">
              Cross-exchange price comparison
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Y-axis mode toggle */}
          {!compact && (
            <div className="flex bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.06]">
              {(['$', '%', 'bps'] as YAxisMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setYMode(mode)}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    yMode === mode
                      ? 'bg-hub-yellow/15 text-hub-yellow'
                      : 'text-neutral-600 hover:text-neutral-400'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}

          {/* Time Range */}
          <div className="flex bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.06]">
            {TIME_RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setTimeRange(r.key)}
                className={`px-2 py-1 text-[10px] font-semibold transition-colors ${
                  timeRange === r.key
                    ? 'bg-hub-yellow/15 text-hub-yellow'
                    : 'text-neutral-600 hover:text-neutral-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Exchange Selector */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {selectedExchanges.map(ex => (
          <button
            key={ex}
            onClick={() => toggleExchange(ex)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
            style={{ color: getColor(ex) }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: getColor(ex) }}
            />
            {ex}
            <X className="w-2.5 h-2.5 opacity-50" />
          </button>
        ))}

        <div className="relative" ref={exchangePickerRef}>
          <button
            onClick={() => setShowExchangePicker(!showExchangePicker)}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.1] text-neutral-500 hover:text-neutral-300 hover:border-white/[0.2] transition-colors"
          >
            + Exchange
          </button>
          {showExchangePicker && (
            <div className="absolute top-full mt-1 left-0 z-50 w-[200px] bg-[#111114] border border-white/[0.1] rounded-lg shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
                <span className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">
                  Exchanges
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedExchanges(availableExchanges.slice(0, 10))}
                    className="text-[9px] text-hub-yellow hover:text-hub-yellow/80"
                  >
                    Top 10
                  </button>
                  <button
                    onClick={() => setSelectedExchanges(availableExchanges)}
                    className="text-[9px] text-neutral-400 hover:text-neutral-300"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedExchanges([])}
                    className="text-[9px] text-neutral-600 hover:text-neutral-400"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-[280px] overflow-y-auto scrollbar-thin">
                {availableExchanges.map(ex => (
                  <button
                    key={ex}
                    onClick={() => toggleExchange(ex)}
                    className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-white/[0.04] flex items-center justify-between transition-colors ${
                      selectedExchanges.includes(ex) ? 'text-white' : 'text-neutral-500'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getColor(ex) }}
                      />
                      {ex}
                    </span>
                    {selectedExchanges.includes(ex) && (
                      <span className="text-hub-yellow text-[8px]">&#10003;</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <span className="text-[9px] text-neutral-700 ml-1">
          {activeForChart.length} of {availableExchanges.length} exchanges
        </span>
      </div>

      {/* Chart area */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: chartHeight }}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
            <span className="text-xs text-neutral-600">
              Loading price history for {symbol}...
            </span>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center" style={{ height: chartHeight }}>
          <div className="text-center max-w-sm">
            <p className="text-xs text-neutral-500">{error}</p>
          </div>
        </div>
      ) : chartData.length < 2 ? (
        <div className="flex items-center justify-center" style={{ height: chartHeight }}>
          <p className="text-xs text-neutral-600">
            Select at least 2 exchanges with data to compare prices
          </p>
        </div>
      ) : (
        <>
          <div className="flex">
            {/* Chart */}
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.03)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(ts: number) => fmtDateAxis(ts, timeRange)}
                    tick={{ fill: '#404040', fontSize: 10 }}
                    stroke="transparent"
                    minTickGap={60}
                  />
                  <YAxis
                    tickFormatter={yTickFormatter}
                    domain={yMode === '$' ? ['auto', 'auto'] : ['auto', 'auto']}
                    tick={{ fill: '#404040', fontSize: 10 }}
                    stroke="transparent"
                    width={yMode === '$' ? 72 : 55}
                  />
                  <RTooltip
                    content={
                      <SpreadTooltip
                        selectedExchanges={activeForChart}
                        yMode={yMode}
                      />
                    }
                    cursor={{
                      stroke: 'rgba(255,255,255,0.08)',
                      strokeDasharray: '3 3',
                    }}
                  />

                  {/* Spread band (shaded area between min and max) */}
                  {yMode === '$' && (
                    <>
                      <Area
                        dataKey="max"
                        stroke="none"
                        fill="rgba(234,179,8,0.05)"
                        type="monotone"
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                      <Area
                        dataKey="min"
                        stroke="none"
                        fill="#0a0a0a"
                        type="monotone"
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                    </>
                  )}

                  {/* Zero line for deviation modes */}
                  {yMode !== '$' && (
                    <ReferenceLine
                      y={0}
                      stroke="rgba(255,255,255,0.1)"
                      strokeDasharray="4 4"
                      label={{
                        value: 'median',
                        position: 'right',
                        fill: '#525252',
                        fontSize: 9,
                      }}
                    />
                  )}

                  {/* Exchange price lines */}
                  {activeForChart.map(ex => (
                    <Line
                      key={`${ex}-${yMode}`}
                      dataKey={getDataKey(ex)}
                      type="monotone"
                      stroke={getColor(ex)}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Right-side labels */}
            <RightLabels labels={rightLabels} chartHeight={chartHeight} />
          </div>

          {/* Stats Panel */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider mb-0.5">
                  Current Spread
                </p>
                <p className="text-sm font-mono font-semibold text-hub-yellow">
                  {fmtSpread(stats.current.usd)}
                </p>
                <p className="text-[9px] text-neutral-500 font-mono">
                  {stats.current.bps.toFixed(1)} bps &middot; {stats.current.pct.toFixed(3)}%
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider mb-0.5">
                  Avg Spread ({rangeLabel})
                </p>
                <p className="text-sm font-mono font-semibold text-white">
                  {fmtSpread(stats.avg.usd)}
                </p>
                <p className="text-[9px] text-neutral-500 font-mono">
                  {stats.avg.bps.toFixed(1)} bps &middot; {stats.avg.pct.toFixed(3)}%
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingUp className="w-3 h-3 text-red-400" />
                  <p className="text-[9px] text-neutral-600 uppercase tracking-wider">
                    Max Spread
                  </p>
                </div>
                <p className="text-sm font-mono font-semibold text-red-400">
                  {fmtSpread(stats.max.usd)}
                </p>
                <p className="text-[9px] text-neutral-500 font-mono">
                  {stats.max.bps.toFixed(1)} bps &middot;{' '}
                  {new Date(stats.max.time).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingDown className="w-3 h-3 text-green-400" />
                  <p className="text-[9px] text-neutral-600 uppercase tracking-wider">
                    Min Spread
                  </p>
                </div>
                <p className="text-sm font-mono font-semibold text-green-400">
                  {fmtSpread(stats.min.usd)}
                </p>
                <p className="text-[9px] text-neutral-500 font-mono">
                  {stats.min.bps.toFixed(1)} bps &middot;{' '}
                  {new Date(stats.min.time).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
