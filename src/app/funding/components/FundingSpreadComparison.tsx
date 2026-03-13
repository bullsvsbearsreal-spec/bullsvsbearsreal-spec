'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeftRight, BarChart3, Search, ChevronDown, Calculator, DollarSign } from 'lucide-react';
import {
  LineChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { exchangeColors, ExchangeLogo } from '@/components/ExchangeLogos';

// ── Types ──

type TimeRange = '1d' | '3d' | '7d';
type ChartMode = 'funding' | 'price';

interface HistoryPoint { t: number; rate: number }
interface PricePoint { t: number; price: number }

interface ChartPoint {
  time: number;
  rateA: number | null;
  rateB: number | null;
  spread: number | null;
}

interface PriceChartPoint {
  time: number;
  priceA: number | null;
  priceB: number | null;
  gap: number | null;
}

interface SpreadStats {
  current: number | null;
  mean: number;
  min: number;
  max: number;
  count: number;
}

interface PriceGapStats {
  current: number | null;
  mean: number;
  min: number;
  max: number;
  count: number;
  currentPct: number | null;
  meanPct: number;
}

// ── Constants ──

const POPULAR_SYMBOLS = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'PEPE', 'SUI', 'ARB', 'HYPE', 'WIF'];
const TIME_RANGES: TimeRange[] = ['1d', '3d', '7d'];
const DAYS_MAP: Record<TimeRange, number> = { '1d': 1, '3d': 3, '7d': 7 };

function getExColor(exchange: string): string {
  return exchangeColors[exchange.toLowerCase()] || exchangeColors[exchange.toLowerCase().replace(/[. ]/g, '')] || '#888';
}

// ── Custom Exchange Dropdown ──

function ExchangeDropdown({
  value,
  onChange,
  exchanges,
  otherSelected,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  exchanges: string[];
  otherSelected: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const filtered = exchanges.filter(ex => {
    if (search && !ex.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const color = value ? getExColor(value) : '#555';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border text-sm text-white hover:bg-white/[0.06] transition-colors min-w-[140px]"
        style={{ borderColor: value ? color + '40' : 'rgba(255,255,255,0.06)' }}
      >
        {value ? (
          <>
            <ExchangeLogo exchange={value} size={18} />
            <span className="font-medium">{value}</span>
          </>
        ) : (
          <span className="text-neutral-500">{label}</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-neutral-500 ml-auto" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-52 bg-[#141414] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
          {exchanges.length > 5 && (
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 bg-transparent text-sm text-white border-b border-white/10 outline-none placeholder:text-neutral-600"
              autoFocus
            />
          )}
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {filtered.map(ex => {
              const isOther = ex === otherSelected;
              const isActive = ex === value;
              return (
                <button
                  key={ex}
                  onClick={() => { onChange(ex); setOpen(false); }}
                  disabled={isOther}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-white/[0.08] text-white font-medium'
                      : isOther
                        ? 'text-neutral-700 cursor-not-allowed'
                        : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <ExchangeLogo exchange={ex} size={16} className={isOther ? 'opacity-30' : ''} />
                  <span>{ex}</span>
                  {isOther && <span className="text-[10px] text-neutral-600 ml-auto">in use</span>}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-neutral-600">No exchanges found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tooltip ──

function SpreadTooltip({ active, payload, label, exchangeA, exchangeB }: any) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload as ChartPoint | undefined;
  if (!pt) return null;

  return (
    <div className="rounded-lg px-3 py-2.5 text-xs shadow-xl" style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="text-neutral-400 mb-1.5 font-medium">
        {new Date(label).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
      {pt.rateA != null && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getExColor(exchangeA) }} />
            <span className="text-neutral-300">{exchangeA}</span>
          </div>
          <span className="font-mono tabular-nums font-semibold" style={{ color: pt.rateA >= 0 ? '#34D399' : '#FB7185' }}>
            {pt.rateA >= 0 ? '+' : ''}{pt.rateA.toFixed(4)}%
          </span>
        </div>
      )}
      {pt.rateB != null && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getExColor(exchangeB) }} />
            <span className="text-neutral-300">{exchangeB}</span>
          </div>
          <span className="font-mono tabular-nums font-semibold" style={{ color: pt.rateB >= 0 ? '#34D399' : '#FB7185' }}>
            {pt.rateB >= 0 ? '+' : ''}{pt.rateB.toFixed(4)}%
          </span>
        </div>
      )}
      {pt.spread != null && (
        <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-white/10">
          <span className="text-neutral-400">Spread</span>
          <span className="font-mono tabular-nums font-bold" style={{ color: pt.spread >= 0 ? '#FBBF24' : '#F97316' }}>
            {pt.spread >= 0 ? '+' : ''}{pt.spread.toFixed(4)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ── Price Gap Tooltip ──

function PriceGapTooltip({ active, payload, label, exchangeA, exchangeB }: any) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload as PriceChartPoint | undefined;
  if (!pt) return null;

  const fmtPrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (p >= 1) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(6)}`;
  };

  return (
    <div className="rounded-lg px-3 py-2.5 text-xs shadow-xl" style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="text-neutral-400 mb-1.5 font-medium">
        {new Date(label).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
      {pt.priceA != null && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getExColor(exchangeA) }} />
            <span className="text-neutral-300">{exchangeA}</span>
          </div>
          <span className="font-mono tabular-nums font-semibold text-white">{fmtPrice(pt.priceA)}</span>
        </div>
      )}
      {pt.priceB != null && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getExColor(exchangeB) }} />
            <span className="text-neutral-300">{exchangeB}</span>
          </div>
          <span className="font-mono tabular-nums font-semibold text-white">{fmtPrice(pt.priceB)}</span>
        </div>
      )}
      {pt.gap != null && (
        <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-white/10">
          <span className="text-neutral-400">Gap</span>
          <span className="font-mono tabular-nums font-bold" style={{ color: pt.gap >= 0 ? '#FBBF24' : '#F97316' }}>
            {pt.gap >= 0 ? '+' : ''}{fmtPrice(Math.abs(pt.gap)).replace('$', pt.gap >= 0 ? '$' : '-$')}
            {pt.priceB != null && pt.priceB > 0 && (
              <span className="text-neutral-500 ml-1">({((pt.gap / pt.priceB) * 100).toFixed(3)}%)</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main component ──

export default function FundingSpreadComparison() {
  const [symbol, setSymbol] = useState('BTC');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [exchangeA, setExchangeA] = useState('');
  const [exchangeB, setExchangeB] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [chartMode, setChartMode] = useState<ChartMode>('funding');
  const [rawData, setRawData] = useState<Record<string, HistoryPoint[]>>({});
  const [priceData, setPriceData] = useState<Record<string, PricePoint[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionSize, setPositionSize] = useState<string>('');
  const [showCalc, setShowCalc] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close symbol search on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    }
    if (showSearch) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showSearch]);

  // Fetch data when symbol changes (always 7d to filter client-side)
  const fetchData = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const [fundingRes, priceRes] = await Promise.all([
        fetch(`/api/history/funding-multi?symbol=${sym}&days=7`),
        fetch(`/api/history/price-multi?symbol=${sym}&days=7`),
      ]);
      if (!fundingRes.ok) {
        const body = await fundingRes.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${fundingRes.status}`);
      }
      const fundingJson = await fundingRes.json();
      const exchanges: Record<string, HistoryPoint[]> = fundingJson.exchanges || {};
      setRawData(exchanges);

      // Price data (may be empty if mark_price not yet stored)
      if (priceRes.ok) {
        const priceJson = await priceRes.json();
        setPriceData(priceJson.exchanges || {});
      }

      // Auto-select widest spread pair
      const keys = Object.keys(exchanges).filter(k => (exchanges[k]?.length || 0) > 2);
      if (keys.length >= 2) {
        let bestA = keys[0], bestB = keys[1], bestSpread = 0;
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            const aArr = exchanges[keys[i]];
            const bArr = exchanges[keys[j]];
            const aLast = aArr[aArr.length - 1]?.rate || 0;
            const bLast = bArr[bArr.length - 1]?.rate || 0;
            const sp = Math.abs(aLast - bLast);
            if (sp > bestSpread) {
              bestSpread = sp;
              bestA = keys[i];
              bestB = keys[j];
            }
          }
        }
        setExchangeA(bestA);
        setExchangeB(bestB);
      } else if (keys.length === 1) {
        setExchangeA(keys[0]);
        setExchangeB('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(symbol); }, [symbol, fetchData]);

  const availableExchanges = useMemo(
    () => Object.keys(rawData).filter(k => (rawData[k]?.length || 0) > 0).sort(),
    [rawData]
  );

  // Build chart data with timestamp alignment
  const { chartData, stats } = useMemo(() => {
    if (!exchangeA || !exchangeB || !rawData[exchangeA] || !rawData[exchangeB]) {
      return { chartData: [], stats: null };
    }

    const cutoff = Date.now() - DAYS_MAP[timeRange] * 86400000;
    const BUCKET_MS = 30 * 60 * 1000; // 30 min buckets
    const round = (t: number) => Math.round(t / BUCKET_MS) * BUCKET_MS;

    // Index by rounded timestamp
    const mapA = new Map<number, number>();
    for (const p of rawData[exchangeA]) {
      if (p.t >= cutoff) mapA.set(round(p.t), p.rate);
    }
    const mapB = new Map<number, number>();
    for (const p of rawData[exchangeB]) {
      if (p.t >= cutoff) mapB.set(round(p.t), p.rate);
    }

    // Union of timestamps
    const allTimes = new Set([...Array.from(mapA.keys()), ...Array.from(mapB.keys())]);
    const sorted = Array.from(allTimes).sort((a, b) => a - b);

    const points: ChartPoint[] = [];
    const spreads: number[] = [];

    for (const t of sorted) {
      const a = mapA.get(t) ?? null;
      const b = mapB.get(t) ?? null;
      const sp = a != null && b != null ? a - b : null;
      if (sp != null) spreads.push(sp);
      points.push({ time: t, rateA: a, rateB: b, spread: sp });
    }

    const st: SpreadStats | null = spreads.length > 0
      ? {
          current: spreads[spreads.length - 1],
          mean: spreads.reduce((s, v) => s + v, 0) / spreads.length,
          min: Math.min(...spreads),
          max: Math.max(...spreads),
          count: spreads.length,
        }
      : null;

    return { chartData: points, stats: st };
  }, [rawData, exchangeA, exchangeB, timeRange]);

  // Build price gap chart data
  const { priceChartData, priceGapStats } = useMemo(() => {
    if (!exchangeA || !exchangeB || !priceData[exchangeA] || !priceData[exchangeB]) {
      return { priceChartData: [], priceGapStats: null };
    }

    const cutoff = Date.now() - DAYS_MAP[timeRange] * 86400000;
    const BUCKET_MS = 30 * 60 * 1000;
    const round = (t: number) => Math.round(t / BUCKET_MS) * BUCKET_MS;

    const mapA = new Map<number, number>();
    for (const p of priceData[exchangeA]) {
      if (p.t >= cutoff) mapA.set(round(p.t), p.price);
    }
    const mapB = new Map<number, number>();
    for (const p of priceData[exchangeB]) {
      if (p.t >= cutoff) mapB.set(round(p.t), p.price);
    }

    const allTimes = new Set([...Array.from(mapA.keys()), ...Array.from(mapB.keys())]);
    const sorted = Array.from(allTimes).sort((a, b) => a - b);

    const points: PriceChartPoint[] = [];
    const gaps: number[] = [];
    const gapPcts: number[] = [];

    for (const t of sorted) {
      const a = mapA.get(t) ?? null;
      const b = mapB.get(t) ?? null;
      const gap = a != null && b != null ? a - b : null;
      if (gap != null) {
        gaps.push(gap);
        const avgPrice = ((a ?? 0) + (b ?? 0)) / 2;
        if (avgPrice > 0) gapPcts.push((gap / avgPrice) * 100);
      }
      points.push({ time: t, priceA: a, priceB: b, gap });
    }

    const st: PriceGapStats | null = gaps.length > 0
      ? {
          current: gaps[gaps.length - 1],
          mean: gaps.reduce((s, v) => s + v, 0) / gaps.length,
          min: Math.min(...gaps),
          max: Math.max(...gaps),
          count: gaps.length,
          currentPct: gapPcts.length > 0 ? gapPcts[gapPcts.length - 1] : null,
          meanPct: gapPcts.length > 0 ? gapPcts.reduce((s, v) => s + v, 0) / gapPcts.length : 0,
        }
      : null;

    return { priceChartData: points, priceGapStats: st };
  }, [priceData, exchangeA, exchangeB, timeRange]);

  const hasPriceData = Object.keys(priceData).length > 0;

  const swapExchanges = () => {
    setExchangeA(exchangeB);
    setExchangeB(exchangeA);
  };

  const selectSymbol = (s: string) => {
    setSymbol(s);
    setSymbolSearch('');
    setShowSearch(false);
  };

  const filteredSymbols = symbolSearch
    ? POPULAR_SYMBOLS.filter(s => s.toLowerCase().includes(symbolSearch.toLowerCase()))
    : POPULAR_SYMBOLS;

  const colorA = getExColor(exchangeA);
  const colorB = getExColor(exchangeB);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Symbol selector */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white hover:bg-white/[0.06] transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <span className="font-semibold">{symbol}</span>
            </button>
            {showSearch && (
              <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-[#141414] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                <input
                  type="text"
                  value={symbolSearch}
                  onChange={e => setSymbolSearch(e.target.value.toUpperCase())}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && symbolSearch) selectSymbol(symbolSearch);
                    if (e.key === 'Escape') setShowSearch(false);
                  }}
                  placeholder="Search symbol..."
                  className="w-full px-3 py-2 bg-transparent text-sm text-white border-b border-white/10 outline-none placeholder:text-neutral-600"
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto overscroll-contain">
                  {filteredSymbols.map(s => (
                    <button
                      key={s}
                      onClick={() => selectSymbol(s)}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-white/[0.06] transition-colors ${s === symbol ? 'text-hub-yellow font-medium' : 'text-neutral-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                  {symbolSearch && !POPULAR_SYMBOLS.includes(symbolSearch) && (
                    <button
                      onClick={() => selectSymbol(symbolSearch)}
                      className="w-full px-3 py-1.5 text-left text-sm text-hub-yellow hover:bg-white/[0.06]"
                    >
                      Search &quot;{symbolSearch}&quot;
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Exchange A dropdown */}
          <ExchangeDropdown
            value={exchangeA}
            onChange={setExchangeA}
            exchanges={availableExchanges}
            otherSelected={exchangeB}
            label="Exchange A"
          />

          {/* Swap button */}
          <button
            onClick={swapExchanges}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Swap exchanges"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          {/* Exchange B dropdown */}
          <ExchangeDropdown
            value={exchangeB}
            onChange={setExchangeB}
            exchanges={availableExchanges}
            otherSelected={exchangeA}
            label="Exchange B"
          />

          {/* Chart mode toggle */}
          {hasPriceData && (
            <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
              <button
                onClick={() => setChartMode('funding')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  chartMode === 'funding' ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'
                }`}
              >
                Funding Spread
              </button>
              <button
                onClick={() => setChartMode('price')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  chartMode === 'price' ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'
                }`}
              >
                Price Gap
              </button>
            </div>
          )}

          {/* Time range */}
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06] ml-auto">
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === r ? 'bg-hub-yellow text-black' : 'text-neutral-600 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar — Funding Spread */}
      {chartMode === 'funding' && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Current Spread', value: stats.current },
            { label: 'Mean Spread', value: stats.mean },
            { label: 'Min Spread', value: stats.min },
            { label: 'Max Spread', value: stats.max },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#0d0d0d] border border-white/[0.06] rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-neutral-600 uppercase tracking-wide">{label}</p>
              <p
                className="text-sm font-mono font-bold mt-0.5"
                style={{ color: value != null ? (value >= 0 ? '#FBBF24' : '#F97316') : '#555' }}
              >
                {value != null ? `${value >= 0 ? '+' : ''}${value.toFixed(4)}%` : '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Stats bar — Price Gap */}
      {chartMode === 'price' && priceGapStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Current Gap', value: priceGapStats.current, pct: priceGapStats.currentPct },
            { label: `${timeRange} Avg Gap`, value: priceGapStats.mean, pct: priceGapStats.meanPct },
            { label: 'Min Gap', value: priceGapStats.min, pct: null },
            { label: 'Max Gap', value: priceGapStats.max, pct: null },
          ].map(({ label, value, pct }) => (
            <div key={label} className="bg-[#0d0d0d] border border-white/[0.06] rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-neutral-600 uppercase tracking-wide">{label}</p>
              <p
                className="text-sm font-mono font-bold mt-0.5"
                style={{ color: value != null ? (value >= 0 ? '#FBBF24' : '#F97316') : '#555' }}
              >
                {value != null ? `${value >= 0 ? '+' : ''}$${Math.abs(value).toFixed(2)}` : '—'}
              </p>
              {pct != null && (
                <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
                  {pct >= 0 ? '+' : ''}{pct.toFixed(3)}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Position Calculator (funding mode only) */}
      {chartMode === 'funding' && stats && stats.current != null && (
        <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowCalc(!showCalc)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <Calculator className="w-4 h-4" />
            <span className="font-medium">Position Calculator</span>
            <span className="text-[10px] text-neutral-600 ml-1">— see $ difference per funding</span>
            <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${showCalc ? 'rotate-180' : ''}`} />
          </button>

          {showCalc && (
            <div className="px-4 pb-4 border-t border-white/[0.04]">
              <div className="flex flex-wrap items-end gap-3 mt-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-[10px] text-neutral-600 uppercase tracking-wide mb-1 block">Position Size (USD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={positionSize}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9.]/g, '');
                        setPositionSize(v);
                      }}
                      placeholder="e.g. 10,000"
                      className="w-full pl-7 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white outline-none placeholder:text-neutral-700 focus:border-hub-yellow/30 transition-colors font-mono"
                    />
                  </div>
                </div>
                {/* Quick size buttons */}
                <div className="flex gap-1.5">
                  {['1000', '5000', '10000', '50000', '100000'].map(v => (
                    <button
                      key={v}
                      onClick={() => setPositionSize(v)}
                      className={`px-2 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        positionSize === v
                          ? 'bg-hub-yellow/10 text-hub-yellow border border-hub-yellow/20'
                          : 'bg-white/[0.03] text-neutral-600 border border-white/[0.04] hover:text-neutral-300'
                      }`}
                    >
                      {Number(v) >= 1000 ? `$${Number(v) / 1000}k` : `$${v}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              {(() => {
                const size = parseFloat(positionSize);
                if (!size || size <= 0) return null;
                const spreadPct = stats.current ?? 0;
                const meanPct = stats.mean;
                // Funding paid per period (hourly rates → per 8h period for context)
                const perHour = size * Math.abs(spreadPct) / 100;
                const per8h = perHour * 8;
                const perDay = perHour * 24;
                const perMonth = perDay * 30;
                const meanPerHour = size * Math.abs(meanPct) / 100;
                const meanPer8h = meanPerHour * 8;
                const meanPerDay = meanPerHour * 24;

                return (
                  <div className="mt-3 space-y-2">
                    {/* Current spread earnings */}
                    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                      <p className="text-[10px] text-neutral-600 uppercase tracking-wide mb-2">
                        Spread Earnings on ${size.toLocaleString()} position
                        <span className="text-neutral-700 normal-case ml-1">(current spread: {spreadPct >= 0 ? '+' : ''}{spreadPct.toFixed(4)}%)</span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Per Hour', amount: perHour },
                          { label: 'Per 8h', amount: per8h },
                          { label: 'Per Day', amount: perDay },
                          { label: 'Per Month', amount: perMonth },
                        ].map(({ label, amount }) => (
                          <div key={label}>
                            <p className="text-[10px] text-neutral-600">{label}</p>
                            <p className="text-sm font-mono font-bold text-emerald-400">
                              ${amount < 1 ? amount.toFixed(4) : amount < 100 ? amount.toFixed(2) : amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Average spread context */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <p className="text-[11px] text-neutral-500">
                        Based on <span className="text-neutral-400 font-medium">{timeRange}</span> avg spread ({meanPct >= 0 ? '+' : ''}{meanPct.toFixed(4)}%):
                        <span className="text-amber-400 font-mono font-bold ml-1.5">
                          ${meanPer8h < 1 ? meanPer8h.toFixed(4) : meanPer8h.toFixed(2)}/8h
                        </span>
                        <span className="text-neutral-600 mx-1">·</span>
                        <span className="text-amber-400 font-mono font-bold">
                          ${meanPerDay < 1 ? meanPerDay.toFixed(4) : meanPerDay.toFixed(2)}/day
                        </span>
                      </p>
                    </div>

                    <p className="text-[10px] text-neutral-700">
                      This shows the funding rate difference you&apos;d earn/pay by being long on one exchange and short on the other. Does not include trading fees.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-600">
            <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">{error}</p>
            <button onClick={() => fetchData(symbol)} className="mt-2 text-xs text-hub-yellow hover:underline">
              Try again
            </button>
          </div>
        )}

        {/* Funding Spread Chart */}
        {!loading && !error && chartMode === 'funding' && chartData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-600">
            <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">
              {availableExchanges.length < 2
                ? `Not enough exchange data for ${symbol}`
                : 'Select two exchanges to compare'}
            </p>
          </div>
        )}

        {!loading && !error && chartMode === 'funding' && chartData.length > 0 && (
          <>
            <div className="flex items-center gap-4 mb-3 text-xs">
              <div className="flex items-center gap-1.5">
                <ExchangeLogo exchange={exchangeA} size={14} />
                <span className="text-neutral-400">{exchangeA}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ExchangeLogo exchange={exchangeB} size={14} />
                <span className="text-neutral-400">{exchangeB}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-amber-400/50" />
                <span className="text-neutral-500">Spread (A − B)</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="spreadFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FBBF24" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#FBBF24" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t: number) => {
                    const d = new Date(t);
                    return timeRange === '1d'
                      ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  }}
                  stroke="transparent"
                  tick={{ fill: '#737373', fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(4)}%`}
                  stroke="transparent"
                  tick={{ fill: '#737373', fontSize: 11 }}
                  width={72}
                />
                <RechartsTooltip
                  content={<SpreadTooltip exchangeA={exchangeA} exchangeB={exchangeB} />}
                  cursor={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="spread" fill="url(#spreadFill)" stroke="#FBBF24" strokeWidth={1} strokeOpacity={0.4} connectNulls dot={false} activeDot={false} />
                <Line type="monotone" dataKey="rateA" stroke={colorA} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 3, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="rateB" stroke={colorB} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 3, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>

            <p className="text-[10px] text-neutral-700 mt-2 text-center">
              {stats?.count || 0} data points · 30-min resolution · up to 7 days history
            </p>
          </>
        )}

        {/* Price Gap Chart */}
        {!loading && !error && chartMode === 'price' && priceChartData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-600">
            <DollarSign className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No price history available yet</p>
            <p className="text-xs text-neutral-700 mt-1">Price data will start collecting after the next cron snapshot cycle</p>
          </div>
        )}

        {!loading && !error && chartMode === 'price' && priceChartData.length > 0 && (
          <>
            <div className="flex items-center gap-4 mb-3 text-xs">
              <div className="flex items-center gap-1.5">
                <ExchangeLogo exchange={exchangeA} size={14} />
                <span className="text-neutral-400">{exchangeA}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ExchangeLogo exchange={exchangeB} size={14} />
                <span className="text-neutral-400">{exchangeB}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-amber-400/50" />
                <span className="text-neutral-500">Price Gap (A − B)</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={priceChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FBBF24" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#FBBF24" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t: number) => {
                    const d = new Date(t);
                    return timeRange === '1d'
                      ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  }}
                  stroke="transparent"
                  tick={{ fill: '#737373', fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  stroke="transparent"
                  tick={{ fill: '#737373', fontSize: 11 }}
                  width={90}
                />
                <RechartsTooltip
                  content={<PriceGapTooltip exchangeA={exchangeA} exchangeB={exchangeB} />}
                  cursor={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <Line type="monotone" dataKey="priceA" stroke={colorA} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 3, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="priceB" stroke={colorB} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 3, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>

            {/* Gap area chart below the price chart */}
            <p className="text-[10px] text-neutral-500 mt-3 mb-1 ml-1">Price Gap (A − B)</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={priceChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gapAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FBBF24" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#FBBF24" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" hide />
                <YAxis
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  stroke="transparent"
                  tick={{ fill: '#737373', fontSize: 10 }}
                  width={50}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                {priceGapStats && (
                  <ReferenceLine y={priceGapStats.mean} stroke="#FBBF24" strokeDasharray="6 3" strokeOpacity={0.4} label={{ value: 'avg', position: 'right', fill: '#737373', fontSize: 10 }} />
                )}
                <Area type="monotone" dataKey="gap" fill="url(#gapAreaFill)" stroke="#FBBF24" strokeWidth={1.5} connectNulls dot={false} activeDot={false} />
              </LineChart>
            </ResponsiveContainer>

            <p className="text-[10px] text-neutral-700 mt-2 text-center">
              {priceGapStats?.count || 0} data points · 30-min resolution · up to 7 days history
            </p>
          </>
        )}
      </div>
    </div>
  );
}
