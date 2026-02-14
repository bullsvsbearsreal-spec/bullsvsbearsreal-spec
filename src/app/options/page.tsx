'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { RefreshCw, Info, Target } from 'lucide-react';
import { formatCompact, formatPrice } from '@/lib/utils/format';

/* ─── Types ──────────────────────────────────────────────────────── */

interface StrikeData {
  strike: number;
  callOI: number;
  putOI: number;
}

interface IVPoint {
  strike: number;
  callIV: number;
  putIV: number;
}

interface OptionsResponse {
  currency: string;
  underlyingPrice: number;
  maxPain: number;
  putCallRatio: number;
  totalCallOI: number;
  totalPutOI: number;
  totalOI: number;
  instrumentCount: number;
  strikeData: StrikeData[];
  ivSmile: IVPoint[];
}

/* ─── OI by Strike Chart (SVG) ───────────────────────────────────── */

function OIByStrikeChart({ strikes, spotPrice, width = 800, height = 250 }: { strikes: StrikeData[]; spotPrice: number; width?: number; height?: number }) {
  if (strikes.length === 0) return null;

  const maxOI = Math.max(...strikes.map((s) => Math.max(s.callOI, s.putOI)), 1);
  const padding = { top: 8, bottom: 30, left: 4, right: 4 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barGroupW = chartW / strikes.length;
  const barW = barGroupW * 0.35;
  const gap = barGroupW * 0.05;

  // Find spot price position
  const spotIdx = strikes.findIndex((s) => s.strike >= spotPrice);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {strikes.map((s, i) => {
        const x = padding.left + i * barGroupW;
        const callH = (s.callOI / maxOI) * chartH;
        const putH = (s.putOI / maxOI) * chartH;
        const isSpot = i === spotIdx;

        return (
          <g key={s.strike}>
            {/* Call bar (green) */}
            <rect
              x={x + gap}
              y={padding.top + chartH - callH}
              width={barW}
              height={callH}
              fill="rgba(34,197,94,0.6)"
              rx={1}
            />
            {/* Put bar (red) */}
            <rect
              x={x + barW + gap * 2}
              y={padding.top + chartH - putH}
              width={barW}
              height={putH}
              fill="rgba(239,68,68,0.6)"
              rx={1}
            />
            {/* Strike label (show every 3rd or if spot) */}
            {(i % 3 === 0 || isSpot) && (
              <text
                x={x + barGroupW / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize="8"
                fill={isSpot ? '#FFA500' : 'rgba(255,255,255,0.3)'}
                fontWeight={isSpot ? 'bold' : 'normal'}
              >
                {s.strike >= 1000 ? `${(s.strike / 1000).toFixed(0)}K` : s.strike}
              </text>
            )}
            {/* Spot marker */}
            {isSpot && (
              <line
                x1={x + barGroupW / 2}
                y1={padding.top}
                x2={x + barGroupW / 2}
                y2={padding.top + chartH}
                stroke="#FFA500"
                strokeDasharray="4,4"
                strokeWidth={1}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── IV Smile Chart (SVG) ───────────────────────────────────────── */

function IVSmileChart({ points, spotPrice, width = 800, height = 180 }: { points: IVPoint[]; spotPrice: number; width?: number; height?: number }) {
  if (points.length < 2) return null;

  const allIVs = points.flatMap((p) => [p.callIV, p.putIV].filter((v) => v > 0));
  const minIV = Math.min(...allIVs);
  const maxIV = Math.max(...allIVs);
  const range = maxIV - minIV || 1;
  const padding = 8;

  const scaleX = (i: number) => padding + (i / (points.length - 1)) * (width - padding * 2);
  const scaleY = (val: number) => padding + (1 - (val - minIV) / range) * (height - padding * 2);

  const callLine = points
    .filter((p) => p.callIV > 0)
    .map((p, i, arr) => `${scaleX(points.indexOf(p))},${scaleY(p.callIV)}`)
    .join(' ');

  const putLine = points
    .filter((p) => p.putIV > 0)
    .map((p) => `${scaleX(points.indexOf(p))},${scaleY(p.putIV)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {callLine && <polyline points={callLine} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />}
      {putLine && <polyline points={putLine} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />}
    </svg>
  );
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function OptionsPage() {
  const [currency, setCurrency] = useState<'BTC' | 'ETH'>('BTC');
  const [data, setData] = useState<OptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/options?currency=${currency}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const maxPainDistance = useMemo(() => {
    if (!data) return 0;
    return ((data.maxPain - data.underlyingPrice) / data.underlyingPrice) * 100;
  }, [data]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Target className="w-6 h-6 text-hub-yellow" />
                Options Data
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                Max pain, put/call ratio, OI by strike, and implied volatility from Deribit
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
                {(['BTC', 'ETH'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      currency === c
                        ? 'bg-hub-yellow text-black'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading && !data && (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
              <span className="ml-3 text-neutral-400">Loading options data...</span>
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
              {/* Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-[#0d0d0d] border border-hub-yellow/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">Max Pain</p>
                  <p className="text-xl font-bold text-hub-yellow">${data.maxPain.toLocaleString()}</p>
                  <p className={`text-xs ${maxPainDistance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {maxPainDistance >= 0 ? '+' : ''}{maxPainDistance.toFixed(1)}% from spot
                  </p>
                </div>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">Put/Call Ratio</p>
                  <p className={`text-xl font-bold ${data.putCallRatio > 1 ? 'text-red-400' : 'text-green-400'}`}>
                    {data.putCallRatio.toFixed(2)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {data.putCallRatio > 1 ? 'Bearish bias' : 'Bullish bias'}
                  </p>
                </div>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">Total Options OI</p>
                  <p className="text-xl font-bold text-white">${formatCompact(data.totalOI)}</p>
                  <p className="text-xs text-neutral-500">{data.instrumentCount} instruments</p>
                </div>
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-xs text-neutral-500">Spot Price</p>
                  <p className="text-xl font-bold text-white">{formatPrice(data.underlyingPrice)}</p>
                </div>
              </div>

              {/* Call/Put OI comparison */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 mb-6">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-green-400">Calls ${formatCompact(data.totalCallOI)}</span>
                  <span className="text-red-400">Puts ${formatCompact(data.totalPutOI)}</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500 h-full transition-all"
                    style={{ width: `${(data.totalCallOI / data.totalOI) * 100}%` }}
                  />
                  <div
                    className="bg-red-500 h-full transition-all"
                    style={{ width: `${(data.totalPutOI / data.totalOI) * 100}%` }}
                  />
                </div>
              </div>

              {/* OI by Strike Chart */}
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 mb-6">
                <h2 className="text-sm font-semibold text-white mb-1">Open Interest by Strike</h2>
                <p className="text-xs text-neutral-600 mb-3">Dashed line = spot price</p>
                <div className="h-[250px]">
                  <OIByStrikeChart strikes={data.strikeData} spotPrice={data.underlyingPrice} />
                </div>
                <div className="flex justify-center gap-6 mt-2 text-xs text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-green-500/60" /> Calls
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-red-500/60" /> Puts
                  </div>
                </div>
              </div>

              {/* IV Smile */}
              {data.ivSmile.length > 2 && (
                <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 mb-6">
                  <h2 className="text-sm font-semibold text-white mb-1">Implied Volatility Smile</h2>
                  <p className="text-xs text-neutral-600 mb-3">Mark IV across strike prices</p>
                  <div className="h-[180px]">
                    <IVSmileChart points={data.ivSmile} spotPrice={data.underlyingPrice} />
                  </div>
                  <div className="flex justify-center gap-6 mt-2 text-xs text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-2 rounded-sm bg-green-500" /> Call IV
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-2 rounded-sm bg-red-500" /> Put IV
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Info footer */}
          <div className="mt-8 bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 border-l-2 border-l-hub-yellow">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
              <div className="text-xs text-neutral-400 space-y-1">
                <p>
                  <strong className="text-neutral-300">Options Data</strong> from Deribit — the largest
                  crypto options exchange.
                </p>
                <p>
                  <strong>Max Pain:</strong> The strike price where option holders lose the most money
                  at expiry. Price tends to gravitate toward max pain near expiration.
                </p>
                <p>
                  <strong>Put/Call Ratio:</strong> Above 1 = more puts than calls (bearish hedging).
                  Below 1 = more calls (bullish speculation).
                </p>
                <p>Updates every 60 seconds.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
