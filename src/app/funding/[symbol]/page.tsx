'use client';

import { useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Percent, Activity, DollarSign } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { fetchAllFundingRates, fetchAllOpenInterest } from '@/lib/api/aggregator';
import { FundingRateData, OpenInterestData } from '@/lib/api/types';
import { isExchangeDex } from '@/lib/constants';
import { formatRate, getRateColor } from '../utils';
import { isValidNumber } from '@/lib/utils/format';
import { getFundingHistory, getAccumulatedFundingBatch, type HistoryPoint, type AccumulatedFunding } from '@/lib/storage/fundingHistory';
import FundingSparkline from '../components/FundingSparkline';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

// Hex colors for chart lines per exchange
const EXCHANGE_HEX: Record<string, string> = {
  'Binance': '#EAB308',
  'Bybit': '#F97316',
  'OKX': '#FFFFFF',
  'Bitget': '#22D3EE',
  'MEXC': '#14B8A6',
  'Kraken': '#8B5CF6',
  'BingX': '#3B82F6',
  'Phemex': '#84CC16',
  'Hyperliquid': '#4ADE80',
  'dYdX': '#A855F7',
  'Aster': '#EC4899',
  'Lighter': '#34D399',
  'Aevo': '#FB7185',
  'KuCoin': '#22C55E',
  'Deribit': '#60A5FA',
  'HTX': '#3B82F6',
  'Bitfinex': '#16A34A',
  'WhiteBIT': '#D1D5DB',
  'Coinbase': '#2563EB',
  'CoinEx': '#2DD4BF',
  'gTrade': '#14B8A6',
};

type TimeRange = '7d' | '30d';

function formatOI(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default function SymbolFundingPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = (params.symbol as string || '').toUpperCase();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  // Fetch all funding rates (same as main page)
  const fetcher = useCallback(async () => {
    const [rates, oi] = await Promise.all([
      fetchAllFundingRates('crypto'),
      fetchAllOpenInterest(),
    ]);
    return { rates, oi };
  }, []);

  const { data, isLoading, error, lastUpdate } = useApiData({
    fetcher,
    refreshInterval: 30000,
  });

  // Filter to this symbol
  const symbolRates = useMemo(() => {
    if (!data?.rates) return [];
    return data.rates.filter((r: FundingRateData) => r.symbol === symbol);
  }, [data?.rates, symbol]);

  // OI map for this symbol
  const oiMap = useMemo(() => {
    if (!data?.oi) return new Map<string, number>();
    const map = new Map<string, number>();
    data.oi.forEach((o: OpenInterestData) => {
      if (o.symbol === symbol) {
        map.set(`${o.symbol}|${o.exchange}`, o.openInterestValue);
      }
    });
    return map;
  }, [data?.oi, symbol]);

  // Accumulated funding map
  const accumulatedMap = useMemo(() => {
    if (typeof window === 'undefined' || symbolRates.length === 0) return new Map<string, AccumulatedFunding>();
    const pairs = symbolRates.map((fr: FundingRateData) => ({ symbol: fr.symbol, exchange: fr.exchange }));
    return getAccumulatedFundingBatch(pairs);
  }, [symbolRates]);

  // Stats — normalize all rates to 8h basis for average comparison
  const stats = useMemo(() => {
    if (symbolRates.length === 0) return null;
    const normalize8h = (r: FundingRateData) => {
      if (r.fundingInterval === '1h') return r.fundingRate * 8;
      if (r.fundingInterval === '4h') return r.fundingRate * 2;
      return r.fundingRate;
    };
    const rates8h = symbolRates.map(normalize8h);
    const avg = rates8h.reduce((a: number, b: number) => a + b, 0) / rates8h.length;
    const sorted = [...symbolRates].sort((a: FundingRateData, b: FundingRateData) => normalize8h(b) - normalize8h(a));
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    let totalOI = 0;
    oiMap.forEach(v => { totalOI += v; });
    return { avg, highest, lowest, totalOI, count: symbolRates.length };
  }, [symbolRates, oiMap]);

  // History data for chart — per-exchange lines
  const exchanges = useMemo(() => {
    return Array.from(new Set(symbolRates.map((r: FundingRateData) => r.exchange)));
  }, [symbolRates]);

  const days = timeRange === '7d' ? 7 : 30;

  const chartData = useMemo(() => {
    if (typeof window === 'undefined' || exchanges.length === 0) return [];

    // Get history for each exchange
    const exchangeHistories: Record<string, HistoryPoint[]> = {};
    exchanges.forEach(ex => {
      exchangeHistories[ex] = getFundingHistory(symbol, ex, days);
    });

    // Collect all unique timestamps
    const allTimestamps = new Set<number>();
    Object.values(exchangeHistories).forEach(history => {
      history.forEach(p => allTimestamps.add(p.t));
    });

    // Sort and build chart points
    const sortedTimes = Array.from(allTimestamps).sort((a, b) => a - b);
    return sortedTimes.map(t => {
      const point: Record<string, any> = { time: t };
      exchanges.forEach(ex => {
        const hp = exchangeHistories[ex].find(p => p.t === t);
        if (hp) point[ex] = hp.rate;
      });
      return point;
    });
  }, [exchanges, symbol, days]);

  const hasChartData = chartData.length >= 2;

  if (!symbol) {
    router.push('/funding');
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Back nav */}
        <Link
          href="/funding"
          className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Funding
        </Link>

        {/* Symbol header */}
        <div className="flex items-center gap-4 mb-8">
          <TokenIconSimple symbol={symbol} size={40} />
          <div>
            <h1 className="text-2xl font-bold text-white">{symbol}</h1>
            <p className="text-neutral-600 text-sm mt-0.5">
              Funding rates across {symbolRates.length} exchanges
              {stats && (
                <span className="ml-2">
                  · Avg{' '}
                  <span className={getRateColor(stats.avg)}>
                    {formatRate(stats.avg)}
                  </span>
                  {stats.avg >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 inline ml-1 text-success" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 inline ml-1 text-danger" />
                  )}
                </span>
              )}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-neutral-600">
            <p>Failed to load data: {error}</p>
          </div>
        ) : symbolRates.length === 0 ? (
          <div className="text-center py-20 text-neutral-600">
            <p className="text-lg mb-2">No funding data found for {symbol}</p>
            <Link href="/funding" className="text-hub-yellow hover:underline text-sm">
              Browse all symbols →
            </Link>
          </div>
        ) : (
          <>
            {/* Stats cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2">
                    <Percent className="w-3.5 h-3.5" />
                    Avg Rate
                  </div>
                  <div className={`text-lg font-bold font-mono ${getRateColor(stats.avg)}`}>
                    {formatRate(stats.avg)}
                  </div>
                  <div className="text-neutral-600 text-xs mt-1">
                    {(stats.avg * 3 * 365).toFixed(1)}% annualized
                  </div>
                </div>

                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Highest
                  </div>
                  <div className={`text-lg font-bold font-mono ${getRateColor(stats.highest.fundingRate)}`}>
                    {formatRate(stats.highest.fundingRate)}
                  </div>
                  <div className="text-neutral-600 text-xs mt-1 flex items-center gap-1">
                    <ExchangeLogo exchange={stats.highest.exchange.toLowerCase()} size={12} />
                    {stats.highest.exchange}
                  </div>
                </div>

                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Lowest
                  </div>
                  <div className={`text-lg font-bold font-mono ${getRateColor(stats.lowest.fundingRate)}`}>
                    {formatRate(stats.lowest.fundingRate)}
                  </div>
                  <div className="text-neutral-600 text-xs mt-1 flex items-center gap-1">
                    <ExchangeLogo exchange={stats.lowest.exchange.toLowerCase()} size={12} />
                    {stats.lowest.exchange}
                  </div>
                </div>

                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2">
                    <Activity className="w-3.5 h-3.5" />
                    Total OI
                  </div>
                  <div className="text-lg font-bold font-mono text-white">
                    {stats.totalOI > 0 ? formatOI(stats.totalOI) : '—'}
                  </div>
                  <div className="text-neutral-600 text-xs mt-1">
                    {stats.count} exchanges
                  </div>
                </div>
              </div>
            )}

            {/* Historical Chart */}
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden mb-8">
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-white font-semibold text-sm">Funding Rate History</h2>
                  <p className="text-neutral-600 text-xs mt-0.5">Per-exchange rates over time (data builds as you visit)</p>
                </div>
                <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
                  {(['7d', '30d'] as TimeRange[]).map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        timeRange === range
                          ? 'bg-hub-yellow text-black'
                          : 'text-neutral-600 hover:text-white'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4">
                {hasChartData ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(t: number) =>
                          new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        }
                        stroke="#525252"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(4)}%`}
                        stroke="#525252"
                        tick={{ fontSize: 10 }}
                        width={70}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        labelFormatter={(t: number) =>
                          new Date(t).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })
                        }
                        formatter={(value: number, name: string) => [
                          `${value >= 0 ? '+' : ''}${value.toFixed(4)}%`,
                          name,
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        iconType="line"
                      />
                      {exchanges.map(ex => (
                        <Line
                          key={ex}
                          type="monotone"
                          dataKey={ex}
                          stroke={EXCHANGE_HEX[ex] || '#737373'}
                          dot={false}
                          strokeWidth={1.5}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-neutral-600">
                    <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">Not enough history data yet</p>
                    <p className="text-xs mt-1 text-neutral-700">
                      History builds automatically as you visit the funding page. Check back later!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Exchange Comparison Table */}
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden mb-8">
              <div className="p-4 border-b border-white/[0.06]">
                <h2 className="text-white font-semibold text-sm">Exchange Comparison</h2>
                <p className="text-neutral-600 text-xs mt-0.5">
                  Current rates for {symbol} across all exchanges
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-left">Exchange</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Current Rate</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Predicted</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-center">7d</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Acc 1D</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Acc 7D</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Annualized</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Open Interest</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Mark Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {symbolRates
                      .sort((a: FundingRateData, b: FundingRateData) => b.fundingRate - a.fundingRate)
                      .map((fr: FundingRateData, i: number) => {
                        const periodsPerDay = fr.fundingInterval === '1h' ? 24 : fr.fundingInterval === '4h' ? 6 : 3;
                        const annualized = fr.fundingRate * periodsPerDay * 365;
                        const pairKey = `${fr.symbol}|${fr.exchange}`;
                        const oiVal = oiMap.get(pairKey);
                        const accumulated = accumulatedMap.get(pairKey);
                        const history = typeof window !== 'undefined'
                          ? getFundingHistory(fr.symbol, fr.exchange, 7)
                          : [];
                        return (
                          <tr
                            key={`${fr.exchange}-${i}`}
                            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <ExchangeLogo exchange={fr.exchange.toLowerCase()} size={18} />
                                <span className="text-white text-sm font-medium">{fr.exchange}</span>
                                {isExchangeDex(fr.exchange) && (
                                  <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-mono font-semibold text-sm ${getRateColor(fr.fundingRate)}`}>
                                {formatRate(fr.fundingRate)}
                              </span>
                              {fr.fundingInterval === '1h' && (
                                <span className="text-amber-400 text-[10px] ml-0.5 font-bold cursor-help" title={`${formatRate(fr.fundingRate)} funding fee every 1 hour`}>*</span>
                              )}
                              {fr.fundingInterval === '4h' && (
                                <span className="text-blue-400 text-[10px] ml-0.5 font-bold cursor-help" title={`${formatRate(fr.fundingRate)} funding fee every 4 hours`}>**</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {fr.predictedRate !== undefined && fr.predictedRate !== null ? (
                                <span className={`font-mono text-xs ${getRateColor(fr.predictedRate)}`}>
                                  {formatRate(fr.predictedRate)}
                                </span>
                              ) : (
                                <span className="text-neutral-700 text-xs">&mdash;</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <FundingSparkline history={history} width={72} height={22} />
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {accumulated && accumulated.d1 !== 0 ? (
                                <span className={`font-mono text-xs ${getRateColor(accumulated.d1)}`}>
                                  {accumulated.d1 >= 0 ? '+' : ''}{accumulated.d1.toFixed(4)}%
                                </span>
                              ) : (
                                <span className="text-neutral-700 text-xs">&mdash;</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {accumulated && accumulated.d7 !== 0 ? (
                                <span className={`font-mono text-xs ${getRateColor(accumulated.d7)}`}>
                                  {accumulated.d7 >= 0 ? '+' : ''}{accumulated.d7.toFixed(4)}%
                                </span>
                              ) : (
                                <span className="text-neutral-700 text-xs">&mdash;</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-mono text-xs ${getRateColor(annualized)}`}>
                                {annualized >= 0 ? '+' : ''}{annualized.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {oiVal ? (
                                <span className="text-neutral-400 font-mono text-xs">{formatOI(oiVal)}</span>
                              ) : (
                                <span className="text-neutral-700 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-neutral-400 font-mono text-xs">
                                {isValidNumber(fr.markPrice) && fr.markPrice! > 0
                                  ? `$${fr.markPrice!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                                  : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Accumulated Funding Panel */}
            {accumulatedMap.size > 0 && (
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden mb-8">
                <div className="p-4 border-b border-white/[0.06]">
                  <h2 className="text-white font-semibold text-sm">Accumulated Funding</h2>
                  <p className="text-neutral-600 text-xs mt-0.5">
                    Cumulative funding paid/received per exchange (from your browsing history)
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {symbolRates
                    .sort((a: FundingRateData, b: FundingRateData) => {
                      const accA = accumulatedMap.get(`${a.symbol}|${a.exchange}`);
                      const accB = accumulatedMap.get(`${b.symbol}|${b.exchange}`);
                      return Math.abs(accB?.d7 || 0) - Math.abs(accA?.d7 || 0);
                    })
                    .map((fr: FundingRateData) => {
                      const pairKey = `${fr.symbol}|${fr.exchange}`;
                      const acc = accumulatedMap.get(pairKey);
                      if (!acc) return null;
                      return (
                        <div
                          key={pairKey}
                          className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <ExchangeLogo exchange={fr.exchange.toLowerCase()} size={16} />
                            <span className="text-white text-sm font-medium">{fr.exchange}</span>
                            {isExchangeDex(fr.exchange) && (
                              <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <div className="text-neutral-600 text-[10px] mb-0.5">1D</div>
                              <div className={`font-mono text-xs font-medium ${getRateColor(acc.d1)}`}>
                                {acc.d1 !== 0 ? `${acc.d1 >= 0 ? '+' : ''}${acc.d1.toFixed(4)}%` : '—'}
                              </div>
                            </div>
                            <div>
                              <div className="text-neutral-600 text-[10px] mb-0.5">7D</div>
                              <div className={`font-mono text-xs font-medium ${getRateColor(acc.d7)}`}>
                                {acc.d7 !== 0 ? `${acc.d7 >= 0 ? '+' : ''}${acc.d7.toFixed(4)}%` : '—'}
                              </div>
                            </div>
                            <div>
                              <div className="text-neutral-600 text-[10px] mb-0.5">30D</div>
                              <div className={`font-mono text-xs font-medium ${getRateColor(acc.d30)}`}>
                                {acc.d30 !== 0 ? `${acc.d30 >= 0 ? '+' : ''}${acc.d30.toFixed(4)}%` : '—'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                    .filter(Boolean)}
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
