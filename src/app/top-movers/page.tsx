'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Pagination from '@/components/Pagination';
import { TokenIconSimple } from '@/components/TokenIcon';
import UpdatedAgo from '@/components/UpdatedAgo';
import WatchlistStar from '@/components/WatchlistStar';
import ShowMoreToggle from '@/components/ShowMoreToggle';
import MobileCard from '@/components/MobileCard';
import { RefreshCw, Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown, BarChart3, Coins, Info } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────── */

interface Coin {
  symbol: string;
  name: string;
  slug: string;
  cmcId: number;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

type Tab = 'gainers' | 'losers' | 'all';
type SortField = 'symbol' | 'name' | 'price' | 'change24h' | 'marketCap' | 'volume24h';
type SortDir = 'asc' | 'desc';

const DEFAULT_ROWS = 20;
const ROWS_PER_PAGE = 50;

/* ─── Formatters ─────────────────────────────────────────────────── */

const fmt = (n: number) => {
  if (!n && n !== 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

const fmtPrice = (p: number) => {
  if (!p && p !== 0) return '—';
  return p >= 1 ? `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : p >= 0.001 ? `$${p.toFixed(4)}` : `$${p.toFixed(6)}`;
};

/* ─── Component ──────────────────────────────────────────────────── */

export default function TopMoversPage() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Tab, sort, search, pagination
  const [tab, setTab] = useState<Tab>('gainers');
  const [sortField, setSortField] = useState<SortField>('change24h');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  /* ─── Data Fetching ───────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/top-movers?mode=heatmap');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCoins(json.coins || []);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to fetch top movers data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /* ─── Stats ────────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    if (coins.length === 0) return null;
    const avgChange = coins.reduce((s, c) => s + (c.change24h ?? 0), 0) / coins.length;
    const best = coins.reduce((a, b) => ((b.change24h ?? 0) > (a.change24h ?? 0) ? b : a), coins[0]);
    const worst = coins.reduce((a, b) => ((b.change24h ?? 0) < (a.change24h ?? 0) ? b : a), coins[0]);
    return { total: coins.length, avgChange, best, worst };
  }, [coins]);

  /* ─── Filter + Sort ────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = coins;

    // Tab filter
    if (tab === 'gainers') result = result.filter(c => (c.change24h ?? 0) > 0);
    else if (tab === 'losers') result = result.filter(c => (c.change24h ?? 0) < 0);

    // Search
    if (search) {
      const q = search.toUpperCase();
      result = result.filter(c =>
        (c.symbol || '').toUpperCase().includes(q) || (c.name || '').toUpperCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const diff = ((aVal as number) ?? 0) - ((bVal as number) ?? 0);
      return sortDir === 'asc' ? diff : -diff;
    });

    return result;
  }, [coins, tab, search, sortField, sortDir]);

  // Pagination — progressive disclosure: show DEFAULT_ROWS initially, full pagination when expanded
  const effectivePageSize = showAll ? ROWS_PER_PAGE : DEFAULT_ROWS;
  const totalPages = showAll ? Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE)) : 1;
  const safeCurrentPage = showAll ? Math.min(currentPage, totalPages) : 1;
  const startIdx = showAll ? (safeCurrentPage - 1) * ROWS_PER_PAGE : 0;
  const pageItems = filtered.slice(startIdx, startIdx + effectivePageSize);

  // Tab counts
  const gainersCount = useMemo(() => coins.filter(c => (c.change24h ?? 0) > 0).length, [coins]);
  const losersCount = useMemo(() => coins.filter(c => (c.change24h ?? 0) < 0).length, [coins]);

  /* ─── Handlers ─────────────────────────────────────────────────── */

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'symbol' || field === 'name' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-neutral-600" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-hub-yellow" />
    ) : (
      <ChevronDown className="w-3 h-3 text-hub-yellow" />
    );
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'gainers', label: 'Gainers', count: gainersCount },
    { key: 'losers', label: 'Losers', count: losersCount },
    { key: 'all', label: 'All', count: coins.length },
  ];

  /* ─── Render ───────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Top Movers</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              24h price performance across {coins.length} coins
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UpdatedAgo date={lastUpdate} />
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Coins className="w-3 h-3 text-neutral-500" />
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Total Coins</span>
              </div>
              <div className="text-lg font-semibold text-white font-mono">{stats.total}</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <BarChart3 className="w-3 h-3 text-neutral-500" />
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Average Change</span>
              </div>
              <div className={`text-lg font-semibold font-mono tabular-nums ${stats.avgChange >= 0 ? 'text-success' : 'text-danger'}`}>
                {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
              </div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingUp className="w-3 h-3 text-success" />
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Best Performer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-semibold text-white">{stats.best.symbol}</span>
                <span className="text-xs font-mono tabular-nums text-success">
                  +{(stats.best.change24h ?? 0).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingDown className="w-3 h-3 text-danger" />
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Worst Performer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-semibold text-white">{stats.worst.symbol}</span>
                <span className="text-xs font-mono tabular-nums text-danger">
                  {(stats.worst.change24h ?? 0).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-500 hover:text-white bg-white/[0.04]'
                }`}
              >
                {t.label}
                {tab === t.key && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/20">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[150px] max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search symbol or name..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/40"
            />
          </div>

          {/* Result count */}
          <span className="text-[11px] text-neutral-600 ml-auto">
            {filtered.length} coin{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Loading State */}
        {loading && coins.length === 0 && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-12 text-center">
            <RefreshCw className="w-5 h-5 text-hub-yellow animate-spin mx-auto mb-2" />
            <span className="text-neutral-500 text-sm">Loading top movers...</span>
          </div>
        )}

        {/* Error State */}
        {error && coins.length === 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-8 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-hub-yellow text-black rounded-lg text-xs font-medium hover:bg-hub-yellow/90 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Data Table */}
        {coins.length > 0 && (
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Mobile Cards (below md) */}
            <div className="md:hidden space-y-2 p-3">
              {pageItems.length === 0 ? (
                <p className="text-center py-8 text-neutral-500 text-sm">
                  {search ? 'No coins match your search.' : 'No data available.'}
                </p>
              ) : pageItems.map((coin, idx) => (
                <MobileCard
                  key={`mobile-${coin.symbol}-${idx}`}
                  symbol={coin.symbol}
                  href={`/symbol/${coin.symbol}`}
                  actions={<WatchlistStar symbol={coin.symbol} />}
                  rows={[
                    { label: 'Price', value: <span className="text-neutral-300">{fmtPrice(coin.price)}</span> },
                    {
                      label: '24h Change',
                      value: (
                        <span className={(coin.change24h ?? 0) >= 0 ? 'text-success' : 'text-danger'}>
                          {coin.change24h != null ? `${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%` : '—'}
                        </span>
                      ),
                    },
                    { label: 'Market Cap', value: <span className="text-neutral-400">{fmt(coin.marketCap)}</span> },
                    { label: 'Volume 24h', value: <span className="text-neutral-400">{fmt(coin.volume24h)}</span> },
                  ]}
                />
              ))}
            </div>

            {/* Desktop Table (md and above) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider w-10">#</th>
                    {([
                      ['symbol', 'Symbol', 'text-left'],
                      ['name', 'Name', 'text-left'],
                      ['price', 'Price', 'text-right'],
                      ['change24h', '24h Change', 'text-right'],
                      ['marketCap', 'Market Cap', 'text-right'],
                      ['volume24h', 'Volume 24h', 'text-right'],
                    ] as [SortField, string, string][]).map(([field, label, align]) => (
                      <th
                        key={field}
                        onClick={() => handleSort(field)}
                        className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none ${align} ${
                          sortField === field ? 'text-hub-yellow' : 'text-neutral-500'
                        }`}
                      >
                        <span className={`inline-flex items-center gap-1 ${align === 'text-right' ? 'justify-end' : ''}`}>
                          {label} <SortIcon field={field} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-neutral-500 text-sm">
                        {search ? 'No coins match your search.' : 'No data available.'}
                      </td>
                    </tr>
                  ) : pageItems.map((coin, idx) => (
                    <tr
                      key={`${coin.symbol}-${idx}`}
                      className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-3 py-2 text-[11px] text-neutral-600 font-mono">{startIdx + idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <WatchlistStar symbol={coin.symbol} />
                          <TokenIconSimple symbol={coin.symbol} size={20} cmcId={coin.cmcId || undefined} />
                          <Link href={`/symbol/${coin.symbol}`} className="font-semibold text-white text-xs hover:text-hub-yellow transition-colors">{coin.symbol}</Link>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-400 max-w-[160px] truncate">{coin.name || '—'}</td>
                      <td className="px-3 py-2 text-right text-neutral-300 font-mono tabular-nums text-xs">
                        {fmtPrice(coin.price)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono tabular-nums text-xs font-medium ${
                        (coin.change24h ?? 0) >= 0 ? 'text-success' : 'text-danger'
                      }`}>
                        {coin.change24h != null ? `${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-400 font-mono tabular-nums text-xs">
                        {fmt(coin.marketCap)}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-400 font-mono tabular-nums text-xs">
                        {fmt(coin.volume24h)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ShowMoreToggle
              expanded={showAll}
              onToggle={() => { setShowAll(prev => !prev); setCurrentPage(1); }}
              totalCount={filtered.length}
              visibleCount={DEFAULT_ROWS}
            />

            {showAll && totalPages > 1 && (
              <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                rowsPerPage={ROWS_PER_PAGE}
                onPageChange={setCurrentPage}
                label="coins"
              />
            )}
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-hub-yellow mt-0.5 flex-shrink-0" />
            <span>
              <span className="text-hub-yellow font-medium">Top Movers</span> tracks 24h price changes across the top 500 coins by market cap.
              Only coins listed on InfoHub exchanges are shown. Data refreshes every 60 seconds via CoinMarketCap.
            </span>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
