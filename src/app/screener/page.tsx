'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { RefreshCw, Search, Filter, ChevronDown, ChevronUp, Save, X, Star, AlertTriangle } from 'lucide-react';
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
}

type SortField = 'symbol' | 'price' | 'change24h' | 'volume24h' | 'avgFunding' | 'totalOI';

/* ─── Component ──────────────────────────────────────────────────── */

export default function ScreenerPage() {
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

  /* ─── Data Fetching ───────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tickerRes, fundingRes, oiRes] = await Promise.all([
        fetch('/api/tickers').then((r) => r.json()),
        fetch('/api/funding?assetClass=crypto').then((r) => r.json()),
        fetch('/api/openinterest').then((r) => r.json()),
      ]);

      const tickers: any[] = tickerRes?.data || [];
      const funding: any[] = fundingRes?.data || [];
      const oi: any[] = oiRes?.data || [];

      // Build ticker map (aggregate by symbol)
      const tickerMap = new Map<string, { price: number; change: number; vol: number; count: number }>();
      tickers.forEach((t: any) => {
        const sym = t.symbol;
        const cur = tickerMap.get(sym) || { price: 0, change: 0, vol: 0, count: 0 };
        cur.price += t.lastPrice || 0;
        cur.change = t.priceChangePercent24h ?? t.change24h ?? cur.change;
        cur.vol += t.quoteVolume24h || 0;
        cur.count++;
        tickerMap.set(sym, cur);
      });

      // Build funding map (average by symbol)
      const fundingMap = new Map<string, { total: number; count: number }>();
      funding.forEach((f: any) => {
        const cur = fundingMap.get(f.symbol) || { total: 0, count: 0 };
        cur.total += f.fundingRate || 0;
        cur.count++;
        fundingMap.set(f.symbol, cur);
      });

      // Build OI map (sum USD values by symbol)
      const oiMap = new Map<string, { total: number; count: number }>();
      oi.forEach((o: any) => {
        const cur = oiMap.get(o.symbol) || { total: 0, count: 0 };
        // Always prefer openInterestValue (USD) over openInterest (raw contracts)
        const oiVal = o.openInterestValue || 0;
        cur.total += oiVal;
        cur.count++;
        oiMap.set(o.symbol, cur);
      });

      // Merge all symbols
      const allSymbols = new Set<string>();
      tickerMap.forEach((_, k) => allSymbols.add(k));
      fundingMap.forEach((_, k) => allSymbols.add(k));
      oiMap.forEach((_, k) => allSymbols.add(k));
      const merged: ScreenerRow[] = [];

      allSymbols.forEach((symbol) => {
        const t = tickerMap.get(symbol);
        const f = fundingMap.get(symbol);
        const o = oiMap.get(symbol);

        // Skip if no price data
        if (!t || t.count === 0) return;

        merged.push({
          symbol,
          price: t.price / t.count,
          change24h: t.change || 0,
          volume24h: t.vol,
          avgFunding: f ? f.total / f.count : 0,
          fundingExchanges: f?.count || 0,
          totalOI: o?.total || 0,
          oiExchanges: o?.count || 0,
        });
      });

      setRows(merged);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to fetch screener data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 60s (was 30s)
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    setPresets([...DEFAULT_PRESETS, ...getPresets()]);
  }, []);

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

  const paged = useMemo(() => {
    return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

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
    const avgFunding = rows.reduce((s, r) => s + r.avgFunding, 0) / rows.filter((r) => r.avgFunding !== 0).length || 0;
    const totalOI = rows.reduce((s, r) => s + r.totalOI, 0);
    const totalVol = rows.reduce((s, r) => s + r.volume24h, 0);
    const gainers = rows.filter((r) => r.change24h > 0).length;
    return { avgFunding, totalOI, totalVol, symbols: rows.length, gainers, losers: rows.length - gainers };
  }, [rows]);

  /* ─── Render ──────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Screener</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Filter {rows.length} symbols by funding, OI, volume, and price action
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-[10px] text-neutral-600">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
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
            {[
              { label: 'Symbols', value: stats.symbols.toString() },
              { label: 'Total OI', value: formatNumber(stats.totalOI) },
              { label: '24h Volume', value: formatNumber(stats.totalVol) },
              { label: 'Avg Funding', value: formatFundingRate(stats.avgFunding), color: stats.avgFunding > 0 ? 'text-green-400' : stats.avgFunding < 0 ? 'text-red-400' : 'text-neutral-300' },
              { label: 'Gainers', value: stats.gainers.toString(), color: 'text-green-400' },
              { label: 'Losers', value: stats.losers.toString(), color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2">
                <div className="text-[10px] text-neutral-500">{s.label}</div>
                <div className={`text-sm font-semibold ${s.color || 'text-white'}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search symbol..."
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
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
            >
              {p.name}
            </button>
          ))}

          {conditions.length > 0 && (
            <button
              onClick={() => { setConditions([]); setPage(0); }}
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
                  value={c.field}
                  onChange={(e) => updateCondition(idx, { field: e.target.value as FilterCondition['field'] })}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                >
                  {Object.entries(FIELD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select
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
            Showing {paged.length} of {filtered.length} results
            {conditions.length > 0 ? ` (filtered from ${rows.length})` : ''}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-neutral-500 w-8">#</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-medium text-neutral-500 w-6"></th>
                {([
                  ['symbol', 'Symbol'],
                  ['price', 'Price'],
                  ['change24h', '24h %'],
                  ['volume24h', 'Volume 24h'],
                  ['avgFunding', 'Avg Funding'],
                  ['totalOI', 'Open Interest'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`px-3 py-2.5 text-[11px] font-medium cursor-pointer hover:text-white transition-colors select-none ${
                      field === 'symbol' ? 'text-left' : 'text-right'
                    } ${sortField === field ? 'text-hub-yellow' : 'text-neutral-500'}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label} <SortIcon field={field} />
                    </span>
                  </th>
                ))}
                <th className="text-right px-3 py-2.5 text-[11px] font-medium text-neutral-500">Exchanges</th>
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
                    className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
                      matchesAll ? 'bg-hub-yellow/[0.02]' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-[11px] text-neutral-600">{rank}</td>
                    <td className="px-1 py-2">
                      <button
                        onClick={() => toggleWatchlist(row.symbol)}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                          inWl ? 'text-hub-yellow' : 'text-neutral-700 hover:text-neutral-400'
                        }`}
                      >
                        <Star className="w-3 h-3" fill={inWl ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="px-3 py-2 font-semibold text-white">{row.symbol}</td>
                    <td className="px-3 py-2 text-right text-neutral-300 font-mono text-xs">{formatPrice(row.price)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${row.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercent(row.change24h)}
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
                    <td className="px-3 py-2 text-right text-neutral-600 text-[11px]">
                      {row.fundingExchanges > 0 ? `${row.fundingExchanges}F` : ''}
                      {row.fundingExchanges > 0 && row.oiExchanges > 0 ? ' · ' : ''}
                      {row.oiExchanges > 0 ? `${row.oiExchanges}OI` : ''}
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-neutral-500 text-sm">
                    {conditions.length > 0 ? 'No symbols match your filter conditions.' : 'No data available.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-neutral-500">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl px-4 py-3">
          <p className="text-xs text-neutral-400">
            <span className="text-hub-yellow font-medium">Screener</span> aggregates real-time data from 17+ exchanges.
            Funding rates are averaged across exchanges. Open Interest is summed.
            Use filters to find high-funding, large-OI, or trending symbols. Star symbols to add to your Watchlist.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
