'use client';

import { useState, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import { fetchAllOpenInterest, fetchAllFundingRates, fetchAllTickers, aggregateOpenInterestByExchange } from '@/lib/api/aggregator';
import { OpenInterestData, FundingRateData, TickerData } from '@/lib/api/types';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { RefreshCw, AlertTriangle, BarChart3, Table } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type ViewMode = 'chart' | 'table';
type SortKey = 'oi' | 'funding' | 'volume' | 'symbols';

interface ExchangeStats {
  exchange: string;
  totalOI: number;
  avgFunding: number;
  symbolCount: number;
  totalVolume: number;
  fundingBySymbol: Map<string, number>;
}

const CHART_COLORS = [
  '#FFDF00', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#a855f7',
  '#ef4444', '#84cc16', '#e879f9', '#fbbf24', '#6366f1',
  '#10b981', '#f43f5e', '#0ea5e9',
];

function formatOI(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

function formatRate(r: number): string {
  return `${r >= 0 ? '+' : ''}${(r * 100).toFixed(4)}%`;
}

function OITooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-2.5 shadow-xl text-xs">
      <div className="font-medium text-white mb-1">{d.exchange}</div>
      <div className="text-neutral-400">Open Interest: <span className="text-white font-mono">{formatOI(d.totalOI)}</span></div>
      <div className="text-neutral-400">Symbols: <span className="text-white font-mono">{d.symbolCount}</span></div>
    </div>
  );
}

function FundingTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-lg p-2.5 shadow-xl text-xs">
      <div className="font-medium text-white mb-1">{d.exchange}</div>
      <div className="text-neutral-400">Funding Rate: <span className={`font-mono ${d.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRate(d.rate)}</span></div>
    </div>
  );
}

export default function ExchangeComparisonPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [sortKey, setSortKey] = useState<SortKey>('oi');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');

  const { data, error, isLoading, lastUpdate, refresh, isRefreshing } = useApiData<{
    oi: OpenInterestData[];
    funding: FundingRateData[];
    tickers: TickerData[];
  }>({
    fetcher: useCallback(async () => {
      const [oi, funding, tickers] = await Promise.all([
        fetchAllOpenInterest(),
        fetchAllFundingRates(),
        fetchAllTickers(),
      ]);
      return { oi, funding, tickers };
    }, []),
    refreshInterval: 60000,
  });

  // Aggregate stats per exchange
  const exchangeStats = useMemo((): ExchangeStats[] => {
    if (!data) return [];
    const { oi, funding, tickers } = data;
    const statsMap = new Map<string, ExchangeStats>();

    // OI per exchange
    oi.forEach(item => {
      if (!statsMap.has(item.exchange)) {
        statsMap.set(item.exchange, {
          exchange: item.exchange,
          totalOI: 0,
          avgFunding: 0,
          symbolCount: 0,
          totalVolume: 0,
          fundingBySymbol: new Map(),
        });
      }
      statsMap.get(item.exchange)!.totalOI += item.openInterestValue;
    });

    // Funding per exchange
    const fundingCounts = new Map<string, { sum: number; count: number }>();
    funding.forEach(fr => {
      if (!statsMap.has(fr.exchange)) {
        statsMap.set(fr.exchange, {
          exchange: fr.exchange,
          totalOI: 0,
          avgFunding: 0,
          symbolCount: 0,
          totalVolume: 0,
          fundingBySymbol: new Map(),
        });
      }
      const s = statsMap.get(fr.exchange)!;
      s.fundingBySymbol.set(fr.symbol, fr.fundingRate);
      if (!fundingCounts.has(fr.exchange)) fundingCounts.set(fr.exchange, { sum: 0, count: 0 });
      const fc = fundingCounts.get(fr.exchange)!;
      fc.sum += fr.fundingRate;
      fc.count += 1;
    });

    fundingCounts.forEach((fc, ex) => {
      const s = statsMap.get(ex);
      if (s) s.avgFunding = fc.count > 0 ? fc.sum / fc.count : 0;
    });

    // Symbol count and volume from tickers
    const tickerSymbolSets = new Map<string, Set<string>>();
    tickers.forEach(t => {
      const ex = t.exchange || 'Unknown';
      if (!statsMap.has(ex)) {
        statsMap.set(ex, {
          exchange: ex,
          totalOI: 0,
          avgFunding: 0,
          symbolCount: 0,
          totalVolume: 0,
          fundingBySymbol: new Map(),
        });
      }
      if (!tickerSymbolSets.has(ex)) tickerSymbolSets.set(ex, new Set());
      tickerSymbolSets.get(ex)!.add(t.symbol);
      statsMap.get(ex)!.totalVolume += t.quoteVolume24h || 0;
    });

    tickerSymbolSets.forEach((symbols, ex) => {
      const s = statsMap.get(ex);
      if (s) s.symbolCount = symbols.size;
    });

    return Array.from(statsMap.values());
  }, [data]);

  // Sorted exchanges
  const sorted = useMemo(() => {
    const copy = [...exchangeStats];
    switch (sortKey) {
      case 'oi': return copy.sort((a, b) => b.totalOI - a.totalOI);
      case 'funding': return copy.sort((a, b) => Math.abs(b.avgFunding) - Math.abs(a.avgFunding));
      case 'volume': return copy.sort((a, b) => b.totalVolume - a.totalVolume);
      case 'symbols': return copy.sort((a, b) => b.symbolCount - a.symbolCount);
      default: return copy;
    }
  }, [exchangeStats, sortKey]);

  // Funding for selected symbol
  const fundingForSymbol = useMemo(() => {
    return sorted
      .filter(s => s.fundingBySymbol.has(selectedSymbol))
      .map(s => ({
        exchange: s.exchange,
        rate: s.fundingBySymbol.get(selectedSymbol) || 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [sorted, selectedSymbol]);

  // Available symbols for selector
  const availableSymbols = useMemo(() => {
    if (!data) return ['BTC', 'ETH'];
    const symSet = new Set<string>();
    data.funding.forEach(fr => symSet.add(fr.symbol));
    return Array.from(symSet).sort();
  }, [data]);

  // OI chart data
  const oiChartData = useMemo(() => {
    return sorted
      .filter(s => s.totalOI > 0)
      .map(s => ({
        exchange: s.exchange,
        totalOI: s.totalOI,
        symbolCount: s.symbolCount,
      }));
  }, [sorted]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold text-white">Exchange Comparison</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Compare {sorted.length} exchanges by OI, funding rates, and symbol coverage
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[11px] text-neutral-600">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'chart' ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Chart
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" /> Table
            </button>
          </div>

          {/* Sort */}
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {(['oi', 'funding', 'volume', 'symbols'] as SortKey[]).map(k => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  sortKey === k ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {k === 'oi' ? 'OI' : k === 'funding' ? 'Funding' : k === 'volume' ? 'Volume' : 'Symbols'}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
          </div>
        )}

        {!isLoading && sorted.length > 0 && (
          <>
            {viewMode === 'chart' ? (
              <div className="space-y-6">
                {/* OI Bar Chart */}
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-sm font-medium text-neutral-400 mb-3">Total Open Interest by Exchange</div>
                  <ResponsiveContainer width="100%" height={Math.max(300, oiChartData.length * 36)}>
                    <BarChart data={oiChartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                      <XAxis type="number" tickFormatter={formatOI} tick={{ fill: '#525252', fontSize: 10 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
                      <YAxis type="category" dataKey="exchange" tick={{ fill: '#a3a3a3', fontSize: 11 }} axisLine={false} tickLine={false} width={75} />
                      <Tooltip content={<OITooltip />} />
                      <Bar dataKey="totalOI" radius={[0, 4, 4, 0]} barSize={20}>
                        {oiChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Funding Rate per symbol */}
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-neutral-400">
                      Funding Rate by Exchange — {selectedSymbol}
                    </div>
                    <select
                      value={selectedSymbol}
                      onChange={e => setSelectedSymbol(e.target.value)}
                      className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-white"
                    >
                      {availableSymbols.slice(0, 50).map(sym => (
                        <option key={sym} value={sym}>{sym}</option>
                      ))}
                    </select>
                  </div>
                  {fundingForSymbol.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(200, fundingForSymbol.length * 32)}>
                      <BarChart data={fundingForSymbol} layout="vertical" margin={{ left: 80, right: 20 }}>
                        <XAxis type="number" tickFormatter={v => `${(v * 100).toFixed(3)}%`} tick={{ fill: '#525252', fontSize: 10 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
                        <YAxis type="category" dataKey="exchange" tick={{ fill: '#a3a3a3', fontSize: 11 }} axisLine={false} tickLine={false} width={75} />
                        <Tooltip content={<FundingTooltip />} />
                        <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={18}>
                          {fundingForSymbol.map((d, i) => (
                            <Cell key={i} fill={d.rate >= 0 ? '#22c55e' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8 text-neutral-600 text-sm">No funding data for {selectedSymbol}</div>
                  )}
                </div>
              </div>
            ) : (
              /* Table view */
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">#</th>
                        <th className="text-left px-4 py-2.5 text-neutral-500 font-medium">Exchange</th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 font-medium cursor-pointer hover:text-white" onClick={() => setSortKey('oi')}>
                          Open Interest {sortKey === 'oi' && '↓'}
                        </th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 font-medium cursor-pointer hover:text-white" onClick={() => setSortKey('funding')}>
                          Avg Funding {sortKey === 'funding' && '↓'}
                        </th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 font-medium cursor-pointer hover:text-white" onClick={() => setSortKey('symbols')}>
                          Symbols {sortKey === 'symbols' && '↓'}
                        </th>
                        <th className="px-4 py-2.5 text-neutral-500 font-medium">OI Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((s, i) => {
                        const maxOI = sorted[0]?.totalOI || 1;
                        const share = (s.totalOI / maxOI) * 100;
                        return (
                          <tr key={s.exchange} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-2.5 text-neutral-600">{i + 1}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <ExchangeLogo exchange={s.exchange.toLowerCase()} size={16} />
                                <span className="font-medium text-white">{s.exchange}</span>
                              </div>
                            </td>
                            <td className="text-right px-4 py-2.5 text-white font-mono">{formatOI(s.totalOI)}</td>
                            <td className={`text-right px-4 py-2.5 font-mono ${s.avgFunding >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatRate(s.avgFunding)}
                            </td>
                            <td className="text-right px-4 py-2.5 text-white font-mono">{s.symbolCount}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-hub-yellow transition-all"
                                    style={{ width: `${share}%` }}
                                  />
                                </div>
                                <span className="text-neutral-500 text-[10px] w-10 text-right">{share.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
