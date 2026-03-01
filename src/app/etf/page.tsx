'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { formatUSD, formatPercent, formatCompact } from '@/lib/utils/format';
import {
  RefreshCw, Info, Landmark, TrendingUp, TrendingDown,
  ChevronUp, ChevronDown, BarChart3, DollarSign, Percent, Activity,
} from 'lucide-react';

const LightweightChart = dynamic(
  () => import('@/components/charts/LightweightChart'),
  { ssr: false, loading: () => <div className="h-[300px] bg-white/[0.02] rounded-xl animate-pulse" /> },
);

/* ─── Types ──────────────────────────────────────────────────────── */

interface ETFFund {
  ticker: string;
  name: string;
  issuer: string;
  fee: number;
  price: number | null;
  change24h: number | null;
  volume: number | null;
  marketCap: number | null;
}

interface ETFResponse {
  type: string;
  asset: string;
  summary: {
    totalFunds: number;
    dailyVolume: number | null;
    totalAum: number | null;
    liveQuotes: number;
  };
  funds: ETFFund[];
  history: Array<{ date: string; close: number; volume: number }>;
  timestamp: number;
}

type SortKey = 'ticker' | 'fee' | 'price' | 'change24h' | 'volume';

/* ─── Sort helper ────────────────────────────────────────────────── */

function SortHeader({
  label,
  sortKey,
  currentKey,
  ascending,
  onSort,
  align = 'right',
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  ascending: boolean;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-white group ${
        align === 'left' ? 'text-left' : 'text-right'
      } ${active ? 'text-hub-yellow' : 'text-neutral-500'}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && (
          <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
            {ascending ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        )}
        {label}
        {align === 'left' && (
          <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
            {ascending ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        )}
      </span>
    </th>
  );
}

/* ─── Component ──────────────────────────────────────────────────── */

/* Comparison ETFs removed — Yahoo Finance blocks client-side CORS */

export default function ETFPage() {
  const [type, setType] = useState<'btc' | 'eth'>('btc');
  const [data, setData] = useState<ETFResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortAsc, setSortAsc] = useState(false);
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/etf?type=${type}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /* Comparison ETFs removed — Yahoo Finance blocks client-side CORS */

  /* Sort handler */
  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortAsc(!sortAsc);
      } else {
        setSortKey(key);
        setSortAsc(key === 'ticker' || key === 'fee');
      }
    },
    [sortKey, sortAsc],
  );

  /* Sorted funds */
  const sortedFunds = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.funds].sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case 'ticker':
          return sortAsc
            ? a.ticker.localeCompare(b.ticker)
            : b.ticker.localeCompare(a.ticker);
        case 'fee':
          va = a.fee;
          vb = b.fee;
          break;
        case 'price':
          va = a.price ?? 0;
          vb = b.price ?? 0;
          break;
        case 'change24h':
          va = a.change24h ?? 0;
          vb = b.change24h ?? 0;
          break;
        case 'volume':
          va = a.volume ?? 0;
          vb = b.volume ?? 0;
          break;
        default:
          return 0;
      }
      return sortAsc ? va - vb : vb - va;
    });
    return sorted;
  }, [data, sortKey, sortAsc]);

  /* Chart data */
  const chartSeries = useMemo(() => {
    if (!data?.history?.length) return null;
    const lineData = data.history.map((h) => ({
      time: h.date as any,
      value: h.close,
    }));
    const volData = data.history.map((h) => ({
      time: h.date as any,
      value: h.volume,
      color: 'rgba(234,179,8,0.15)',
    }));
    return { lineData, volData };
  }, [data?.history]);

  /* Summary stats */
  const stats = useMemo(() => {
    if (!data) return null;
    const leadFund = data.funds[0]; // IBIT or ETHA
    const avgFee = data.funds.reduce((s, f) => s + f.fee, 0) / data.funds.length;
    const lowestFee = Math.min(...data.funds.map((f) => f.fee));
    const lowestFeeTicker = data.funds.find((f) => f.fee === lowestFee)?.ticker;
    return { leadFund, avgFee, lowestFee, lowestFeeTicker };
  }, [data]);

  const hasLiveData = data && data.summary.liveQuotes > 0;
  const maxFee = data ? Math.max(...data.funds.map((f) => f.fee)) : 1;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title + Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
              <Landmark className="w-4 h-4 text-hub-yellow" />
            </div>
            <div>
              <h1 className="heading-page">Crypto ETF Tracker</h1>
              <p className="text-neutral-500 text-sm mt-0.5">
                US spot {type === 'btc' ? 'Bitcoin' : 'Ethereum'} ETFs — prices, volumes, and fees
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
              {(['btc', 'eth'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                    type === t
                      ? 'bg-hub-yellow text-black shadow-glow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UpdatedAgo date={lastUpdate} />
          </div>
        </div>

        {/* Loading */}
        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-xl h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl h-[300px] animate-pulse" />
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl h-[400px] animate-pulse" />
          </div>
        )}

        {data && stats && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {/* Lead ETF Price */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-hub-yellow" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                    {stats.leadFund.ticker} Price
                  </p>
                </div>
                {stats.leadFund.price ? (
                  <>
                    <p className="text-xl font-bold text-white font-mono">${stats.leadFund.price.toFixed(2)}</p>
                    {stats.leadFund.change24h !== null && (
                      <div className={`flex items-center gap-1 mt-0.5 ${
                        stats.leadFund.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {stats.leadFund.change24h >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span className="text-xs font-medium font-mono">
                          {formatPercent(stats.leadFund.change24h)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xl font-bold text-neutral-600">—</p>
                )}
              </div>

              {/* Daily Volume */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Daily Volume</p>
                </div>
                <p className="text-xl font-bold text-white font-mono">
                  {data.summary.dailyVolume ? formatUSD(data.summary.dailyVolume) : '—'}
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {hasLiveData ? `${data.summary.liveQuotes} funds reporting` : 'No live data'}
                </p>
              </div>

              {/* Total Funds */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Total Funds</p>
                </div>
                <p className="text-xl font-bold text-white">{data.summary.totalFunds}</p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  US spot {data.asset} ETFs
                </p>
              </div>

              {/* Lowest Fee */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="w-3.5 h-3.5 text-green-400" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Lowest Fee</p>
                </div>
                <p className="text-xl font-bold text-green-400 font-mono">{stats.lowestFee.toFixed(2)}%</p>
                <p className="text-xs text-neutral-600 mt-0.5">{stats.lowestFeeTicker} — Avg {stats.avgFee.toFixed(2)}%</p>
              </div>
            </div>

            {/* Price Chart */}
            {chartSeries && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      {data.funds[0].ticker} Price — 3 Month
                    </h2>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      Lead {data.asset} ETF daily price and volume
                    </p>
                  </div>
                  {stats.leadFund.price && stats.leadFund.change24h !== null && (
                    <div className={`px-3 py-1 rounded-lg text-xs font-bold font-mono ${
                      stats.leadFund.change24h >= 0
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {formatPercent(stats.leadFund.change24h)} today
                    </div>
                  )}
                </div>
                <LightweightChart
                  series={[
                    {
                      type: 'line',
                      data: chartSeries.lineData,
                      options: {
                        color: '#eab308',
                        lineWidth: 2,
                        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
                      },
                    },
                    {
                      type: 'histogram',
                      data: chartSeries.volData,
                      options: {
                        priceFormat: { type: 'volume' },
                        priceScaleId: 'vol',
                      },
                    },
                  ]}
                  height={300}
                />
              </div>
            )}

            {/* Fund Table */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden mb-6">
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    US Spot {data.asset} ETFs
                  </h2>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {data.funds.length} approved funds — click headers to sort
                  </p>
                </div>
                {hasLiveData && (
                  <span className="flex items-center gap-1.5 text-[10px] text-green-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                    </span>
                    Live
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-left w-8">
                        #
                      </th>
                      <SortHeader label="Ticker" sortKey="ticker" currentKey={sortKey} ascending={sortAsc} onSort={handleSort} align="left" />
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-left hidden sm:table-cell">
                        Issuer
                      </th>
                      <SortHeader label="Fee" sortKey="fee" currentKey={sortKey} ascending={sortAsc} onSort={handleSort} />
                      {hasLiveData && (
                        <>
                          <SortHeader label="Price" sortKey="price" currentKey={sortKey} ascending={sortAsc} onSort={handleSort} />
                          <SortHeader label="24h Chg" sortKey="change24h" currentKey={sortKey} ascending={sortAsc} onSort={handleSort} />
                          <SortHeader label="Volume" sortKey="volume" currentKey={sortKey} ascending={sortAsc} onSort={handleSort} />
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFunds.map((fund, idx) => (
                      <tr
                        key={fund.ticker}
                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-neutral-600 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-hub-yellow font-bold text-sm">{fund.ticker}</span>
                            <p className="text-[11px] text-neutral-600 mt-0.5 truncate max-w-[200px] hidden lg:block">
                              {fund.name}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-400 hidden sm:table-cell">
                          {fund.issuer}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-mono text-sm font-semibold ${
                              fund.fee <= 0.20
                                ? 'text-green-400'
                                : fund.fee <= 0.25
                                  ? 'text-hub-yellow'
                                  : fund.fee <= 0.30
                                    ? 'text-orange-400'
                                    : 'text-red-400'
                            }`}
                          >
                            {fund.fee.toFixed(2)}%
                          </span>
                        </td>
                        {hasLiveData && (
                          <>
                            <td className="px-4 py-3 text-right font-mono text-sm text-white">
                              {fund.price ? `$${fund.price.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {fund.change24h !== null ? (
                                <span
                                  className={`inline-flex items-center gap-1 font-mono text-sm font-medium ${
                                    fund.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                                  }`}
                                >
                                  {fund.change24h >= 0 ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3" />
                                  )}
                                  {formatPercent(fund.change24h)}
                                </span>
                              ) : (
                                <span className="text-neutral-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm text-neutral-400">
                              {fund.volume ? formatUSD(fund.volume) : '—'}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fee Comparison */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center flex-shrink-0">
                  <Percent className="w-4 h-4 text-hub-yellow" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Fee Comparison</h2>
                  <p className="text-xs text-neutral-600 mt-0.5">Annual expense ratios — lower is better</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {[...data.funds]
                  .sort((a, b) => a.fee - b.fee)
                  .map((fund) => {
                    const pct = (fund.fee / maxFee) * 100;
                    return (
                      <div key={fund.ticker} className="flex items-center gap-3 group">
                        <span className="text-xs text-hub-yellow font-bold w-12 text-right font-mono">
                          {fund.ticker}
                        </span>
                        <div className="flex-1 h-6 bg-white/[0.03] rounded overflow-hidden relative">
                          <div
                            className={`h-full rounded transition-all duration-500 ${
                              fund.fee <= 0.20
                                ? 'bg-green-500/40'
                                : fund.fee <= 0.25
                                  ? 'bg-hub-yellow/30'
                                  : fund.fee <= 0.30
                                    ? 'bg-orange-500/30'
                                    : 'bg-red-500/30'
                            }`}
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                          <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            {fund.issuer}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-neutral-400 w-14 text-right">
                          {fund.fee.toFixed(2)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <div className="w-3 h-3 rounded bg-green-500/40" /> &le; 0.20%
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <div className="w-3 h-3 rounded bg-hub-yellow/30" /> 0.21–0.25%
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <div className="w-3 h-3 rounded bg-orange-500/30" /> 0.26–0.30%
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <div className="w-3 h-3 rounded bg-red-500/30" /> &gt; 0.30%
                </div>
              </div>
            </div>

            {/* Comparison vs Traditional ETFs removed — Yahoo Finance blocks client-side CORS */}

            {/* Info footer */}
            <div className="bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
                <div className="text-xs text-neutral-400 space-y-1">
                  <p>
                    <strong className="text-neutral-300">Crypto ETF Tracker</strong> shows all approved
                    US spot {type === 'btc' ? 'Bitcoin' : 'Ethereum'} ETFs with live pricing data.
                  </p>
                  <p>
                    <strong>Expense Ratio:</strong> The annual fee charged by the ETF, deducted from the fund&apos;s assets.
                    Lower fees mean more of your investment stays working for you.
                  </p>
                  <p>
                    Prices and volume sourced from Yahoo Finance.
                    Data refreshes every 5 minutes.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
