'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { RefreshCw, TrendingUp, TrendingDown, PieChart, DollarSign, BarChart3, Coins, Globe } from 'lucide-react';
import { formatCompact } from '@/lib/utils/format';

/* ─── Types ──────────────────────────────────────────────────────── */

interface DominanceData {
  btcDominance: number | null;
  ethDominance: number | null;
  totalMarketCap: number | null;
  totalVolume24h: number | null;
  activeCryptos: number | null;
  markets: number | null;
  marketCapChange24h: number | null;
  updatedAt: number;
  dominanceBreakdown: Record<string, number>;
}

/* ─── Donut Chart (SVG) ──────────────────────────────────────────── */

function DonutChart({ value, label, color, size = 160 }: { value: number; label: string; color: string; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="12"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold text-white">{value.toFixed(1)}%</span>
        <span className="text-xs text-neutral-500">{label}</span>
      </div>
    </div>
  );
}

/* ─── Bar Chart for breakdown ────────────────────────────────────── */

const COLORS = [
  '#f7931a', // BTC orange
  '#627eea', // ETH blue
  '#14f195', // SOL green
  '#ff5722', // XRP
  '#c2a633', // BNB
  '#e4405f', // ADA
  '#8b5cf6', // DOT
  '#3b82f6', // LINK
  '#ec4899', // AVAX
  '#6ee7b7', // Others
];

/* ─── Component ──────────────────────────────────────────────────── */

export default function DominancePage() {
  const [data, setData] = useState<DominanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/dominance');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 min refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  // Breakdown sorted by dominance
  const breakdown = useMemo(() => {
    if (!data?.dominanceBreakdown) return [];
    const entries: Array<{ symbol: string; pct: number }> = [];
    Object.entries(data.dominanceBreakdown).forEach(([sym, pct]) => {
      entries.push({ symbol: sym.toUpperCase(), pct: pct as number });
    });
    entries.sort((a, b) => b.pct - a.pct);
    return entries.slice(0, 10);
  }, [data]);

  const othersPercent = useMemo(() => {
    if (breakdown.length === 0) return 0;
    const top = breakdown.reduce((s, e) => s + e.pct, 0);
    return Math.max(0, 100 - top);
  }, [breakdown]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="text-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="heading-page flex items-center gap-2">
                <PieChart className="w-6 h-6 text-hub-yellow" />
                Market Dominance
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                BTC dominance, market share breakdown, and global crypto market stats
              </p>
            </div>
            <div className="flex items-center gap-2">
              <UpdatedAgo date={lastUpdate} />
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && !data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-xl h-[82px] animate-pulse" />
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[1, 2].map(i => (
                  <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-xl h-[260px] animate-pulse" />
                ))}
              </div>
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl h-[300px] animate-pulse" />
            </div>
          )}

          {error && !data && (
            <div className="text-center py-12 text-red-400">
              <p>{error}</p>
              <button onClick={fetchData} className="mt-3 text-sm text-hub-yellow hover:underline">Retry</button>
            </div>
          )}

          {data && (
            <>
              {/* Global Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-hub-yellow" />
                    <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Total Market Cap</p>
                  </div>
                  <p className="text-lg font-bold text-white font-mono">
                    {data.totalMarketCap != null ? `$${formatCompact(data.totalMarketCap)}` : '-'}
                  </p>
                  {data.marketCapChange24h != null && (
                    <p className={`text-xs flex items-center gap-1 mt-0.5 ${data.marketCapChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.marketCapChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {data.marketCapChange24h >= 0 ? '+' : ''}{data.marketCapChange24h.toFixed(2)}%
                    </p>
                  )}
                </div>
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                    <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">24h Volume</p>
                  </div>
                  <p className="text-lg font-bold text-white font-mono">
                    {data.totalVolume24h != null ? `$${formatCompact(data.totalVolume24h)}` : '-'}
                  </p>
                </div>
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Coins className="w-3.5 h-3.5 text-green-400" />
                    <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Active Cryptos</p>
                  </div>
                  <p className="text-lg font-bold text-white font-mono">
                    {data.activeCryptos != null ? data.activeCryptos.toLocaleString() : '-'}
                  </p>
                </div>
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-3.5 h-3.5 text-purple-400" />
                    <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Markets</p>
                  </div>
                  <p className="text-lg font-bold text-white font-mono">
                    {data.markets != null ? data.markets.toLocaleString() : '-'}
                  </p>
                </div>
              </div>

              {/* Dominance Gauges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                {/* BTC Dominance */}
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-6 flex flex-col items-center">
                  <h2 className="text-sm font-semibold text-neutral-300 mb-4">BTC Dominance</h2>
                  <div className="relative">
                    <DonutChart
                      value={data.btcDominance ?? 0}
                      label="BTC.D"
                      color="#f7931a"
                      size={180}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-4">
                    Bitcoin controls {(data.btcDominance ?? 0).toFixed(1)}% of total crypto market cap
                  </p>
                </div>

                {/* ETH Dominance */}
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-6 flex flex-col items-center">
                  <h2 className="text-sm font-semibold text-neutral-300 mb-4">ETH Dominance</h2>
                  <div className="relative">
                    <DonutChart
                      value={data.ethDominance ?? 0}
                      label="ETH.D"
                      color="#627eea"
                      size={180}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-4">
                    Ethereum controls {(data.ethDominance ?? 0).toFixed(1)}% of total crypto market cap
                  </p>
                </div>
              </div>

              {/* Dominance Breakdown */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-5 mb-6">
                <h2 className="text-sm font-semibold text-white mb-4">Market Share Breakdown</h2>
                <div className="space-y-3">
                  {breakdown.map((entry, i) => (
                    <div key={entry.symbol} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-neutral-300 w-10">{entry.symbol}</span>
                      <div className="flex-1 h-6 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${Math.max(entry.pct, 0.5)}%`,
                            backgroundColor: COLORS[i] || COLORS[COLORS.length - 1],
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-neutral-400 w-16 text-right">
                        {entry.pct.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                  {othersPercent > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-neutral-500 w-10">Other</span>
                      <div className="flex-1 h-6 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-neutral-600 transition-all duration-1000 ease-out"
                          style={{ width: `${othersPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-neutral-500 w-16 text-right">
                        {othersPercent.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </>
          )}

          {/* Info footer */}
          <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            <p className="text-neutral-500 text-xs leading-relaxed">
              Market Dominance tracks each cryptocurrency&apos;s market cap share relative to the total crypto market. Rising BTC dominance typically indicates a &quot;flight to safety&quot; within crypto. Falling BTC dominance often signals an altseason where altcoins outperform. Data sourced from CoinGecko. Updates every 5 minutes.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
