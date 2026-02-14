'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { RefreshCw, Info, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCompact } from '@/lib/utils/format';

/* ─── Types ──────────────────────────────────────────────────────── */

interface StablecoinData {
  id: string;
  name: string;
  symbol: string;
  mcap: number;
  price: number;
  chains: Record<string, number>;
  chainCount: number;
  change7d: number | null;
  change30d: number | null;
}

interface Response {
  stablecoins: StablecoinData[];
  totalMcap: number;
  count: number;
}

/* ─── Chain colors ───────────────────────────────────────────────── */

const CHAIN_COLORS: Record<string, string> = {
  Ethereum: '#627eea',
  Tron: '#ef0027',
  BSC: '#F0B90B',
  Solana: '#14f195',
  Avalanche: '#e84142',
  Polygon: '#8247e5',
  Arbitrum: '#28a0f0',
  Optimism: '#ff0420',
  Base: '#0052ff',
  Fantom: '#1969ff',
  Near: '#00ec97',
  Sui: '#6fbcf0',
  TON: '#0098EA',
};

function getChainColor(chain: string): string {
  return CHAIN_COLORS[chain] || '#888';
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function StablecoinFlowsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/stablecoins');
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
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Chain aggregation across all stablecoins
  const chainTotals = useMemo(() => {
    if (!data) return [];
    const totals = new Map<string, number>();
    data.stablecoins.forEach((s) => {
      Object.entries(s.chains).forEach(([chain, val]) => {
        totals.set(chain, (totals.get(chain) || 0) + val);
      });
    });
    const arr: Array<{ chain: string; value: number }> = [];
    totals.forEach((value, chain) => arr.push({ chain, value }));
    arr.sort((a, b) => b.value - a.value);
    return arr.slice(0, 15);
  }, [data]);

  const totalChainValue = useMemo(
    () => chainTotals.reduce((s, c) => s + c.value, 0),
    [chainTotals],
  );

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-hub-yellow" />
                Stablecoin Flows
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Track stablecoin market caps, chain distribution, and weekly/monthly changes
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

          {loading && !data && (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
              <span className="ml-3 text-neutral-400">Loading stablecoin data...</span>
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
              {/* Total Market Cap */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-6 py-5 mb-6">
                <p className="text-xs text-neutral-500 mb-1">Total Stablecoin Market Cap</p>
                <p className="text-3xl font-bold text-white">${formatCompact(data.totalMcap)}</p>
                <p className="text-xs text-neutral-500 mt-1">{data.count} USD-pegged stablecoins tracked</p>
              </div>

              {/* Chain Distribution */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5 mb-6">
                <h2 className="text-sm font-semibold text-white mb-4">Chain Distribution</h2>
                {/* Stacked bar */}
                <div className="h-8 rounded-lg overflow-hidden flex mb-4">
                  {chainTotals.map((c) => (
                    <div
                      key={c.chain}
                      className="h-full relative group"
                      style={{
                        width: `${(c.value / totalChainValue) * 100}%`,
                        backgroundColor: getChainColor(c.chain),
                        minWidth: '2px',
                      }}
                      title={`${c.chain}: $${formatCompact(c.value)}`}
                    >
                      {(c.value / totalChainValue) * 100 > 8 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90">
                          {c.chain}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Breakdown list */}
                <div className="space-y-2">
                  {chainTotals.map((c) => (
                    <div key={c.chain} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: getChainColor(c.chain) }} />
                      <span className="text-xs text-neutral-300 w-24">{c.chain}</span>
                      <div className="flex-1 h-4 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(c.value / totalChainValue) * 100}%`,
                            backgroundColor: getChainColor(c.chain),
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-neutral-400 w-20 text-right">
                        ${formatCompact(c.value)}
                      </span>
                      <span className="text-xs text-neutral-600 w-12 text-right">
                        {((c.value / totalChainValue) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stablecoin Table */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500">Stablecoin</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500">Market Cap</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500">Share</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500">7d Change</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500">30d Change</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500">Chains</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stablecoins.map((s, i) => {
                        const share = (s.mcap / data.totalMcap) * 100;
                        const isExpanded = expandedId === s.id;
                        const topChains = Object.entries(s.chains)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 6);

                        return (
                          <tr
                            key={s.id}
                            className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                            onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          >
                            <td className="px-4 py-3 text-xs text-neutral-600">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-white">{s.name}</div>
                              <div className="text-xs text-neutral-500">{s.symbol}</div>
                              {/* Expanded chain breakdown */}
                              {isExpanded && topChains.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {topChains.map(([chain, val]) => (
                                    <div key={chain} className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: getChainColor(chain) }} />
                                      <span className="text-[10px] text-neutral-500">{chain}</span>
                                      <span className="text-[10px] text-neutral-600">${formatCompact(val)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-mono text-white">
                              ${formatCompact(s.mcap)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-hub-yellow rounded-full"
                                    style={{ width: `${Math.min(share, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-neutral-400 w-12 text-right">{share.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {s.change7d != null ? (
                                <span className={`text-xs font-mono flex items-center justify-end gap-1 ${s.change7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {s.change7d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {s.change7d >= 0 ? '+' : ''}{s.change7d.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-xs text-neutral-600">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {s.change30d != null ? (
                                <span className={`text-xs font-mono flex items-center justify-end gap-1 ${s.change30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {s.change30d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {s.change30d >= 0 ? '+' : ''}{s.change30d.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-xs text-neutral-600">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-neutral-400">{s.chainCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                  <strong className="text-neutral-300">Stablecoin Flows</strong> tracks the total supply
                  and chain distribution of USD-pegged stablecoins.
                </p>
                <p>
                  Rising stablecoin market cap = capital entering crypto (bullish signal).
                  Falling market cap = capital exiting (bearish signal). Watch for large weekly changes.
                </p>
                <p>Data sourced from DefiLlama. Updates every 5 minutes.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
