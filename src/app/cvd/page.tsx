'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { RefreshCw, Info, Activity, TrendingUp, TrendingDown, Hash, BarChart3, ArrowLeftRight } from 'lucide-react';
import { formatCompact } from '@/lib/utils/format';

/* ─── Types ──────────────────────────────────────────────────────── */

interface CVDBucket {
  time: number;
  buyVol: number;
  sellVol: number;
  delta: number;
  cvd: number;
}

interface CVDResponse {
  symbol: string;
  tradeCount: number;
  totalBuyVol: number;
  totalSellVol: number;
  netDelta: number;
  buckets: CVDBucket[];
}

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK', 'DOT', 'SUI', 'PEPE'];

/* ─── CVD Chart (SVG) ────────────────────────────────────────────── */

function CVDChart({ buckets, width = 800, height = 200 }: { buckets: CVDBucket[]; width?: number; height?: number }) {
  if (buckets.length < 2) return null;

  const minCVD = Math.min(...buckets.map((b) => b.cvd));
  const maxCVD = Math.max(...buckets.map((b) => b.cvd));
  const range = maxCVD - minCVD || 1;
  const padding = 8;

  const scaleX = (i: number) => padding + (i / (buckets.length - 1)) * (width - padding * 2);
  const scaleY = (val: number) => padding + (1 - (val - minCVD) / range) * (height - padding * 2);

  // Zero line
  const zeroY = scaleY(0);

  const points = buckets.map((b, i) => `${scaleX(i)},${scaleY(b.cvd)}`).join(' ');

  // Fill area under curve
  const firstX = scaleX(0);
  const lastX = scaleX(buckets.length - 1);
  const areaPoints = `${firstX},${zeroY} ${points} ${lastX},${zeroY}`;

  const isPositive = buckets[buckets.length - 1].cvd >= 0;
  const lineColor = isPositive ? '#22c55e' : '#ef4444';
  const fillColor = isPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Zero line */}
      {minCVD < 0 && maxCVD > 0 && (
        <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeDasharray="4,4" />
      )}
      {/* Area fill */}
      <polygon points={areaPoints} fill={fillColor} />
      {/* Line */}
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Volume Bars ────────────────────────────────────────────────── */

function VolumeBars({ buckets, width = 800, height = 80 }: { buckets: CVDBucket[]; width?: number; height?: number }) {
  if (buckets.length === 0) return null;

  const maxVol = Math.max(...buckets.map((b) => Math.max(b.buyVol, b.sellVol)), 1);
  const padding = 4;
  const barW = Math.max(1, (width - padding * 2) / buckets.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {buckets.map((b, i) => {
        const x = padding + i * ((width - padding * 2) / buckets.length);
        const buyH = (b.buyVol / maxVol) * (height / 2);
        const sellH = (b.sellVol / maxVol) * (height / 2);
        return (
          <g key={i}>
            <rect x={x} y={height / 2 - buyH} width={barW} height={buyH} fill="rgba(34,197,94,0.5)" rx={0.5} />
            <rect x={x} y={height / 2} width={barW} height={sellH} fill="rgba(239,68,68,0.5)" rx={0.5} />
          </g>
        );
      })}
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.06)" />
    </svg>
  );
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function CVDPage() {
  const [symbol, setSymbol] = useState('BTC');
  const [data, setData] = useState<CVDResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/aggtrades?symbol=${symbol}&limit=1000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000); // 15s refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const buyPct = useMemo(() => {
    if (!data) return 50;
    const total = data.totalBuyVol + data.totalSellVol;
    return total > 0 ? (data.totalBuyVol / total) * 100 : 50;
  }, [data]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-hub-yellow" />
            </div>
            <div>
              <h1 className="heading-page">Cumulative Volume Delta</h1>
              <p className="text-neutral-500 text-sm mt-0.5 flex items-center gap-1.5">
                Buy vs sell pressure — are buyers or sellers in control?
                {data && (
                  <span className="flex items-center gap-1 text-green-400 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Live
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

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
                    <p className="text-lg font-bold text-green-400">${formatCompact(data.totalBuyVol)}</p>
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
                    <p className="text-lg font-bold text-red-400">${formatCompact(data.totalSellVol)}</p>
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
                    <p className={`text-lg font-bold ${data.netDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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

            {/* CVD Chart */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-hub-yellow/10 flex items-center justify-center">
                  <Activity className="w-3 h-3 text-hub-yellow" />
                </div>
                <h2 className="text-sm font-semibold text-white">CVD Line</h2>
              </div>
              <div className="h-[200px]">
                <CVDChart buckets={data.buckets} />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-neutral-600">
                {data.buckets.length > 0 && (
                  <>
                    <span>{new Date(data.buckets[0].time).toLocaleTimeString()}</span>
                    <span>{new Date(data.buckets[data.buckets.length - 1].time).toLocaleTimeString()}</span>
                  </>
                )}
              </div>
            </div>

            {/* Volume Bars */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="w-3 h-3 text-blue-400" />
                </div>
                <h2 className="text-sm font-semibold text-white">Buy/Sell Volume</h2>
              </div>
              <p className="text-xs text-neutral-600 mb-3 ml-8">Green = buy aggressor (above), Red = sell aggressor (below)</p>
              <div className="h-[100px]">
                <VolumeBars buckets={data.buckets} />
              </div>
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
      <Footer />
    </div>
  );
}
