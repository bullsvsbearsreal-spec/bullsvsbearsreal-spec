'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { RefreshCw, TrendingUp, TrendingDown, Info, PieChart } from 'lucide-react';
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
    <div className="flex flex-col items-center">
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/dominance');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
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
    <>
      <Header />
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <PieChart className="w-6 h-6 text-hub-yellow" />
                Market Dominance
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                BTC dominance, market share breakdown, and global crypto market stats
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Loading */}
          {loading && !data && (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
              <span className="ml-3 text-neutral-400">Loading dominance data...</span>
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
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">Total Market Cap</p>
                  <p className="text-lg font-bold text-white">
                    {data.totalMarketCap != null ? `$${formatCompact(data.totalMarketCap)}` : '-'}
                  </p>
                  {data.marketCapChange24h != null && (
                    <p className={`text-xs flex items-center gap-1 mt-0.5 ${data.marketCapChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.marketCapChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {data.marketCapChange24h >= 0 ? '+' : ''}{data.marketCapChange24h.toFixed(2)}%
                    </p>
                  )}
                </div>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">24h Volume</p>
                  <p className="text-lg font-bold text-white">
                    {data.totalVolume24h != null ? `$${formatCompact(data.totalVolume24h)}` : '-'}
                  </p>
                </div>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">Active Cryptos</p>
                  <p className="text-lg font-bold text-white">
                    {data.activeCryptos != null ? data.activeCryptos.toLocaleString() : '-'}
                  </p>
                </div>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">Markets</p>
                  <p className="text-lg font-bold text-white">
                    {data.markets != null ? data.markets.toLocaleString() : '-'}
                  </p>
                </div>
              </div>

              {/* Dominance Gauges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                {/* BTC Dominance */}
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-6 flex flex-col items-center">
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
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-6 flex flex-col items-center">
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
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5 mb-6">
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

              {/* Stacked Bar */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5 mb-6">
                <h2 className="text-sm font-semibold text-white mb-3">Visual Breakdown</h2>
                <div className="h-10 rounded-lg overflow-hidden flex">
                  {breakdown.map((entry, i) => (
                    <div
                      key={entry.symbol}
                      className="h-full relative group"
                      style={{
                        width: `${entry.pct}%`,
                        backgroundColor: COLORS[i] || COLORS[COLORS.length - 1],
                      }}
                      title={`${entry.symbol}: ${entry.pct.toFixed(2)}%`}
                    >
                      {entry.pct > 5 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90">
                          {entry.symbol}
                        </span>
                      )}
                    </div>
                  ))}
                  {othersPercent > 2 && (
                    <div
                      className="h-full bg-neutral-600"
                      style={{ width: `${othersPercent}%` }}
                      title={`Others: ${othersPercent.toFixed(2)}%`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {breakdown.slice(0, 6).map((entry, i) => (
                    <div key={entry.symbol} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-[10px] text-neutral-400">{entry.symbol} {entry.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Info footer */}
          <div className="mt-8 bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 border-l-2 border-l-hub-yellow">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
              <div className="text-xs text-neutral-400 space-y-1">
                <p>
                  <strong className="text-neutral-300">Market Dominance</strong> tracks the market cap
                  share of each cryptocurrency relative to the total crypto market.
                </p>
                <p>
                  Rising BTC dominance typically indicates a &quot;flight to safety&quot; within crypto.
                  Falling BTC dominance often signals an &quot;altseason&quot; where altcoins outperform.
                </p>
                <p>Data sourced from CoinGecko. Updates every 5 minutes.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
