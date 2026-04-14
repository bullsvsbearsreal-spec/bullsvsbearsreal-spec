'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import { useApi } from '@/hooks/useSWRApi';
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import DataFreshness from '@/components/DataFreshness';

const LSChart = dynamic(() => import('./components/LSChart'), { ssr: false });
const OIHistoryChart = dynamic(() => import('./components/OIHistoryChart'), { ssr: false });
const TakerRatioChart = dynamic(() => import('./components/TakerRatioChart'), { ssr: false });

interface LSPoint {
  longRatio: number;
  shortRatio: number;
  timestamp: number;
}

interface LSHistoryData {
  symbol: string;
  period: string;
  points: LSPoint[];
  // Single-point fallback fields (when no history available)
  longRatio?: number;
  shortRatio?: number;
  timestamp?: number;
}

interface OIHistoryData {
  symbol: string;
  source: string;
  period: string;
  points: Array<{ t: number; oi: number; vol?: number | null }>;
}

interface TakerRawPoint {
  timestamp: number;
  buyVol: number;
  sellVol: number;
  buySellRatio: number;
}

interface TakerHistoryData {
  symbol: string;
  exchange: string;
  source: string;
  period: string;
  points?: TakerRawPoint[];
  fallback?: boolean;
}

type Period = '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

const SYMBOLS = [
  { label: 'BTC', value: 'BTCUSDT' },
  { label: 'ETH', value: 'ETHUSDT' },
  { label: 'SOL', value: 'SOLUSDT' },
  { label: 'XRP', value: 'XRPUSDT' },
  { label: 'DOGE', value: 'DOGEUSDT' },
  { label: 'BNB', value: 'BNBUSDT' },
  { label: 'ADA', value: 'ADAUSDT' },
  { label: 'AVAX', value: 'AVAXUSDT' },
  { label: 'LINK', value: 'LINKUSDT' },
  { label: 'DOT', value: 'DOTUSDT' },
];

const PERIODS: { label: string; value: Period }[] = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

const MULTI_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'BNBUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

export default function LongShortPage() {
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [period, setPeriod] = useState<Period>('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // One-time: initialize state from URL on mount (deep linking from /chart)
  useEffect(() => {
    const s = searchParams.get('s');
    const tf = searchParams.get('tf');
    if (s) {
      const match = SYMBOLS.find(sy => sy.label === s.toUpperCase());
      if (match) setSymbol(match.value);
    }
    if (tf) {
      const match = PERIODS.find(p => p.value === tf);
      if (match) setPeriod(match.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main chart data
  const { data, error, isLoading, lastUpdate, refresh, isRefreshing } = useApi<LSHistoryData>({
    key: `longshort-${symbol}-${period}`,
    fetcher: useCallback(async () => {
      const res = await fetch(`/api/longshort?symbol=${symbol}&period=${period}&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }, [symbol, period]),
    refreshInterval: autoRefresh ? 10000 : undefined,
  });

  // OI history (Binance with OKX fallback)
  const bareSymbol = symbol.replace('USDT', '');
  const { data: oiData } = useApi<OIHistoryData>({
    key: `oi-history-${bareSymbol}-${period}`,
    fetcher: useCallback(async () => {
      const res = await fetch(`/api/history/oi?symbol=${bareSymbol}&source=exchange&period=${period}&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }, [bareSymbol, period]),
    refreshInterval: autoRefresh ? 60000 : undefined,
  });

  // Taker buy/sell volume (Binance with OKX fallback)
  const { data: takerData } = useApi<TakerHistoryData>({
    key: `taker-${symbol}-${period}`,
    fetcher: useCallback(async () => {
      const res = await fetch(`/api/longshort?symbol=${symbol}&source=taker&period=${period}&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }, [symbol, period]),
    refreshInterval: autoRefresh ? 30000 : undefined,
  });

  // Multi-symbol table data
  const multiFetcher = useCallback(async () => {
    const results: Record<string, { longRatio: number; shortRatio: number }> = {};
    const promises = MULTI_SYMBOLS.map(async (sym) => {
      try {
        const res = await fetch(`/api/longshort?symbol=${sym}&limit=1`);
        if (!res.ok) return;
        const d = await res.json();
        results[sym] = { longRatio: d.longRatio, shortRatio: d.shortRatio };
      } catch { /* skip */ }
    });
    await Promise.all(promises);
    return results;
  }, []);

  const { data: rawMultiData } = useApi({
    key: 'longshort-multi',
    fetcher: multiFetcher,
    refreshInterval: 60000,
  });
  const multiData = rawMultiData ?? {};

  const chartData = useMemo(() => {
    if (!data) return [];
    // Handle historical array response
    if (data.points && data.points.length > 0) {
      return data.points.map(p => ({
        timestamp: p.timestamp,
        longRatio: p.longRatio,
        shortRatio: p.shortRatio,
      }));
    }
    // Handle single-point fallback response (no points array)
    if (data.longRatio != null) {
      return [{
        timestamp: data.timestamp || Date.now(),
        longRatio: data.longRatio,
        shortRatio: data.shortRatio ?? 0,
      }];
    }
    return [];
  }, [data]);

  const latest = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const prev = chartData.length > 1 ? chartData[chartData.length - 2] : null;
  const trend = latest && prev ? latest.longRatio - prev.longRatio : 0;

  const symbolLabel = SYMBOLS.find(s => s.value === symbol)?.label || symbol.replace('USDT', '');

  return (
    <div className="min-h-screen bg-hub-black text-white">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="heading-page">Derivatives Stats</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Open Interest · Long/Short Ratio · Taker Volume (Binance + OKX)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DataFreshness exchangeCount={1} lastUpdated={lastUpdate} sources={['Binance']} />
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                autoRefresh
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-white/[0.04] text-neutral-500 border border-white/[0.06]'
              }`}
            >
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
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
          {/* Symbol selector */}
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {SYMBOLS.map(s => (
              <button
                key={s.value}
                onClick={() => setSymbol(s.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  symbol === s.value
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p.value
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        {latest && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 mb-1">Long</div>
              <div className="text-lg font-bold text-green-400 font-mono">{latest.longRatio.toFixed(2)}%</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 mb-1">Short</div>
              <div className="text-lg font-bold text-red-400 font-mono">{latest.shortRatio.toFixed(2)}%</div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 mb-1">L/S Ratio</div>
              <div className="text-lg font-bold text-white font-mono">
                {latest.shortRatio > 0 ? (latest.longRatio / latest.shortRatio).toFixed(3) : 'N/A'}
              </div>
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] text-neutral-500 mb-1">Trend</div>
              <span className={`delta-badge text-sm ${
                Math.abs(trend) >= 5
                  ? (trend >= 0 ? 'delta-badge-extreme-up' : 'delta-badge-extreme-down')
                  : (trend >= 0 ? 'delta-badge-up' : 'delta-badge-down')
              }`}>
                {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {trend >= 0 ? '+' : ''}{trend.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Chart */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-neutral-500 animate-spin" />
          </div>
        )}

        {!isLoading && chartData.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 mb-6">
            <div className="text-neutral-500 text-sm mb-2">No chart data available</div>
            <div className="text-neutral-600 text-xs">Binance Long/Short data may be temporarily unavailable</div>
          </div>
        )}

        {/* OI History Chart */}
        {oiData && oiData.points && oiData.points.length > 0 && (
          <OIHistoryChart
            data={oiData.points}
            symbolLabel={symbolLabel}
            period={period}
            source={oiData.source}
          />
        )}

        {/* Long/Short Ratio Chart */}
        {!isLoading && chartData.length > 0 && (
          <LSChart chartData={chartData} symbolLabel={symbolLabel} period={period} />
        )}

        {/* Taker Buy/Sell Volume Chart */}
        {takerData && takerData.points && takerData.points.length > 0 && !takerData.fallback && (
          <TakerRatioChart
            data={takerData.points}
            symbolLabel={symbolLabel}
            period={period}
          />
        )}

        {/* Multi-symbol table */}
        <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium text-neutral-400">All Symbols — Current Ratio</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="Long/short ratios by symbol">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2 text-neutral-500 font-medium">Symbol</th>
                  <th className="text-right px-4 py-2 text-neutral-500 font-medium">Long %</th>
                  <th className="text-right px-4 py-2 text-neutral-500 font-medium">Short %</th>
                  <th className="text-right px-4 py-2 text-neutral-500 font-medium">L/S Ratio</th>
                  <th className="px-4 py-2 text-neutral-500 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {MULTI_SYMBOLS.map(sym => {
                  const d = multiData[sym];
                  const label = sym.replace('USDT', '');
                  if (!d) {
                    return (
                      <tr key={sym} className="border-b border-white/[0.04]">
                        <td className="px-4 py-2.5 font-medium text-white">{label}</td>
                        <td colSpan={4} className="px-4 py-2.5 text-neutral-600">Waiting for long/short ratio data...</td>
                      </tr>
                    );
                  }
                  const ratio = d.shortRatio > 0 ? (d.longRatio / d.shortRatio).toFixed(3) : 'N/A';
                  const isActive = sym === symbol;
                  return (
                    <tr
                      key={sym}
                      onClick={() => setSymbol(sym)}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        isActive ? 'bg-hub-yellow/5' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className={`px-4 py-2.5 font-medium ${isActive ? 'text-hub-yellow' : 'text-white'}`}>
                        {label}
                      </td>
                      <td className="text-right px-4 py-2.5 text-green-400 font-mono">{(d.longRatio ?? 0).toFixed(2)}%</td>
                      <td className="text-right px-4 py-2.5 text-red-400 font-mono">{(d.shortRatio ?? 0).toFixed(2)}%</td>
                      <td className="text-right px-4 py-2.5 text-white font-mono">{ratio}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.04]">
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${d.longRatio}%` }}
                          />
                          <div
                            className="bg-red-500 transition-all"
                            style={{ width: `${d.shortRatio}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}
