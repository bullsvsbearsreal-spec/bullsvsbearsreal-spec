'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TokenIconSimple } from '@/components/TokenIcon';
import { RefreshCw, Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown, BarChart3, Coins } from 'lucide-react';

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

/* ─── Formatters ─────────────────────────────────────────────────── */

const fmt = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

const fmtPrice = (p: number) =>
  p >= 1 ? `$${p.toFixed(2)}` : p >= 0.001 ? `$${p.toFixed(4)}` : `$${p.toFixed(6)}`;

/* ─── Component ──────────────────────────────────────────────────── */

export default function TopMoversPage() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Tab, sort, search
  const [tab, setTab] = useState<Tab>('gainers');
  const [sortField, setSortField] = useState<SortField>('change24h');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

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
    const avgChange = coins.reduce((s, c) => s + c.change24h, 0) / coins.length;
    const best = coins.reduce((a, b) => (b.change24h > a.change24h ? b : a), coins[0]);
    const worst = coins.reduce((a, b) => (b.change24h < a.change24h ? b : a), coins[0]);
    return { total: coins.length, avgChange, best, worst };
  }, [coins]);

  /* ─── Filter + Sort ────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = coins;

    // Tab filter
    if (tab === 'gainers') result = result.filter((c) => c.change24h > 0);
    else if (tab === 'losers') result = result.filter((c) => c.change24h < 0);

    // Search
    if (search) {
      const q = search.toUpperCase();
      result = result.filter(
        (c) => c.symbol.toUpperCase().includes(q) || c.name.toUpperCase().includes(q)
      );
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
  }, [coins, tab, search, sortField, sortDir]);

  /* ─── Handlers ─────────────────────────────────────────────────── */

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'symbol' || field === 'name' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-neutral-600" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-hub-yellow" />
    ) : (
      <ChevronDown className="w-3 h-3 text-hub-yellow" />
    );
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'gainers', label: 'Gainers' },
    { key: 'losers', label: 'Losers' },
    { key: 'all', label: 'All' },
  ];

  /* ─── Render ───────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-white">Top Movers</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              24h price performance across {coins.length} coins
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

        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Coins className="w-3 h-3 text-neutral-500" />
                <span className="text-[10px] text-neutral-500">Total Coins</span>
              </div>
              <div className="text-sm font-semibold text-white">{stats.total}</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <BarChart3 className="w-3 h-3 text-neutral-500" />
                <span className="text-[10px] text-neutral-500">Average Change</span>
              </div>
              <div className={`text-sm font-semibold font-mono tabular-nums ${stats.avgChange >= 0 ? 'text-success' : 'text-danger'}`}>
                {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
              </div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingUp className="w-3 h-3 text-success" />
                <span className="text-[10px] text-neutral-500">Best Performer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">{stats.best.symbol}</span>
                <span className="text-xs font-mono tabular-nums text-success">
                  +{stats.best.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingDown className="w-3 h-3 text-danger" />
                <span className="text-[10px] text-neutral-500">Worst Performer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white">{stats.worst.symbol}</span>
                <span className="text-xs font-mono tabular-nums text-danger">
                  {stats.worst.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-500 hover:text-white bg-white/[0.04]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[300px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol or name..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/30"
            />
          </div>

          {/* Result count */}
          <span className="text-[11px] text-neutral-500 ml-auto">
            {filtered.length} coin{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Loading State */}
        {loading && coins.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-hub-yellow animate-spin mb-3" />
            <span className="text-sm text-neutral-500">Loading top movers...</span>
          </div>
        )}

        {/* Error State */}
        {error && coins.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-danger text-sm mb-3">{error}</div>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-hub-yellow text-black hover:bg-hub-yellow/90 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Data Table */}
        {coins.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                  <th className="text-left px-3 py-2.5 text-[11px] font-medium text-neutral-500 w-10">#</th>
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
                      className={`px-3 py-2.5 text-[11px] font-medium cursor-pointer hover:text-white transition-colors select-none ${align} ${
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
                {filtered.map((coin, idx) => (
                  <tr
                    key={coin.symbol}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-3 py-2 text-[11px] text-neutral-600">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <TokenIconSimple symbol={coin.symbol} size={20} cmcId={coin.cmcId} />
                        <span className="font-semibold text-white text-xs">{coin.symbol}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-400 max-w-[160px] truncate">{coin.name}</td>
                    <td className="px-3 py-2 text-right text-neutral-300 font-mono tabular-nums text-xs">
                      {fmtPrice(coin.price)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums text-xs font-medium ${
                      coin.change24h >= 0 ? 'text-success' : 'text-danger'
                    }`}>
                      {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-400 font-mono tabular-nums text-xs">
                      {fmt(coin.marketCap)}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-400 font-mono tabular-nums text-xs">
                      {fmt(coin.volume24h)}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-neutral-500 text-sm">
                      {search ? 'No coins match your search.' : 'No data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl px-4 py-3">
          <p className="text-xs text-neutral-400">
            <span className="text-hub-yellow font-medium">Top Movers</span> tracks 24h price changes across the top 500 coins by market cap.
            Only coins listed on InfoHub exchanges are shown. Data refreshes every 60 seconds via CoinMarketCap.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
