'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import { RefreshCw, Plus, X, Star, Copy, Check, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { getWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/storage/watchlist';
import { formatPrice, formatNumber, formatFundingRate, formatPercent } from '@/lib/utils/format';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TickerEntry {
  symbol: string;
  lastPrice: number;
  priceChangePercent24h: number;
  volume24h: number;
  exchange: string;
}

interface FundingEntry {
  symbol: string;
  fundingRate: number;
  exchange: string;
}

interface OIEntry {
  symbol: string;
  openInterestValue: number;
  exchange: string;
}

interface AggregatedRow {
  symbol: string;
  price: number;
  change24h: number;
  avgFunding: number;
  totalOI: number;
  volume: number;
}

type SortField = 'symbol' | 'price' | 'change24h' | 'avgFunding' | 'totalOI' | 'volume';
type SortOrder = 'asc' | 'desc';

const PRESET_BASICS = ['BTC', 'ETH', 'SOL'];
const PRESET_TOP5 = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'];

/* ------------------------------------------------------------------ */
/*  Helper: strip common suffixes so "BTCUSDT" normalizes to "BTC"     */
/* ------------------------------------------------------------------ */

function normalizeSymbol(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[-_]/g, '')
    .replace(/(USDT|USD|USDC|BUSD|PERP|SWAP)$/i, '')
    .replace(/^1000/, '');
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function WatchlistPage() {
  /* ---- local state ------------------------------------------------ */
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [copied, setCopied] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setWatchlist(getWatchlist());
  }, []);

  /* ---- data fetchers (useCallback-wrapped to prevent infinite loop) */
  const tickerFetcher = useCallback(
    () => fetch('/api/tickers').then((r) => r.json()) as Promise<TickerEntry[]>,
    [],
  );

  const fundingFetcher = useCallback(
    () =>
      fetch('/api/funding')
        .then((r) => r.json())
        .then((j: { data: FundingEntry[] }) => j.data),
    [],
  );

  const oiFetcher = useCallback(
    () =>
      fetch('/api/openinterest')
        .then((r) => r.json())
        .then((j: { data: OIEntry[] }) => j.data),
    [],
  );

  const { data: tickers, isLoading: loadingTickers, error: tickerError, lastUpdate, refresh: refreshTickers } = useApiData({
    fetcher: tickerFetcher,
    refreshInterval: 30_000,
  });

  const { data: fundingData, refresh: refreshFunding } = useApiData({
    fetcher: fundingFetcher,
    refreshInterval: 30_000,
  });

  const { data: oiData, refresh: refreshOI } = useApiData({
    fetcher: oiFetcher,
    refreshInterval: 30_000,
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshTickers(), refreshFunding(), refreshOI()]);
  }, [refreshTickers, refreshFunding, refreshOI]);

  /* ---- watchlist mutations ---------------------------------------- */
  const handleAdd = (symbol: string) => {
    const upper = symbol.toUpperCase().trim();
    if (!upper) return;
    addToWatchlist(upper);
    setWatchlist(getWatchlist());
    setInputValue('');
  };

  const handleRemove = (symbol: string) => {
    removeFromWatchlist(symbol);
    setWatchlist(getWatchlist());
  };

  const handlePreset = (symbols: string[]) => {
    symbols.forEach((s) => addToWatchlist(s));
    setWatchlist(getWatchlist());
  };

  const handleExport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(watchlist, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  /* ---- aggregate data per symbol ---------------------------------- */
  const rows: AggregatedRow[] = useMemo(() => {
    if (!watchlist.length) return [];

    const wlSet = new Set(watchlist);

    // -- tickers: group by normalized symbol, pick highest-volume entry for price
    const tickerMap = new Map<string, { price: number; change: number; vol: number }>();
    (tickers ?? []).forEach((t) => {
      const sym = normalizeSymbol(t.symbol);
      if (!wlSet.has(sym)) return;
      const prev = tickerMap.get(sym);
      const vol = t.volume24h ?? 0;
      if (!prev || vol > prev.vol) {
        tickerMap.set(sym, { price: t.lastPrice, change: t.priceChangePercent24h, vol });
      }
      // accumulate volume
      if (prev) {
        tickerMap.set(sym, {
          price: vol > prev.vol ? t.lastPrice : prev.price,
          change: vol > prev.vol ? t.priceChangePercent24h : prev.change,
          vol: prev.vol + vol,
        });
      }
    });

    // -- funding: average across exchanges
    const fundingMap = new Map<string, { sum: number; count: number }>();
    (fundingData ?? []).forEach((f) => {
      const sym = normalizeSymbol(f.symbol);
      if (!wlSet.has(sym)) return;
      const prev = fundingMap.get(sym) ?? { sum: 0, count: 0 };
      fundingMap.set(sym, { sum: prev.sum + f.fundingRate, count: prev.count + 1 });
    });

    // -- OI: sum across exchanges
    const oiMap = new Map<string, number>();
    (oiData ?? []).forEach((o) => {
      const sym = normalizeSymbol(o.symbol);
      if (!wlSet.has(sym)) return;
      oiMap.set(sym, (oiMap.get(sym) ?? 0) + o.openInterestValue);
    });

    return watchlist.map((sym) => {
      const t = tickerMap.get(sym);
      const f = fundingMap.get(sym);
      return {
        symbol: sym,
        price: t?.price ?? 0,
        change24h: t?.change ?? 0,
        avgFunding: f ? f.sum / f.count : 0,
        totalOI: oiMap.get(sym) ?? 0,
        volume: t?.vol ?? 0,
      };
    });
  }, [watchlist, tickers, fundingData, oiData]);

  /* ---- sort -------------------------------------------------------- */
  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [rows, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  function SortIcon({ field, currentField, currentOrder }: { field: string; currentField: string; currentOrder: 'asc' | 'desc' }) {
    if (field !== currentField) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return currentOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-hub-yellow" />
      : <ArrowDown className="w-3 h-3 text-hub-yellow" />;
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 page-enter">
        {/* ---------- title bar --------------------------------------- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Star className="w-5 h-5 text-hub-yellow" />
              Watchlist
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Track your favorite coins across all exchanges
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Export */}
            <button
              onClick={handleExport}
              disabled={!watchlist.length}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-white/[0.06] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Export'}
            </button>

            {/* Refresh */}
            <button
              onClick={refreshAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-white/[0.06] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>

            {lastUpdate && (
              <span className="text-[11px] text-neutral-600">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* ---------- add bar ----------------------------------------- */}
        <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Input + button */}
            <form
              className="flex items-center gap-2 w-full sm:w-auto"
              onSubmit={(e) => {
                e.preventDefault();
                handleAdd(inputValue);
              }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                placeholder="Enter symbol (e.g. SOL)"
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/50 w-48"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-hub-yellow text-black hover:bg-hub-yellow/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </form>

            {/* Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-neutral-600 text-xs">Quick add:</span>
              <button
                onClick={() => handlePreset(PRESET_BASICS)}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
              >
                BTC, ETH, SOL
              </button>
              <button
                onClick={() => handlePreset(PRESET_TOP5)}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
              >
                Top 5
              </button>
            </div>
          </div>
        </div>

        {/* ---------- error banner ------------------------------------- */}
        {tickerError && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {tickerError}
          </div>
        )}

        {/* ---------- empty state -------------------------------------- */}
        {watchlist.length === 0 && (
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-12 text-center">
            <Star className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-neutral-300 mb-2">
              Add coins to your watchlist
            </h2>
            <p className="text-neutral-600 text-sm mb-6 max-w-md mx-auto">
              Type a symbol above or use the preset buttons to start tracking coins across all exchanges.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handlePreset(PRESET_BASICS)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-hub-yellow text-black hover:bg-hub-yellow/90 transition-colors"
              >
                Add BTC, ETH, SOL
              </button>
              <button
                onClick={() => handlePreset(PRESET_TOP5)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] hover:bg-white/[0.1] text-neutral-400 hover:text-white transition-colors"
              >
                Add Top 5
              </button>
            </div>
          </div>
        )}

        {/* ---------- data table --------------------------------------- */}
        {watchlist.length > 0 && (
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
            {loadingTickers && !tickers ? (
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <div className="h-4 w-32 bg-white/[0.06] rounded animate-pulse" />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.04] animate-pulse">
                    <div className="w-20 h-4 bg-white/[0.06] rounded" />
                    <div className="w-24 h-4 bg-white/[0.06] rounded" />
                    <div className="w-16 h-4 bg-white/[0.06] rounded" />
                    <div className="w-20 h-4 bg-white/[0.06] rounded" />
                    <div className="w-20 h-4 bg-white/[0.06] rounded" />
                    <div className="w-16 h-4 bg-white/[0.06] rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {([
                        ['symbol', 'Symbol'],
                        ['price', 'Price'],
                        ['change24h', '24h Change'],
                        ['avgFunding', 'Avg Funding'],
                        ['totalOI', 'Total OI'],
                        ['volume', 'Volume'],
                      ] as [SortField, string][]).map(([field, label]) => (
                        <th
                          key={field}
                          onClick={() => handleSort(field)}
                          className={`px-4 py-3 text-left font-medium cursor-pointer select-none transition-colors whitespace-nowrap ${
                            sortField === field ? 'text-hub-yellow' : 'text-neutral-500 hover:text-neutral-300'
                          } ${field !== 'symbol' ? 'text-right' : ''}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            <SortIcon field={field} currentField={sortField} currentOrder={sortOrder} />
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr
                        key={row.symbol}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Symbol */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <TokenIconSimple symbol={row.symbol} size={24} />
                            <span className="font-semibold text-white">{row.symbol}</span>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="px-4 py-3 text-right font-mono text-white">
                          {row.price > 0 ? formatPrice(row.price) : <span className="text-neutral-600">--</span>}
                        </td>

                        {/* 24h Change */}
                        <td className={`px-4 py-3 text-right font-mono ${
                          row.change24h > 0 ? 'text-green-400' : row.change24h < 0 ? 'text-red-400' : 'text-neutral-500'
                        }`}>
                          {row.price > 0 ? formatPercent(row.change24h) : <span className="text-neutral-600">--</span>}
                        </td>

                        {/* Avg Funding */}
                        <td className={`px-4 py-3 text-right font-mono ${
                          row.avgFunding > 0 ? 'text-green-400' : row.avgFunding < 0 ? 'text-red-400' : 'text-neutral-500'
                        }`}>
                          {row.avgFunding !== 0
                            ? formatFundingRate(row.avgFunding)
                            : <span className="text-neutral-600">--</span>}
                        </td>

                        {/* Total OI */}
                        <td className="px-4 py-3 text-right font-mono text-white">
                          {row.totalOI > 0 ? formatNumber(row.totalOI) : <span className="text-neutral-600">--</span>}
                        </td>

                        {/* Volume */}
                        <td className="px-4 py-3 text-right font-mono text-white">
                          {row.volume > 0 ? formatNumber(row.volume) : <span className="text-neutral-600">--</span>}
                        </td>

                        {/* Remove */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemove(row.symbol)}
                            className="p-1 rounded hover:bg-white/[0.08] text-neutral-600 hover:text-red-400 transition-colors"
                            aria-label={`Remove ${row.symbol}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---------- coin count -------------------------------------- */}
        {watchlist.length > 0 && (
          <div className="mt-3 text-neutral-600 text-xs text-right">
            {watchlist.length} coin{watchlist.length !== 1 ? 's' : ''} in watchlist
          </div>
        )}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            Watchlist data is aggregated from 17+ exchanges. Prices show the highest-volume match. Funding rates are averaged across all exchanges offering the pair. Open Interest is the sum across all exchanges. Data refreshes every 30 seconds. Your watchlist is stored locally in your browser.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
