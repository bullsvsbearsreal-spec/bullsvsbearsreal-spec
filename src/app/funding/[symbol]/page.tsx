'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { ArrowLeft, TrendingUp, TrendingDown, Percent, Activity, DollarSign, Eye, EyeOff, Check, BarChart3, Zap, LineChart, ArrowLeftRight } from 'lucide-react';
import DataFreshness from '@/components/DataFreshness';
import { useFlash } from '@/hooks/useFlash';
import { useApi } from '@/hooks/useSWRApi';
import { fetchAllFundingRates, fetchAllOpenInterest } from '@/lib/api/aggregator';
import { FundingRateData, OpenInterestData } from '@/lib/api/types';
import { isExchangeDex } from '@/lib/constants';
import { formatRate, getRateColor } from '../utils';
import { isValidNumber, formatUSD } from '@/lib/utils/format';
import { saveFundingSnapshot, getFundingHistory, getAccumulatedFundingBatch, type HistoryPoint, type AccumulatedFunding } from '@/lib/storage/fundingHistory';
import FundingSparkline from '../components/FundingSparkline';
import { useTrackPageView } from '@/hooks/useTrackPageView';

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

const FundingCharts = dynamic(() => import('./FundingCharts'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-white/[0.04] rounded-lg" />,
});

export default function SymbolFundingPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = (params.symbol as string || '').toUpperCase();
  useTrackPageView(`${symbol} Funding`, symbol);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  // Read funding prefs from synced localStorage key (auto-syncs to DB for logged-in users)
  const readFundingPrefs = useCallback((): { hiddenExchanges: Record<string, string[]>; showAnnualized: boolean } => {
    if (typeof window === 'undefined') return { hiddenExchanges: {}, showAnnualized: false };
    try {
      const raw = localStorage.getItem('ih_funding_prefs');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { hiddenExchanges: {}, showAnnualized: false };
  }, []);

  const [hiddenExchanges, setHiddenExchanges] = useState<Set<string>>(() => {
    const prefs = readFundingPrefs();
    return new Set(prefs.hiddenExchanges[symbol] || []);
  });
  const [showAnnualized, setShowAnnualized] = useState(() => {
    return readFundingPrefs().showAnnualized;
  });
  const [exchangePickerOpen, setExchangePickerOpen] = useState(false);

  // Persist funding prefs to synced localStorage key (useUserSync handles DB push)
  useEffect(() => {
    const prefs = readFundingPrefs();
    const arr = Array.from(hiddenExchanges);
    prefs.hiddenExchanges[symbol] = arr.length > 0 ? arr : [];
    prefs.showAnnualized = showAnnualized;
    // Clean up empty entries
    for (const key of Object.keys(prefs.hiddenExchanges)) {
      if (prefs.hiddenExchanges[key].length === 0) delete prefs.hiddenExchanges[key];
    }
    localStorage.setItem('ih_funding_prefs', JSON.stringify(prefs));
  }, [hiddenExchanges, showAnnualized, symbol, readFundingPrefs]);

  // Re-read prefs when DB sync completes (login from another device)
  useEffect(() => {
    const handler = () => {
      const prefs = readFundingPrefs();
      setHiddenExchanges(new Set(prefs.hiddenExchanges[symbol] || []));
      setShowAnnualized(prefs.showAnnualized);
    };
    window.addEventListener('user-data-synced', handler);
    return () => window.removeEventListener('user-data-synced', handler);
  }, [symbol, readFundingPrefs]);

  // Escape key closes dropdown
  useEffect(() => {
    if (!exchangePickerOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setExchangePickerOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [exchangePickerOpen]);

  // Fetch all funding rates (same as main page)
  const fetcher = useCallback(async () => {
    const [rates, oi] = await Promise.all([
      fetchAllFundingRates('all'),
      fetchAllOpenInterest(),
    ]);
    return { rates, oi };
  }, []);

  const { data, isLoading, error, lastUpdate } = useApi({
    key: `funding-symbol-${symbol}`,
    fetcher,
    refreshInterval: 60000, // 60s (server caches for 2 min)
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

  // Record live rates to localStorage (builds history from detail page visits too)
  useEffect(() => {
    if (symbolRates.length > 0) {
      saveFundingSnapshot(symbolRates);
    }
  }, [symbolRates]);

  // Stats — normalize all rates to 8h basis for average comparison.
  // Prefer the precise per-symbol fundingIntervalHours (Blofin = 24)
  // over the enum bucket so the per-symbol funding page doesn't
  // over-count Blofin's daily-settle rate 3x in cross-venue averages.
  const stats = useMemo(() => {
    if (symbolRates.length === 0) return null;
    const normalize8h = (r: FundingRateData) => {
      const hrs = r.fundingIntervalHours;
      if (typeof hrs === 'number' && hrs > 0 && Number.isFinite(hrs)) {
        return r.fundingRate * (8 / hrs);
      }
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

  const avgRateFlash = useFlash(stats?.avg);
  const totalOIFlash = useFlash(stats?.totalOI);

  // History data for chart — per-exchange lines from DB
  const liveExchanges = useMemo(() => {
    return Array.from(new Set(symbolRates.map((r: FundingRateData) => r.exchange)));
  }, [symbolRates]);

  const days = timeRange === '7d' ? 7 : 30;

  // Fetch funding history from DB
  const [dbFundingData, setDbFundingData] = useState<Record<string, Array<{ t: number; rate: number }>>>({});
  const [dbFundingLoading, setDbFundingLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setDbFundingLoading(true);
    fetch(`/api/history/funding-multi?symbol=${encodeURIComponent(symbol)}&days=${days}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!cancelled && json?.exchanges) {
          setDbFundingData(json.exchanges);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDbFundingLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, days]);

  // Fetch OI history from DB
  const [oiHistoryData, setOiHistoryData] = useState<Array<{ t: number; oi: number }>>([]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    fetch(`/api/history/oi?symbol=${encodeURIComponent(symbol)}&days=${days}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!cancelled && json?.points) {
          setOiHistoryData(json.points);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [symbol, days]);

  // Build chart data — prefer DB data, fall back to localStorage
  const chartExchanges = useMemo(() => {
    const dbExchanges = Object.keys(dbFundingData);
    // Merge DB exchange names with live exchange names (live point is always appended)
    const all = new Set([...dbExchanges, ...liveExchanges]);
    return Array.from(all);
  }, [dbFundingData, liveExchanges]);

  const chartData = useMemo(() => {
    const hasDbData = Object.keys(dbFundingData).length > 0;
    let points: Record<string, any>[] = [];

    if (hasDbData) {
      // Use DB data — build unified timeline
      const allTimestamps = new Set<number>();
      Object.values(dbFundingData).forEach(pts => {
        pts.forEach(p => allTimestamps.add(p.t));
      });
      const sortedTimes = Array.from(allTimestamps).sort((a, b) => a - b);
      points = sortedTimes.map(t => {
        const point: Record<string, any> = { time: t };
        Object.entries(dbFundingData).forEach(([ex, pts]) => {
          const hp = pts.find(p => p.t === t);
          if (hp) point[ex] = hp.rate;
        });
        return point;
      });
    } else if (typeof window !== 'undefined' && liveExchanges.length > 0) {
      // Fallback to localStorage
      const exchangeHistories: Record<string, HistoryPoint[]> = {};
      liveExchanges.forEach(ex => {
        exchangeHistories[ex] = getFundingHistory(symbol, ex, days);
      });
      const allTimestamps = new Set<number>();
      Object.values(exchangeHistories).forEach(history => {
        history.forEach(p => allTimestamps.add(p.t));
      });
      const sortedTimes = Array.from(allTimestamps).sort((a, b) => a - b);
      points = sortedTimes.map(t => {
        const point: Record<string, any> = { time: t };
        liveExchanges.forEach(ex => {
          const hp = exchangeHistories[ex].find(p => p.t === t);
          if (hp) point[ex] = hp.rate;
        });
        return point;
      });
    }

    // Always append the current live rates as the latest data point
    if (symbolRates.length > 0) {
      const now = Date.now();
      const lastTime = points.length > 0 ? points[points.length - 1].time : 0;
      // Only add if it's meaningfully newer than the last point (>1 min)
      if (now - lastTime > 60_000) {
        const livePoint: Record<string, any> = { time: now };
        symbolRates.forEach((fr: FundingRateData) => {
          livePoint[fr.exchange] = fr.fundingRate;
        });
        points.push(livePoint);
      }
    }

    return points;
  }, [dbFundingData, liveExchanges, symbol, days, symbolRates]);

  // Visible exchanges = all chart exchanges minus hidden ones
  const visibleExchanges = useMemo(() => {
    return chartExchanges.filter(ex => !hiddenExchanges.has(ex));
  }, [chartExchanges, hiddenExchanges]);

  // Build a map of exchange → funding interval for annualization
  const exchangeIntervalMap = useMemo(() => {
    const map: Record<string, string> = {};
    symbolRates.forEach((r: FundingRateData) => {
      map[r.exchange] = r.fundingInterval || '8h';
    });
    return map;
  }, [symbolRates]);

  // Annualized chart data — multiply each rate by periodsPerDay * 365
  const displayChartData = useMemo(() => {
    if (!showAnnualized) return chartData;
    return chartData.map(point => {
      const newPoint: Record<string, any> = { time: point.time };
      for (const key of Object.keys(point)) {
        if (key === 'time') continue;
        const val = point[key];
        if (typeof val !== 'number') { newPoint[key] = val; continue; }
        const interval = exchangeIntervalMap[key] || '8h';
        const periodsPerDay = interval === '1h' ? 24 : interval === '4h' ? 6 : 3;
        newPoint[key] = val * periodsPerDay * 365;
      }
      return newPoint;
    });
  }, [chartData, showAnnualized, exchangeIntervalMap]);

  // Live rate per exchange for picker display
  const liveRateMap = useMemo(() => {
    const map: Record<string, number> = {};
    symbolRates.forEach((r: FundingRateData) => {
      map[r.exchange] = r.fundingRate;
    });
    return map;
  }, [symbolRates]);

  const hasChartData = chartData.length >= 1;
  const hasOiHistory = oiHistoryData.length >= 2;

  if (!symbol) {
    router.push('/funding');
    return null;
  }

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
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
              Funding rates across {liveExchanges.length} exchanges
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
          {lastUpdate && <DataFreshness exchangeCount={liveExchanges.length} lastUpdated={lastUpdate} />}
        </div>

        {/* Quick symbol links */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {[
            { href: `/chart?s=${symbol}&tf=240`, icon: LineChart, label: 'Chart' },
            { href: `/open-interest?sym=${symbol}`, icon: BarChart3, label: 'Open Interest' },
            { href: `/spreads?sym=${symbol}`, icon: ArrowLeftRight, label: 'Spreads' },
            { href: `/liquidations?sym=${symbol}`, icon: Zap, label: 'Liquidations' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-lg transition-all"
            >
              <link.icon className="w-3.5 h-3.5" />
              {symbol} {link.label}
            </Link>
          ))}
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-6">
            {/* Stat cards skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 space-y-2">
                  <div className="h-3 w-16 bg-white/[0.06] rounded" />
                  <div className="h-6 w-24 bg-white/[0.06] rounded" />
                  <div className="h-3 w-20 bg-white/[0.04] rounded" />
                </div>
              ))}
            </div>
            {/* Chart skeleton */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl h-64" />
            {/* Table skeleton */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.03]">
                  <div className="h-5 w-5 bg-white/[0.06] rounded-full" />
                  <div className="h-4 w-20 bg-white/[0.06] rounded" />
                  <div className="flex-1" />
                  <div className="h-4 w-16 bg-white/[0.06] rounded" />
                </div>
              ))}
            </div>
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
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2">
                    <Percent className="w-3.5 h-3.5" />
                    Avg Rate
                  </div>
                  <div className={`text-lg font-bold font-mono ${getRateColor(stats.avg)} ${avgRateFlash || ''}`}>
                    {formatRate(stats.avg)}
                  </div>
                  <div className="text-neutral-600 text-xs mt-1">
                    {(stats.avg * 3 * 365).toFixed(1)}% annualized
                  </div>
                </div>

                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
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

                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
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

                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2">
                    <Activity className="w-3.5 h-3.5" />
                    Total OI
                  </div>
                  <div className={`text-lg font-bold font-mono text-white ${totalOIFlash || ''}`}>
                    {stats.totalOI > 0 ? formatUSD(stats.totalOI) : '—'}
                  </div>
                  <div className="text-neutral-600 text-xs mt-1">
                    {stats.count} exchanges
                  </div>
                </div>
              </div>
            )}

            <FundingCharts
              displayChartData={displayChartData}
              visibleExchanges={visibleExchanges}
              showAnnualized={showAnnualized}
              hasChartData={hasChartData}
              exchangeHex={EXCHANGE_HEX}
              totalExchangeCount={chartExchanges.length}
              hasDbData={Object.keys(dbFundingData).length > 0}
              oiHistoryData={oiHistoryData}
              hasOiHistory={hasOiHistory}
              days={days}
            >
              <div className="flex items-center gap-2 flex-wrap">
                  {/* Exchange picker */}
                  <div className="relative">
                    <button
                      onClick={() => setExchangePickerOpen(!exchangePickerOpen)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        hiddenExchanges.size > 0
                          ? 'bg-hub-yellow/10 border-hub-yellow/30 text-hub-yellow'
                          : 'bg-white/[0.04] border-white/[0.06] text-neutral-400 hover:text-white'
                      }`}
                    >
                      {hiddenExchanges.size > 0 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      Exchanges
                      {hiddenExchanges.size > 0 && (
                        <span className="bg-hub-yellow/20 text-hub-yellow text-[10px] px-1 rounded">
                          {visibleExchanges.length}
                        </span>
                      )}
                    </button>
                    {exchangePickerOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setExchangePickerOpen(false)} />
                        <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 z-50 bg-hub-darker border border-white/[0.08] rounded-xl shadow-2xl w-60 max-h-80 overflow-y-auto">
                          {/* Header with quick filters */}
                          <div className="p-2 border-b border-white/[0.06] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Exchanges</span>
                              <button
                                onClick={() => setHiddenExchanges(
                                  hiddenExchanges.size > 0 ? new Set() : new Set(chartExchanges)
                                )}
                                className="text-[10px] text-hub-yellow hover:underline"
                              >
                                {hiddenExchanges.size > 0 ? 'Show All' : 'Hide All'}
                              </button>
                            </div>
                            <div className="flex gap-1">
                              {[
                                { label: 'CEX', filter: (ex: string) => !isExchangeDex(ex) },
                                { label: 'DEX', filter: (ex: string) => isExchangeDex(ex) },
                              ].map(({ label, filter }) => {
                                const matching = chartExchanges.filter(filter);
                                const allVisible = matching.every(ex => !hiddenExchanges.has(ex));
                                return (
                                  <button
                                    key={label}
                                    onClick={() => {
                                      const next = new Set(hiddenExchanges);
                                      if (allVisible) {
                                        matching.forEach(ex => next.add(ex));
                                      } else {
                                        matching.forEach(ex => next.delete(ex));
                                      }
                                      setHiddenExchanges(next);
                                    }}
                                    className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                                      allVisible
                                        ? 'bg-hub-yellow/15 text-hub-yellow border border-hub-yellow/30'
                                        : 'bg-white/[0.04] text-neutral-500 border border-white/[0.06] hover:text-white'
                                    }`}
                                  >
                                    {label} ({matching.length})
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {/* Exchange list */}
                          {[...chartExchanges].sort().map(ex => {
                            const visible = !hiddenExchanges.has(ex);
                            return (
                              <div
                                key={ex}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] transition-colors group"
                              >
                                <button
                                  onClick={() => {
                                    const next = new Set(hiddenExchanges);
                                    if (visible) next.add(ex); else next.delete(ex);
                                    setHiddenExchanges(next);
                                  }}
                                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                    visible
                                      ? 'border-hub-yellow bg-hub-yellow/20'
                                      : 'border-white/[0.15] bg-transparent'
                                  }`}
                                >
                                  {visible && <Check className="w-2.5 h-2.5 text-hub-yellow" />}
                                </button>
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: EXCHANGE_HEX[ex] || '#737373' }}
                                />
                                <ExchangeLogo exchange={ex.toLowerCase()} size={14} />
                                <button
                                  onClick={() => {
                                    // Solo mode: hide all except this one
                                    const allOthers = new Set(chartExchanges.filter(e => e !== ex));
                                    // If already solo on this exchange, show all
                                    const isSolo = hiddenExchanges.size === allOthers.size && Array.from(allOthers).every(e => hiddenExchanges.has(e));
                                    setHiddenExchanges(isSolo ? new Set() : allOthers);
                                  }}
                                  className={`text-xs text-left flex-1 transition-colors ${visible ? 'text-white' : 'text-neutral-600'}`}
                                  title="Click to solo this exchange"
                                >
                                  {ex}
                                </button>
                                {liveRateMap[ex] != null && (
                                  <span className={`font-mono text-[10px] tabular-nums flex-shrink-0 ${
                                    visible ? getRateColor(liveRateMap[ex]) : 'text-neutral-700'
                                  }`}>
                                    {formatRate(liveRateMap[ex])}
                                  </span>
                                )}
                                {isExchangeDex(ex) && (
                                  <span className="text-[8px] font-bold text-purple-400/60 leading-none">DEX</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Annualized toggle */}
                  <button
                    onClick={() => setShowAnnualized(!showAnnualized)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      showAnnualized
                        ? 'bg-hub-yellow/10 border-hub-yellow/30 text-hub-yellow'
                        : 'bg-white/[0.04] border-white/[0.06] text-neutral-400 hover:text-white'
                    }`}
                    title="Toggle annualized rates"
                  >
                    APR
                  </button>

                  {/* Time range */}
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
            </FundingCharts>

            {/* Exchange Comparison Table */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden mb-8">
              <div className="p-4 border-b border-white/[0.06]">
                <h2 className="text-white font-semibold text-sm">Exchange Comparison</h2>
                <p className="text-neutral-600 text-xs mt-0.5">
                  Current rates for {symbol} across all exchanges
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" aria-label="Funding rates by exchange">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-left">Exchange</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-center">Interval</th>
                      <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Current Rate</th>
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
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${
                                fr.fundingInterval === '1h'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : fr.fundingInterval === '4h'
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : 'bg-white/[0.04] text-neutral-500'
                              }`} title={`Funding fee settled every ${fr.fundingInterval === '1h' ? '1 hour' : fr.fundingInterval === '4h' ? '4 hours' : '8 hours'}`}>
                                {fr.fundingInterval === '1h' ? '1H' : fr.fundingInterval === '4h' ? '4H' : '8H'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-mono font-semibold text-sm ${getRateColor(fr.fundingRateShort !== undefined ? fr.fundingRateShort : fr.fundingRate)}`}>
                                  {formatRate(fr.fundingRateShort !== undefined ? fr.fundingRateShort : fr.fundingRate)}
                                </span>
                                {fr.fundingRateLong !== undefined && fr.fundingRateShort !== undefined && (
                                  <span className="text-[10px] font-mono leading-tight mt-0.5">
                                    <span className="text-neutral-600">L</span>
                                    <span className={getRateColor(fr.fundingRateLong)}> {formatRate(fr.fundingRateLong)}</span>
                                    <span className="text-neutral-700"> / </span>
                                    <span className="text-neutral-600">S</span>
                                    <span className={getRateColor(fr.fundingRateShort)}> {formatRate(fr.fundingRateShort)}</span>
                                  </span>
                                )}
                                {fr.borrowingRate != null && fr.borrowingRate > 0.00001 && (
                                  <span className="text-[10px] font-mono leading-tight mt-0.5 text-amber-500/70" title="Symmetric borrowing fee — both longs and shorts pay this equally">
                                    Borrow: {fr.borrowingRate.toFixed(4)}%
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-mono text-xs ${getRateColor(annualized)}`}>
                                {annualized >= 0 ? '+' : ''}{annualized.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {oiVal ? (
                                <span className="text-neutral-400 font-mono text-xs">{formatUSD(oiVal)}</span>
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
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden mb-8">
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
      <ReferralBanner />
      <Footer />
    </div>
  );
}
