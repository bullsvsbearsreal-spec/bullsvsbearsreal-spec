'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApi } from '@/hooks/useSWRApi';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { RefreshCw, AlertTriangle, BarChart3, Table } from 'lucide-react';
import { formatUSD } from '@/lib/utils/format';

const ComparisonCharts = dynamic(() => import('./components/ComparisonCharts'), { ssr: false });

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

function formatRate(r: number): string {
  return `${r >= 0 ? '+' : ''}${(r * 100).toFixed(4)}%`;
}

export default function ExchangeComparisonPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [sortKey, setSortKey] = useState<SortKey>('oi');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');

  const { data, error, isLoading, lastUpdate, refresh, isRefreshing } = useApi<{
    oi: any[];
    funding: any[];
    tickers: any[];
  }>({
    key: 'exchange-comparison',
    fetcher: useCallback(async () => {
      const [oiRes, fundingRes, tickerRes] = await Promise.all([
        fetch('/api/openinterest'),
        fetch('/api/funding'),
        fetch('/api/tickers'),
      ]);
      const oiJson = oiRes.ok ? await oiRes.json() : { data: [] };
      const fundingJson = fundingRes.ok ? await fundingRes.json() : { data: [] };
      const tickerJson = tickerRes.ok ? await tickerRes.json() : [];
      return {
        oi: Array.isArray(oiJson.data) ? oiJson.data : [],
        funding: Array.isArray(fundingJson.data) ? fundingJson.data : [],
        tickers: Array.isArray(tickerJson) ? tickerJson : Array.isArray(tickerJson?.data) ? tickerJson.data : [],
      };
    }, []),
    refreshInterval: 60000,
  });

  // Aggregate stats per exchange
  const exchangeStats = useMemo((): ExchangeStats[] => {
    if (!data) return [];
    const oi = Array.isArray(data.oi) ? data.oi : [];
    const funding = Array.isArray(data.funding) ? data.funding : [];
    const tickers = Array.isArray(data.tickers) ? data.tickers : [];
    const statsMap = new Map<string, ExchangeStats>();

    // OI per exchange
    oi.forEach((item: any) => {
      const ex = item.exchange || 'Unknown';
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
      statsMap.get(ex)!.totalOI += item.openInterestValue || 0;
    });

    // Funding per exchange
    const fundingCounts = new Map<string, { sum: number; count: number }>();
    funding.forEach((fr: any) => {
      const ex = fr.exchange || 'Unknown';
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
      const s = statsMap.get(ex)!;
      s.fundingBySymbol.set(fr.symbol, fr.fundingRate);
      if (!fundingCounts.has(ex)) fundingCounts.set(ex, { sum: 0, count: 0 });
      const fc = fundingCounts.get(ex)!;
      fc.sum += fr.fundingRate;
      fc.count += 1;
    });

    fundingCounts.forEach((fc, ex) => {
      const s = statsMap.get(ex);
      if (s) s.avgFunding = fc.count > 0 ? fc.sum / fc.count : 0;
    });

    // Symbol count and volume from tickers
    const tickerSymbolSets = new Map<string, Set<string>>();
    tickers.forEach((t: any) => {
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
    (Array.isArray(data.funding) ? data.funding : []).forEach((fr: any) => symSet.add(fr.symbol));
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
    <div className="min-h-screen bg-hub-black text-white">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="heading-page">Exchange Comparison</h1>
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

        {/* Empty state */}
        {!isLoading && !error && sorted.length === 0 && data && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-neutral-500 text-sm mb-2">No exchange data available</div>
            <div className="text-neutral-600 text-xs">Exchange data may be temporarily unavailable</div>
          </div>
        )}

        {!isLoading && sorted.length > 0 && (
          <>
            {viewMode === 'chart' ? (
              <ComparisonCharts
                oiChartData={oiChartData}
                fundingForSymbol={fundingForSymbol}
                selectedSymbol={selectedSymbol}
                onSymbolChange={setSelectedSymbol}
                availableSymbols={availableSymbols}
              />
            ) : (
              /* Table view */
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
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
                        const totalAllOI = sorted.reduce((sum, x) => sum + x.totalOI, 0) || 1;
                        const share = (s.totalOI / totalAllOI) * 100;
                        return (
                          <tr key={s.exchange} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-2.5 text-neutral-600">{i + 1}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <ExchangeLogo exchange={s.exchange.toLowerCase()} size={16} />
                                <span className="font-medium text-white">{s.exchange}</span>
                              </div>
                            </td>
                            <td className="text-right px-4 py-2.5 text-white font-mono">{formatUSD(s.totalOI)}</td>
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
