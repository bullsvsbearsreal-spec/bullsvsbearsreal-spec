'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import { RefreshCw, Search, Filter, ChevronDown, ChevronUp, Save, X, Star, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useFlash } from '@/hooks/useFlash';
import { TokenIconSimple } from '@/components/TokenIcon';
import DataFreshness from '@/components/DataFreshness';
import SoftAuthGate, { useAuthLimit } from '@/components/SoftAuthGate';
import { formatPrice, formatNumber, formatPercent, formatFundingRate, formatCompact } from '@/lib/utils/format';
import {
  type FilterCondition,
  type ScreenerPreset,
  getPresets,
  savePreset,
  deletePreset,
  FIELD_LABELS,
  DEFAULT_PRESETS,
} from '@/lib/storage/screenerPresets';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/storage/watchlist';

/* ─── Types ──────────────────────────────────────────────────────── */

interface ScreenerRow {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  avgFunding: number;
  fundingExchanges: number;
  totalOI: number;
  oiExchanges: number;
  oiChange24h: number;
  sentiment: string;
  sentimentColor: string;
}

type SortField = 'symbol' | 'price' | 'change24h' | 'volume24h' | 'avgFunding' | 'totalOI' | 'oiChange24h';

/* ─── Sentiment Engine ──────────────────────────────────────────── */

function deriveSentiment(change24h: number, oiChange: number, funding: number): { label: string; color: string } {
  const hasOiData = oiChange !== 0;

  // When OI change data is available, use full signal matrix
  if (hasOiData) {
    // Price up + OI up = fresh longs piling in
    if (change24h > 1 && oiChange > 3) return { label: 'FRESH LONGS', color: 'text-green-400 bg-green-500/10' };
    // Price down + OI up = new shorts stacking
    if (change24h < -1 && oiChange > 3) return { label: 'FRESH SHORTS', color: 'text-red-400 bg-red-500/10' };
    // Price up + OI down = short squeeze unwind
    if (change24h > 1 && oiChange < -3) return { label: 'SQUEEZE', color: 'text-emerald-400 bg-emerald-500/10' };
    // Price down + OI down = longs getting flushed
    if (change24h < -1 && oiChange < -3) return { label: 'FLUSHING', color: 'text-orange-400 bg-orange-500/10' };
    // Strong funding + rising OI = crowded trade
    if (funding > 0.03 && oiChange > 5) return { label: 'CROWDED', color: 'text-yellow-400 bg-yellow-500/10' };
  }

  // Signals that work without OI data (funding + price only)
  // Strong negative funding = panic selling
  if (funding < -0.03) return { label: 'PANIC', color: 'text-purple-400 bg-purple-500/10' };
  // Extremely strong positive funding = overheated longs
  if (funding > 0.05) return { label: 'CROWDED', color: 'text-yellow-400 bg-yellow-500/10' };
  // Strong moves with funding confirmation
  if (change24h > 5 && funding > 0) return { label: 'PUMPING', color: 'text-green-400 bg-green-500/10' };
  if (change24h < -5 && funding < 0) return { label: 'DUMPING', color: 'text-red-400 bg-red-500/10' };
  // Moderate directional
  if (change24h > 5) return { label: 'BULLISH', color: 'text-green-400/80 bg-green-500/8' };
  if (change24h < -5) return { label: 'BEARISH', color: 'text-red-400/80 bg-red-500/8' };
  // Mild directional
  if (change24h > 2) return { label: 'BID', color: 'text-green-400/70 bg-green-500/5' };
  if (change24h < -2) return { label: 'OFFERED', color: 'text-red-400/70 bg-red-500/5' };
  return { label: 'FLAT', color: 'text-neutral-500 bg-white/[0.02]' };
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function ScreenerPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const authLimit = useAuthLimit(20);
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('volume24h');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Filtering
  const [search, setSearch] = useState('');
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Presets
  const [presets, setPresets] = useState<ScreenerPreset[]>([]);
  const [presetName, setPresetName] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Watchlist state trigger
  const [wlTick, setWlTick] = useState(0);

  /* ─── Data Helpers ────────────────────────────────────────────── */

  const SKIP_VOLUME = useRef(new Set(['Gate.io', 'BitMEX', 'WhiteBIT', 'Coinbase']));
  const MAX_SANE_VOL = 10_000_000_000;

  interface RawTicker { symbol: string; exchange: string; lastPrice?: number; priceChangePercent24h?: number; change24h?: number; quoteVolume24h?: number }
  interface RawFunding { symbol: string; fundingRate?: number; fundingInterval?: string }
  interface RawOI { symbol: string; openInterestValue?: number }
  interface RawDelta { symbol: string; change24h?: number }

  const buildRows = useCallback((
    tickers: RawTicker[], funding: RawFunding[], oi: RawOI[], deltas: RawDelta[]
  ): ScreenerRow[] => {
    const tickerMap = new Map<string, { price: number; change: number; vol: number; count: number; volByExchange: Map<string, number> }>();
    tickers.forEach((t: RawTicker) => {
      const sym = t.symbol;
      const cur = tickerMap.get(sym) || { price: 0, change: 0, vol: 0, count: 0, volByExchange: new Map() };
      cur.price += t.lastPrice || 0;
      cur.change = t.priceChangePercent24h ?? t.change24h ?? cur.change;
      if (!SKIP_VOLUME.current.has(t.exchange)) {
        const rawVol = Number(t.quoteVolume24h) || 0;
        if (rawVol > 0 && rawVol <= MAX_SANE_VOL) {
          const existing = cur.volByExchange.get(t.exchange) || 0;
          if (rawVol > existing) cur.volByExchange.set(t.exchange, rawVol);
        }
      }
      cur.count++;
      tickerMap.set(sym, cur);
    });
    tickerMap.forEach((v) => {
      v.vol = Array.from(v.volByExchange.values()).reduce((sum, x) => sum + x, 0);
    });

    const fundingMap = new Map<string, { total: number; count: number }>();
    funding.forEach((f: RawFunding) => {
      const cur = fundingMap.get(f.symbol) || { total: 0, count: 0 };
      // Normalize to 8h basis for fair averaging across exchanges
      const mult = f.fundingInterval === '1h' ? 8 : f.fundingInterval === '4h' ? 2 : 1;
      cur.total += (f.fundingRate || 0) * mult;
      cur.count++;
      fundingMap.set(f.symbol, cur);
    });

    const oiMap = new Map<string, { total: number; count: number }>();
    oi.forEach((o: RawOI) => {
      const cur = oiMap.get(o.symbol) || { total: 0, count: 0 };
      cur.total += o.openInterestValue || 0;
      cur.count++;
      oiMap.set(o.symbol, cur);
    });

    const deltaMap = new Map<string, number>();
    deltas.forEach((d) => {
      if (d.symbol && d.change24h != null) deltaMap.set(d.symbol, d.change24h);
    });

    const allSymbols = new Set<string>();
    tickerMap.forEach((_, k) => allSymbols.add(k));
    fundingMap.forEach((_, k) => allSymbols.add(k));
    oiMap.forEach((_, k) => allSymbols.add(k));
    const merged: ScreenerRow[] = [];

    allSymbols.forEach((symbol) => {
      const t = tickerMap.get(symbol);
      const f = fundingMap.get(symbol);
      const o = oiMap.get(symbol);
      if (!t || t.count === 0) return;
      if (t.count < 2 && t.vol < 50_000) return;

      const change24h = t.change || 0;
      const avgFunding = f ? f.total / f.count : 0;
      const oiChange24h = deltaMap.get(symbol) || 0;
      const { label: sentiment, color: sentimentColor } = deriveSentiment(change24h, oiChange24h, avgFunding);
      const totalOI = o?.total || 0;
      let vol = t.vol;
      if (totalOI > 0 && vol > 500 * totalOI) vol = Math.min(vol, 10 * totalOI);

      merged.push({
        symbol, price: t.price / t.count, change24h, volume24h: vol,
        avgFunding, fundingExchanges: f?.count || 0,
        totalOI, oiExchanges: o?.count || 0, oiChange24h, sentiment, sentimentColor,
      });
    });
    return merged;
  }, []);

  /* ─── Data Fetching (progressive) ───────────────────────────── */

  // Cache refs so progressive updates can merge partial data
  const tickerCache = useRef<any[]>([]);
  const fundingCache = useRef<any[]>([]);
  const oiCache = useRef<any[]>([]);
  const deltaCache = useRef<any[]>([]);

  const hasData = useRef(false);
  const fetchData = useCallback(async () => {
    try {
      if (!hasData.current) setLoading(true);
      setError(null);

      // Fetch with 15s timeout to prevent hanging
      const fetchWithTimeout = (url: string, ms = 15000) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { signal: ctrl.signal })
          .then((r) => { clearTimeout(timer); return r.json(); })
          .catch(() => { clearTimeout(timer); return null; });
      };

      // Fetch all 4 APIs in parallel
      const [tickerRes, fundingRes, oiRes, deltaRes] = await Promise.all([
        fetchWithTimeout('/api/tickers'),
        fetchWithTimeout('/api/funding?assetClass=crypto'),
        fetchWithTimeout('/api/openinterest'),
        fetchWithTimeout('/api/oi-delta'),
      ]);

      // Update caches — only overwrite if new data is non-empty
      const newTickers = Array.isArray(tickerRes?.data) ? tickerRes.data : Array.isArray(tickerRes) ? tickerRes : [];
      const newFunding = Array.isArray(fundingRes?.data) ? fundingRes.data : [];
      const newOi = Array.isArray(oiRes?.data) ? oiRes.data : [];
      const newDelta = deltaRes?.data || deltaRes?.deltas || [];
      if (newTickers.length > 0) tickerCache.current = newTickers;
      if (newFunding.length > 0) fundingCache.current = newFunding;
      if (newOi.length > 0) oiCache.current = newOi;
      if (newDelta.length > 0) deltaCache.current = newDelta;

      const merged = buildRows(tickerCache.current, fundingCache.current, oiCache.current, deltaCache.current);
      setRows(merged);
      hasData.current = true;
      setLoading(false);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Unable to fetch screener data — check your connection or try again shortly.');
    } finally {
      setLoading(false);
    }
  }, [buildRows]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    setPresets([...DEFAULT_PRESETS, ...getPresets()]);
  }, []);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Scroll to top on page change (skip initial render)
  const isFirstPageRender = useRef(true);
  useEffect(() => {
    if (isFirstPageRender.current) { isFirstPageRender.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  /* ─── Filter + Sort ───────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = rows;

    // Search
    if (search) {
      const q = search.toUpperCase();
      result = result.filter((r) => r.symbol.includes(q));
    }

    // Conditions — map FilterCondition field names to ScreenerRow keys
    const fieldMap: Record<FilterCondition['field'], keyof ScreenerRow> = {
      fundingRate: 'avgFunding',
      openInterest: 'totalOI',
      change24h: 'change24h',
      volume24h: 'volume24h',
      price: 'price',
    };

    if (conditions.length > 0) {
      result = result.filter((r) => {
        return conditions.every((c) => {
          const val = r[fieldMap[c.field]] as number;
          return c.operator === 'gt' ? val > c.value : val < c.value;
        });
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const diff = (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? diff : -diff;
    });

    return result;
  }, [rows, search, conditions, sortField, sortDir]);

  const gatedFiltered = useMemo(() => {
    return authLimit ? filtered.slice(0, authLimit) : filtered;
  }, [filtered, authLimit]);

  const paged = useMemo(() => {
    return gatedFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [gatedFiltered, page]);

  const totalPages = Math.ceil(gatedFiltered.length / PAGE_SIZE);

  /* ─── Handlers ────────────────────────────────────────────────── */

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  const addCondition = () => {
    setConditions((prev) => [...prev, { field: 'fundingRate', operator: 'gt', value: 0 }]);
  };

  const updateCondition = (idx: number, updates: Partial<FilterCondition>) => {
    setConditions((prev) => prev.map((c, i) => (i === idx ? { ...c, ...updates } : c)));
  };

  const removeCondition = (idx: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyPreset = (preset: ScreenerPreset) => {
    setConditions([...preset.conditions]);
    setShowFilters(true);
    setPage(0);
  };

  const handleSavePreset = () => {
    if (!presetName.trim() || conditions.length === 0) return;
    const p: ScreenerPreset = { name: presetName.trim(), conditions: [...conditions] };
    savePreset(p);
    setPresets([...DEFAULT_PRESETS, ...getPresets()]);
    setPresetName('');
  };

  const handleDeletePreset = (name: string) => {
    deletePreset(name);
    setPresets([...DEFAULT_PRESETS, ...getPresets()]);
  };

  const toggleWatchlist = (symbol: string) => {
    if (isInWatchlist(symbol)) {
      removeFromWatchlist(symbol);
    } else {
      addToWatchlist(symbol);
    }
    setWlTick((t) => t + 1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-neutral-600" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-hub-yellow" />
    ) : (
      <ChevronDown className="w-3 h-3 text-hub-yellow" />
    );
  };

  /* ─── Stats ───────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const fundingRows = rows.filter((r) => r.avgFunding !== 0);
    const avgFunding = fundingRows.length > 0 ? fundingRows.reduce((s, r) => s + r.avgFunding, 0) / fundingRows.length : 0;
    const totalOI = rows.reduce((s, r) => s + r.totalOI, 0);
    const totalVol = rows.reduce((s, r) => s + r.volume24h, 0);
    const gainers = rows.filter((r) => r.change24h > 0).length;
    return { avgFunding, totalOI, totalVol, symbols: rows.length, gainers, losers: rows.length - gainers };
  }, [rows]);

  const oiFlash = useFlash(stats?.totalOI);
  const volFlash = useFlash(stats?.totalVol);

  /* ─── Render ──────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="heading-page">Screener</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {loading && rows.length === 0
                ? 'Scanning symbols across 26 exchanges...'
                : `Filter ${rows.length} symbols by funding, OI, volume, and price action`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DataFreshness exchangeCount={26} lastUpdated={lastUpdate} />
            <button
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh screener data"
              aria-busy={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Symbols</div>
              <div className="text-sm font-bold text-white font-mono">{stats.symbols.toLocaleString()}</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Total OI</div>
              <div className={`text-sm font-bold text-white font-mono ${oiFlash || ''}`}>{formatNumber(stats.totalOI)}</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Combined Volume</div>
              <div className={`text-sm font-bold text-white font-mono ${volFlash || ''}`}>{formatNumber(stats.totalVol)}</div>
              <div className="text-[9px] text-neutral-500 mt-0.5">Sum across all exchange-pairs</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Avg Funding</div>
              <div className={`text-sm font-bold font-mono ${stats.avgFunding > 0 ? 'text-green-400' : stats.avgFunding < 0 ? 'text-red-400' : 'text-neutral-300'}`}>
                {formatFundingRate(stats.avgFunding)}
              </div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5 text-green-500" /> Gainers
              </div>
              <div className="text-sm font-bold text-green-400 font-mono">{stats.gainers}</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                <TrendingDown className="w-2.5 h-2.5 text-red-500" /> Losers
              </div>
              <div className="text-sm font-bold text-red-400 font-mono">{stats.losers}</div>
            </div>
          </div>
        )}

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-2 mb-4" role="toolbar">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search symbol... (press /)"
              aria-label="Search symbols by name"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/30"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              conditions.length > 0
                ? 'bg-hub-yellow/10 text-hub-yellow border border-hub-yellow/20'
                : 'bg-white/[0.04] text-neutral-400 hover:text-white border border-white/[0.06]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters{conditions.length > 0 ? ` (${conditions.length})` : ''}
          </button>

          {/* Quick presets */}
          {presets.map((p) => {
            const isDefault = DEFAULT_PRESETS.some((d) => d.name === p.name);
            return (
              <div key={p.name} className="flex items-center group">
                <button
                  onClick={() => applyPreset(p)}
                  className={`py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06] transition-colors ${isDefault ? 'px-2.5' : 'pl-2.5 pr-1.5'}`}
                >
                  <span className="flex items-center gap-1">
                    {p.name}
                    {!isDefault && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); handleDeletePreset(p.name); }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDeletePreset(p.name); } }}
                        className="ml-0.5 text-neutral-600 hover:text-red-400 transition-colors"
                        title="Delete preset"
                        aria-label={`Delete ${p.name} preset`}
                      >
                        <X className="w-3 h-3" />
                      </span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}

          {conditions.length > 0 && (
            <button
              onClick={() => { setConditions([]); setShowFilters(false); setPage(0); }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Filter Conditions</h3>
              <button
                onClick={addCondition}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-hub-yellow/10 text-hub-yellow border border-hub-yellow/20 hover:bg-hub-yellow/20 transition-colors"
              >
                + Add Condition
              </button>
            </div>

            {conditions.length === 0 && (
              <p className="text-xs text-neutral-500">No conditions. Click &quot;Add Condition&quot; or select a preset above.</p>
            )}

            {conditions.map((c, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 mb-2">
                <select
                  aria-label="Filter field"
                  value={c.field}
                  onChange={(e) => updateCondition(idx, { field: e.target.value as FilterCondition['field'] })}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                >
                  {Object.entries(FIELD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter operator"
                  value={c.operator}
                  onChange={(e) => updateCondition(idx, { operator: e.target.value as 'gt' | 'lt' })}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                >
                  <option value="gt">{'>'}</option>
                  <option value="lt">{'<'}</option>
                </select>
                <input
                  type="number"
                  value={c.value}
                  onChange={(e) => updateCondition(idx, { value: parseFloat(e.target.value) || 0 })}
                  className="w-28 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                />
                <button onClick={() => removeCondition(idx)} className="text-neutral-500 hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Save preset */}
            {conditions.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 max-w-[200px] bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-neutral-500">
            {loading && rows.length === 0
              ? 'Loading...'
              : `Showing ${paged.length} of ${filtered.length} results${conditions.length > 0 ? ` (filtered from ${rows.length})` : ''}`}
          </span>
        </div>

        {/* Loading skeleton */}
        {loading && rows.length === 0 && (
          <div className="space-y-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        )}

        {/* Table (desktop) */}
        <div className="overflow-x-auto scrollbar-accent rounded-xl border border-white/[0.06] hidden md:block">
          <table className="w-full text-sm" aria-label="Cryptocurrency screener">
            <thead>
              <tr className="bg-hub-darker border-b border-white/[0.06] sticky top-0 z-10">
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-neutral-500 w-8">#</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-neutral-500 w-6"></th>
                {([
                  ['symbol', 'Symbol'],
                  ['price', 'Price'],
                  ['change24h', '24h %'],
                  ['volume24h', 'Volume 24h'],
                  ['avgFunding', 'Avg Funding'],
                  ['totalOI', 'Open Interest'],
                  ['oiChange24h', 'OI Chg 24h'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSort(field)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(field); } }}
                    className={`px-3 py-2.5 text-[11px] font-medium cursor-pointer hover:text-white transition-colors select-none focus:outline-none focus:ring-2 focus:ring-hub-yellow/20 ${
                      field === 'symbol' ? 'text-left' : 'text-right'
                    } ${sortField === field ? 'text-hub-yellow' : 'text-neutral-500'}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label} <SortIcon field={field} />
                    </span>
                  </th>
                ))}
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-neutral-500">Exchanges</th>
                <th className="text-center px-3 py-2.5 text-[11px] font-medium text-neutral-500">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row, idx) => {
                const rank = page * PAGE_SIZE + idx + 1;
                const matchesAll = conditions.length > 0;
                const inWl = isInWatchlist(row.symbol);
                return (
                  <tr
                    key={row.symbol}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button, a')) return;
                      router.push(`/symbol/${row.symbol}`);
                    }}
                    className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer ${
                      matchesAll ? 'bg-hub-yellow/[0.02]' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-[11px] text-neutral-600">{rank}</td>
                    <td className="px-1 py-2">
                      <button
                        onClick={() => toggleWatchlist(row.symbol)}
                        aria-label="Add to watchlist"
                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                          inWl ? 'text-hub-yellow' : 'text-neutral-700 hover:text-neutral-400'
                        }`}
                      >
                        <Star className="w-3 h-3" fill={inWl ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-semibold text-white">
                      <Link href={`/symbol/${row.symbol}`} className="hover:text-hub-yellow transition-colors inline-flex items-center gap-1.5">
                        <TokenIconSimple symbol={row.symbol} size={16} />
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-300 font-mono text-xs">{formatPrice(row.price)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`delta-badge text-[11px] ${
                        Math.abs(row.change24h) >= 10
                          ? (row.change24h >= 0 ? 'delta-badge-extreme-up' : 'delta-badge-extreme-down')
                          : (row.change24h >= 0 ? 'delta-badge-up' : 'delta-badge-down')
                      }`}>
                        {formatPercent(row.change24h)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-400 font-mono text-xs">{formatNumber(row.volume24h)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${
                      row.avgFunding > 0.01 ? 'text-green-400' : row.avgFunding < -0.01 ? 'text-red-400' : 'text-neutral-400'
                    }`}>
                      {row.avgFunding !== 0 ? formatFundingRate(row.avgFunding) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-400 font-mono text-xs">
                      {row.totalOI > 0 ? formatNumber(row.totalOI) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.oiChange24h !== 0 ? (
                        <span className={`delta-badge text-[10px] ${
                          Math.abs(row.oiChange24h) >= 15
                            ? (row.oiChange24h > 0 ? 'delta-badge-extreme-up' : 'delta-badge-extreme-down')
                            : (row.oiChange24h > 0 ? 'delta-badge-up' : row.oiChange24h < 0 ? 'delta-badge-down' : '')
                        }`}>
                          {row.oiChange24h > 0 ? '+' : ''}{row.oiChange24h.toFixed(1)}%
                        </span>
                      ) : <span className="text-neutral-600 font-mono text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-600 text-[11px]">
                      {row.fundingExchanges > 0 ? `${row.fundingExchanges}F` : ''}
                      {row.fundingExchanges > 0 && row.oiExchanges > 0 ? ' · ' : ''}
                      {row.oiExchanges > 0 ? `${row.oiExchanges}OI` : ''}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span aria-label={row.sentiment} className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide whitespace-nowrap ${row.sentimentColor}`}>
                        {row.sentiment}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-5 h-5 text-neutral-600" />
                      <span className="text-neutral-500 text-sm">
                        {search
                          ? 'No symbols match — try a different search'
                          : conditions.length > 0
                          ? 'No symbols match your filters — try adjusting criteria'
                          : 'No data available.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {paged.map((row, idx) => {
            const rank = page * PAGE_SIZE + idx + 1;
            const inWl = isInWatchlist(row.symbol);
            return (
              <div key={`m-${row.symbol}`} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-600 text-[11px] w-5">{rank}</span>
                    <Link href={`/symbol/${row.symbol}`} className="text-white font-semibold text-sm hover:text-hub-yellow transition-colors inline-flex items-center gap-1.5">
                      <TokenIconSimple symbol={row.symbol} size={16} />
                      {row.symbol}
                    </Link>
                    <span className={`delta-badge text-[10px] ${
                      Math.abs(row.change24h) >= 10
                        ? (row.change24h >= 0 ? 'delta-badge-extreme-up' : 'delta-badge-extreme-down')
                        : (row.change24h >= 0 ? 'delta-badge-up' : 'delta-badge-down')
                    }`}>
                      {formatPercent(row.change24h)}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleWatchlist(row.symbol)}
                    aria-label="Add to watchlist"
                    className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                      inWl ? 'text-hub-yellow' : 'text-neutral-700 hover:text-neutral-400'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" fill={inWl ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                  <div>
                    <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Price</span>
                    <div className="text-xs font-mono text-neutral-300">{formatPrice(row.price)}</div>
                  </div>
                  <div>
                    <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Vol 24h</span>
                    <div className="text-xs font-mono text-neutral-400">{formatNumber(row.volume24h)}</div>
                  </div>
                  <div>
                    <span className="text-neutral-600 text-[10px] uppercase tracking-wider">Funding</span>
                    <div className={`text-xs font-mono ${
                      row.avgFunding > 0.01 ? 'text-green-400' : row.avgFunding < -0.01 ? 'text-red-400' : 'text-neutral-400'
                    }`}>
                      {row.avgFunding !== 0 ? formatFundingRate(row.avgFunding) : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-600 text-[10px] uppercase tracking-wider">OI</span>
                    <div className="text-xs font-mono text-neutral-400">
                      {row.totalOI > 0 ? formatNumber(row.totalOI) : '—'}
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span aria-label={row.sentiment} className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide ${row.sentimentColor}`}>
                    {row.sentiment}
                  </span>
                  {row.oiChange24h !== 0 && (
                    <span className={`delta-badge text-[9px] ${row.oiChange24h > 0 ? 'delta-badge-up' : 'delta-badge-down'}`}>
                      OI {row.oiChange24h > 0 ? '+' : ''}{row.oiChange24h.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {paged.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-2">
                <Search className="w-5 h-5 text-neutral-600" />
                <span className="text-neutral-500 text-sm">
                  {search
                    ? 'No symbols match — try a different search'
                    : conditions.length > 0
                    ? 'No symbols match your filters — try adjusting criteria'
                    : 'No data available.'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter(i => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1)
              .reduce<(number | 'ellipsis')[]>((acc, i, idx, arr) => {
                if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                acc.push(i);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-1 text-neutral-600 text-xs">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                      page === item
                        ? 'bg-hub-yellow/15 text-hub-yellow border border-hub-yellow/20'
                        : 'bg-white/[0.04] text-neutral-400 hover:text-white'
                    }`}
                  >
                    {(item as number) + 1}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Auth gate for unauthenticated users */}
        <SoftAuthGate freeLimit={20} totalCount={filtered.length} dataLabel="symbols" />

        {/* Info Footer */}
        <div className="mt-6 bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl px-4 py-3 space-y-2.5">
          <p className="text-xs text-neutral-400">
            <span className="text-hub-yellow font-medium">Screener</span> aggregates real-time derivatives data from 26 exchanges (14 CEX + 12 DEX). Use filters and presets to find trading opportunities. Star symbols to add to your Watchlist.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-neutral-500 leading-relaxed">
            <div><span className="text-neutral-400 font-medium">Price</span> — averaged across all reporting exchanges</div>
            <div><span className="text-neutral-400 font-medium">Volume 24h</span> — summed per exchange, deduplicated, excludes wash-traded sources</div>
            <div><span className="text-neutral-400 font-medium">Avg Funding</span> — mean funding rate across all exchanges listing the symbol</div>
            <div><span className="text-neutral-400 font-medium">Open Interest</span> — total USD OI summed across all exchanges</div>
            <div><span className="text-neutral-400 font-medium">OI Chg 24h</span> — percentage change in total OI vs 24 hours ago (from DB snapshots)</div>
            <div><span className="text-neutral-400 font-medium">Sentiment</span> — derived from price move, OI change, and funding rate signals</div>
          </div>
          <div className="text-[10px] text-neutral-500 leading-relaxed">
            <span className="text-neutral-400 font-medium">Sources:</span>{' '}
            CEX: Binance, Bybit, OKX, Bitget, MEXC, Kraken, BingX, Phemex, Bitunix, KuCoin, HTX, Bitfinex, CoinEx, Deribit{' · '}
            DEX: Hyperliquid, dYdX, Aster, Lighter, Aevo, Drift, GMX, gTrade, Extended, Variational, edgeX, Nado{' · '}
            Refreshes every 30s
          </div>
        </div>
      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}
