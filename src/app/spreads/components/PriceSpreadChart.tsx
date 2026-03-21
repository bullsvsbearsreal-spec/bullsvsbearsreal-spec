'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Search, ChevronDown, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimeRange = '1d' | '7d' | '30d';

interface RawPoint {
  t: number;
  price: number;
}

interface ChartRow {
  time: number;
  spread: number;
  spreadBps: number;
  min: number;
  max: number;
  [exchange: string]: number;
}

interface SpreadStats {
  current: { usd: number; bps: number };
  avg: { usd: number; bps: number };
  max: { usd: number; bps: number; time: number };
  min: { usd: number; bps: number; time: number };
  median: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXCHANGE_COLORS: Record<string, string> = {
  Binance: '#EAB308', Bybit: '#F97316', OKX: '#FFFFFF', Bitget: '#22D3EE',
  MEXC: '#14B8A6', Hyperliquid: '#4ADE80', dYdX: '#A855F7', Kraken: '#8B5CF6',
  BingX: '#3B82F6', KuCoin: '#22C55E', HTX: '#60A5FA', Coinbase: '#2563EB',
  Phemex: '#84CC16', Aster: '#EC4899', Lighter: '#34D399', Aevo: '#FB7185',
  Deribit: '#818CF8', Bitfinex: '#16A34A', WhiteBIT: '#D1D5DB', CoinEx: '#2DD4BF',
  gTrade: '#F59E0B', Bitunix: '#FB923C', GMX: '#38BDF8', Drift: '#A78BFA',
  'Gate.io': '#9CA3AF', Nado: '#FBBF24', Variational: '#C084FC',
  Orderly: '#67E8F9', Extended: '#F472B6', edgeX: '#34D399',
};

const POPULAR_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid', 'MEXC', 'Kraken', 'dYdX', 'Coinbase', 'HTX'];

const POPULAR_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK', 'AVAX', 'ADA', 'SUI', 'ARB'];

const TIME_RANGE_DAYS: Record<TimeRange, number> = { '1d': 1, '7d': 7, '30d': 30 };
const TIME_RANGE_LABELS: Record<TimeRange, string> = { '1d': '1D', '7d': '7D', '30d': '30D' };

const BUCKET_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(val: number): string {
  if (val >= 10000) return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (val >= 100) return `$${val.toFixed(2)}`;
  if (val >= 1) return `$${val.toFixed(4)}`;
  return `$${val.toPrecision(4)}`;
}

function formatSpread(val: number): string {
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

function formatDateAxis(ts: number, range: TimeRange): string {
  const d = new Date(ts);
  if (range === '1d') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, label, selectedExchanges }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const exchanges = selectedExchanges
    .map((ex: string) => ({ name: ex, price: row[ex] as number }))
    .filter((e: any) => e.price > 0)
    .sort((a: any, b: any) => b.price - a.price);

  return (
    <div className="bg-[#121216] border border-white/[0.1] rounded-lg px-3 py-2.5 shadow-xl max-w-[260px]">
      <p className="text-neutral-400 text-[10px] mb-1.5">
        {label ? new Date(label).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
      </p>
      <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-white/[0.06]">
        <span className="text-neutral-500 text-[10px]">Spread</span>
        <span className="text-hub-yellow font-mono text-xs font-semibold">
          {formatSpread(row.spread)} <span className="text-neutral-500 text-[9px]">({row.spreadBps.toFixed(1)} bps)</span>
        </span>
      </div>
      {exchanges.map((e: any) => (
        <div key={e.name} className="flex items-center justify-between gap-3 py-[1px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: EXCHANGE_COLORS[e.name] || '#6B7280' }} />
            <span className="text-neutral-300 text-[10px] truncate">{e.name}</span>
          </span>
          <span className="text-white font-mono text-[10px]">{formatPrice(e.price)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PriceSpreadChart() {
  // State
  const [symbol, setSymbol] = useState('BTC');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid']);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [showExchangePicker, setShowExchangePicker] = useState(false);
  const [rawData, setRawData] = useState<Record<string, RawPoint[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allSymbols, setAllSymbols] = useState<string[]>(POPULAR_SYMBOLS);
  const exchangePickerRef = useRef<HTMLDivElement>(null);
  const symbolPickerRef = useRef<HTMLDivElement>(null);

  // Fetch symbols from tickers
  useEffect(() => {
    fetch('/api/tickers')
      .then(r => r.json())
      .then(d => {
        const data = d.data || d;
        const symSet: Record<string, true> = {};
        data.forEach((t: any) => { symSet[t.symbol] = true; });
        const syms = Object.keys(symSet).sort();
        if (syms.length > 0) setAllSymbols(syms);
      })
      .catch(() => {});
  }, []);

  // Fetch price history
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const days = TIME_RANGE_DAYS[timeRange];
      const res = await fetch(`/api/history/price-multi?symbol=${encodeURIComponent(symbol)}&days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const exchanges = json.exchanges as Record<string, RawPoint[]> | undefined;
      if (!exchanges || Object.keys(exchanges).length === 0) {
        setError('Price history is accumulating. Mark prices are recorded every 10 minutes from all exchanges. Data will appear within a few hours.');
        setRawData(null);
      } else {
        setRawData(exchanges);
        // Set available exchanges (sorted by data point count)
        const sorted = Object.entries(exchanges)
          .filter(([, pts]) => pts.length > 0)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([ex]) => ex);
        setAvailableExchanges(sorted);
        // Auto-select top exchanges if current selection has no overlap
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
      if (exchangePickerRef.current && !exchangePickerRef.current.contains(e.target as Node)) setShowExchangePicker(false);
      if (symbolPickerRef.current && !symbolPickerRef.current.contains(e.target as Node)) setShowSymbolPicker(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Transform data
  const { chartData, stats } = useMemo(() => {
    if (!rawData) return { chartData: [] as ChartRow[], stats: null as SpreadStats | null };

    const active = selectedExchanges.filter(ex => rawData[ex] && rawData[ex].length > 0);
    if (active.length < 2) return { chartData: [] as ChartRow[], stats: null };

    // Bucket timestamps
    const bucket = (ts: number) => Math.round(ts / BUCKET_MS) * BUCKET_MS;
    const lookups: Record<string, Map<number, number>> = {};
    const bucketSet: Record<number, true> = {};

    for (const ex of active) {
      const map = new Map<number, number>();
      for (const pt of rawData[ex]) {
        const b = bucket(pt.t);
        map.set(b, pt.price);
        bucketSet[b] = true;
      }
      lookups[ex] = map;
    }

    const sortedTimes = Object.keys(bucketSet).map(Number).sort((a, b) => a - b);

    // Build rows with forward-fill
    const lastKnown: Record<string, number> = {};
    const rows: ChartRow[] = [];

    for (const ts of sortedTimes) {
      const prices: number[] = [];
      const row: ChartRow = { time: ts, spread: 0, spreadBps: 0, min: 0, max: 0 };

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
        const median = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];
        row.min = minP;
        row.max = maxP;
        row.spread = maxP - minP;
        row.spreadBps = median > 0 ? ((maxP - minP) / median) * 10000 : 0;
        rows.push(row);
      }
    }

    if (rows.length === 0) return { chartData: [], stats: null };

    // Calculate stats
    const lastRow = rows[rows.length - 1];
    const spreads = rows.map(r => r.spread);
    const bpsSpreads = rows.map(r => r.spreadBps);
    const avgSpread = spreads.reduce((s, v) => s + v, 0) / spreads.length;
    const avgBps = bpsSpreads.reduce((s, v) => s + v, 0) / bpsSpreads.length;

    let maxIdx = 0, minIdx = 0;
    for (let i = 1; i < spreads.length; i++) {
      if (spreads[i] > spreads[maxIdx]) maxIdx = i;
      if (spreads[i] < spreads[minIdx]) minIdx = i;
    }

    const medianPrice = rows[rows.length - 1]?.min
      ? (rows[rows.length - 1].min + rows[rows.length - 1].max) / 2
      : 0;

    const statsResult: SpreadStats = {
      current: { usd: lastRow.spread, bps: lastRow.spreadBps },
      avg: { usd: avgSpread, bps: avgBps },
      max: { usd: spreads[maxIdx], bps: bpsSpreads[maxIdx], time: rows[maxIdx].time },
      min: { usd: spreads[minIdx], bps: bpsSpreads[minIdx], time: rows[minIdx].time },
      median: medianPrice,
    };

    return { chartData: rows, stats: statsResult };
  }, [rawData, selectedExchanges]);

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
    return allSymbols.filter(s => s.toLowerCase().includes(symbolSearch.toLowerCase())).slice(0, 30);
  }, [allSymbols, symbolSearch]);

  // Active exchanges for rendering
  const activeForChart = selectedExchanges.filter(ex => rawData?.[ex] && rawData[ex].length > 0);

  // ---- Render ----
  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-2xl p-4 sm:p-5 mb-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
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
              <div className="absolute top-full mt-1 left-0 z-50 w-[180px] bg-[#141414] border border-white/[0.1] rounded-lg shadow-2xl overflow-hidden">
                <div className="p-2 border-b border-white/[0.06]">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600" />
                    <input
                      type="text" value={symbolSearch} onChange={e => setSymbolSearch(e.target.value)}
                      placeholder="Search..."
                      className="w-full pl-7 pr-2 py-1.5 bg-white/[0.04] rounded text-[11px] text-white placeholder-neutral-600 outline-none border border-white/[0.06] focus:border-hub-yellow/30"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto scrollbar-thin">
                  {filteredSymbols.map(s => (
                    <button key={s} onClick={() => { setSymbol(s); setShowSymbolPicker(false); setSymbolSearch(''); }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/[0.06] ${s === symbol ? 'text-hub-yellow bg-hub-yellow/[0.06]' : 'text-neutral-400'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <h3 className="text-sm font-semibold text-white">Price Spread</h3>
          <span className="text-[10px] text-neutral-600">Cross-exchange price comparison</span>
        </div>

        {/* Time Range */}
        <div className="flex gap-1">
          {(['1d', '7d', '30d'] as TimeRange[]).map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                timeRange === r ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-600 hover:text-neutral-400'
              }`}>
              {TIME_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Exchange Selector */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {selectedExchanges.map(ex => (
          <button key={ex} onClick={() => toggleExchange(ex)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
            style={{ color: EXCHANGE_COLORS[ex] || '#9CA3AF' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: EXCHANGE_COLORS[ex] || '#9CA3AF' }} />
            {ex}
            <X className="w-2.5 h-2.5 opacity-50" />
          </button>
        ))}

        {/* Add Exchange */}
        <div className="relative" ref={exchangePickerRef}>
          <button onClick={() => setShowExchangePicker(!showExchangePicker)}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/[0.1] text-neutral-500 hover:text-neutral-300 hover:border-white/[0.2] transition-colors">
            + Exchange
          </button>
          {showExchangePicker && (
            <div className="absolute top-full mt-1 left-0 z-50 w-[200px] bg-[#141414] border border-white/[0.1] rounded-lg shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
                <span className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">Exchanges</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedExchanges(availableExchanges.slice(0, 10))}
                    className="text-[9px] text-hub-yellow hover:text-hub-yellow/80">Top 10</button>
                  <button onClick={() => setSelectedExchanges([])}
                    className="text-[9px] text-neutral-600 hover:text-neutral-400">Clear</button>
                </div>
              </div>
              <div className="max-h-[250px] overflow-y-auto scrollbar-thin">
                {availableExchanges.map(ex => (
                  <button key={ex} onClick={() => toggleExchange(ex)}
                    className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-white/[0.04] flex items-center justify-between ${
                      selectedExchanges.includes(ex) ? 'text-white' : 'text-neutral-500'
                    }`}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: EXCHANGE_COLORS[ex] || '#6B7280' }} />
                      {ex}
                    </span>
                    {selectedExchanges.includes(ex) && <span className="text-hub-yellow text-[8px]">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <span className="text-[9px] text-neutral-700 ml-1">{activeForChart.length} of {availableExchanges.length} exchanges</span>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-[350px]">
          <div className="text-xs text-neutral-600 animate-pulse">Loading price history for {symbol}...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-[350px]">
          <div className="text-xs text-neutral-600">{error}</div>
        </div>
      ) : chartData.length < 2 ? (
        <div className="flex items-center justify-center h-[350px]">
          <div className="text-xs text-neutral-600">Select at least 2 exchanges with data to compare</div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="time" type="number" domain={['dataMin', 'dataMax']}
                tickFormatter={(ts: number) => formatDateAxis(ts, timeRange)}
                tick={{ fill: '#525252', fontSize: 10 }} stroke="transparent" minTickGap={50}
              />
              <YAxis
                tickFormatter={formatPrice} domain={['auto', 'auto']}
                tick={{ fill: '#525252', fontSize: 10 }} stroke="transparent" width={70}
              />
              <RTooltip
                content={<CustomTooltip selectedExchanges={activeForChart} />}
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeDasharray: '3 3' }}
              />

              {/* Spread band (shaded area between min and max) */}
              <Area
                dataKey="max" stroke="none" fill="rgba(234,179,8,0.06)"
                type="monotone" dot={false} activeDot={false} isAnimationActive={false}
              />
              <Area
                dataKey="min" stroke="none" fill="#0d0d0d"
                type="monotone" dot={false} activeDot={false} isAnimationActive={false}
              />

              {/* Exchange price lines */}
              {activeForChart.map(ex => (
                <Line
                  key={ex} dataKey={ex} type="monotone"
                  stroke={EXCHANGE_COLORS[ex] || '#6B7280'}
                  strokeWidth={1.5} dot={false} activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Spread Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="bg-white/[0.03] rounded-xl px-3 py-2">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Current Spread</p>
                <p className="text-sm font-mono font-semibold text-hub-yellow">{formatSpread(stats.current.usd)}</p>
                <p className="text-[9px] text-neutral-500 font-mono">{stats.current.bps.toFixed(1)} bps</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl px-3 py-2">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Avg Spread ({TIME_RANGE_LABELS[timeRange]})</p>
                <p className="text-sm font-mono font-semibold text-white">{formatSpread(stats.avg.usd)}</p>
                <p className="text-[9px] text-neutral-500 font-mono">{stats.avg.bps.toFixed(1)} bps</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl px-3 py-2">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Max Spread</p>
                <p className="text-sm font-mono font-semibold text-red-400">{formatSpread(stats.max.usd)}</p>
                <p className="text-[9px] text-neutral-500 font-mono">{stats.max.bps.toFixed(1)} bps · {new Date(stats.max.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl px-3 py-2">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Min Spread</p>
                <p className="text-sm font-mono font-semibold text-green-400">{formatSpread(stats.min.usd)}</p>
                <p className="text-[9px] text-neutral-500 font-mono">{stats.min.bps.toFixed(1)} bps · {new Date(stats.min.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
