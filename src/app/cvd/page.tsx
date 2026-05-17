'use client';

import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import PageHero from '@/components/PageHero';
import { RefreshCw, Info, Activity, TrendingUp, TrendingDown, Hash, ArrowLeftRight } from 'lucide-react';
import { formatCompact } from '@/lib/utils/format';
import { useFlash } from '@/hooks/useFlash';
import { useApi } from '@/hooks/useSWRApi';
import DataFreshness from '@/components/DataFreshness';
import dynamic from 'next/dynamic';
import { type CVDBucket } from './components/CVDChart';

const CVDChart = dynamic(() => import('./components/CVDChart'), { ssr: false });

/* ─── Types ──────────────────────────────────────────────────────── */

interface CVDResponse {
  symbol: string;
  tradeCount: number;
  totalBuyVol: number;
  totalSellVol: number;
  netDelta: number;
  buckets: CVDBucket[];
}

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK', 'DOT', 'SUI', 'PEPE'];

/* ─── Component ──────────────────────────────────────────────────── */

export default function CVDPage() {
  const [symbol, setSymbol] = useState('BTC');

  const fetcher = useCallback(async () => {
    const res = await fetch(`/api/aggtrades?symbol=${symbol}&limit=1000`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<CVDResponse>;
  }, [symbol]);

  const { data, error, isLoading: loading, lastUpdate, refresh: fetchData } = useApi({
    key: `cvd-${symbol}`,
    fetcher,
    refreshInterval: 15000,
  });

  const buyVolFlash = useFlash(data?.totalBuyVol);
  const sellVolFlash = useFlash(data?.totalSellVol);
  const deltaFlash = useFlash(data?.netDelta);

  const buyPct = useMemo(() => {
    if (!data) return 50;
    const total = data.totalBuyVol + data.totalSellVol;
    return total > 0 ? (data.totalBuyVol / total) * 100 : 50;
  }, [data]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        <PageHero
          icon={Activity}
          eyebrow="Orderflow · CVD"
          eyebrowExtra={
            data && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/15 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                live
              </span>
            )
          }
          title="Cumulative volume"
          accentNoun="delta"
          accent="hub-yellow"
          description={
            <>Buy vs sell pressure — are buyers or sellers in control? Positive divergence
              (price flat, CVD rising) hints at accumulation; negative divergence hints at distribution.</>
          }
          className="mb-6"
          actions={
            <>
              <DataFreshness exchangeCount={1} lastUpdated={lastUpdate} sources={['Binance']} />
              <button
                onClick={fetchData}
                disabled={loading}
                aria-label="Refresh data"
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </>
          }
        />

        {/* Symbol selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                symbol === s
                  ? 'bg-hub-yellow text-black'
                  : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
            <span className="ml-3 text-neutral-400">Loading trade data...</span>
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
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Buy Volume</p>
                    <p className={`text-lg font-bold text-green-400 ${buyVolFlash}`}>${formatCompact(data.totalBuyVol)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Sell Volume</p>
                    <p className={`text-lg font-bold text-red-400 ${sellVolFlash}`}>${formatCompact(data.totalSellVol)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-hub-yellow" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Net Delta</p>
                    <p className={`text-lg font-bold ${data.netDelta >= 0 ? 'text-green-400' : 'text-red-400'} ${deltaFlash}`}>
                      {data.netDelta >= 0 ? '+' : '-'}${formatCompact(Math.abs(data.netDelta))}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Hash className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Trades</p>
                    <p className="text-lg font-bold text-white">{data.tradeCount.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Buy/Sell Pressure Bar */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                  <ArrowLeftRight className="w-3 h-3 text-purple-400" />
                </div>
                <h2 className="text-sm font-semibold text-white">Buy/Sell Pressure</h2>
              </div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-green-400">Buy {buyPct.toFixed(1)}%</span>
                <span className="text-red-400">Sell {(100 - buyPct).toFixed(1)}%</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden flex">
                <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${buyPct}%` }} />
                <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${100 - buyPct}%` }} />
              </div>
            </div>

            {/* CVD Chart + Volume Delta (Lightweight Charts) */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-hub-yellow/10 flex items-center justify-center">
                  <Activity className="w-3 h-3 text-hub-yellow" />
                </div>
                <h2 className="text-sm font-semibold text-white">CVD Line + Volume Delta</h2>
                <span className="text-[10px] text-neutral-600 ml-auto">Yellow = CVD · Bottom bars = buy/sell delta</span>
              </div>
              <CVDChart buckets={data.buckets} height={340} showDivergences={true} />
            </div>
          </>
        )}

        {/* Info footer */}
        <div className="mt-4 bg-hub-yellow/5 border border-hub-yellow/10 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
            <div className="text-xs text-neutral-400 space-y-1">
              <p>
                <strong className="text-neutral-300">CVD (Cumulative Volume Delta)</strong> measures
                the difference between buying and selling volume over time.
              </p>
              <p>
                Rising CVD = buyers dominating (bullish). Falling CVD = sellers dominating (bearish).
                CVD divergence from price is a powerful reversal signal.
              </p>
              <p>Data from Binance spot aggregate trades. Updates every 15 seconds.</p>
            </div>
          </div>
        </div>
      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}
