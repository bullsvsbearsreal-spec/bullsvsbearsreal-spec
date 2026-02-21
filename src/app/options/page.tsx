'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { RefreshCw, Info, Target, Crosshair, ArrowLeftRight, BarChart3, DollarSign, Activity, Globe } from 'lucide-react';
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

interface ExchangeBreakdown {
  exchange: string;
  callOI: number;
  putOI: number;
  totalOI: number;
  instruments: number;
  share: number;
}

interface ExchangeHealth {
  exchange: string;
  status: string;
  count: number;
  latency: number;
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
  exchangeBreakdown?: ExchangeBreakdown[];
  health?: ExchangeHealth[];
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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/options?currency=${currency}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setLastUpdate(new Date());
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
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-hub-yellow" />
            </div>
            <div>
              <h1 className="heading-page">Options Data</h1>
              <p className="text-neutral-500 text-sm mt-0.5 flex items-center gap-1.5">
                Max pain, put/call ratio, OI by strike, and implied volatility across {data?.health?.filter(h => h.status === 'ok' && h.count > 0).length || 1} exchanges
                {data && !loading && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
              </p>
            </div>
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
            <UpdatedAgo date={lastUpdate} />
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
              {/* Max Pain */}
              <div className="bg-hub-darker border border-hub-yellow/20 rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center flex-shrink-0">
                    <Crosshair className="w-4 h-4 text-hub-yellow" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Max Pain</p>
                    <p className="text-xl font-bold text-hub-yellow">${data.maxPain.toLocaleString()}</p>
                    <p className={`text-xs ${maxPainDistance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {maxPainDistance >= 0 ? '+' : ''}{maxPainDistance.toFixed(1)}% from spot
                    </p>
                  </div>
                </div>
              </div>
              {/* Put/Call Ratio */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    data.putCallRatio > 1 ? 'bg-red-500/10' : 'bg-green-500/10'
                  }`}>
                    <ArrowLeftRight className={`w-4 h-4 ${data.putCallRatio > 1 ? 'text-red-400' : 'text-green-400'}`} />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Put/Call Ratio</p>
                    <p className={`text-xl font-bold ${data.putCallRatio > 1 ? 'text-red-400' : 'text-green-400'}`}>
                      {data.putCallRatio.toFixed(2)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {data.putCallRatio > 1 ? 'Bearish bias' : 'Bullish bias'}
                    </p>
                  </div>
                </div>
              </div>
              {/* Total Options OI */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Total Options OI</p>
                    <p className="text-xl font-bold text-white">${formatCompact(data.totalOI)}</p>
                    <p className="text-xs text-neutral-500">{data.instrumentCount} instruments</p>
                  </div>
                </div>
              </div>
              {/* Spot Price */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Spot Price</p>
                    <p className="text-xl font-bold text-white">{formatPrice(data.underlyingPrice)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Call/Put OI comparison */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <ArrowLeftRight className="w-4 h-4 text-purple-400" />
                </div>
                <h2 className="text-sm font-semibold text-white">Call/Put OI Comparison</h2>
              </div>
              <div className="flex items-center gap-6">
                {/* Donut chart */}
                {(() => {
                  const callPct = (data.totalCallOI / data.totalOI) * 100;
                  const r = 45;
                  const circumference = 2 * Math.PI * r;
                  const callDash = (callPct / 100) * circumference;
                  const putDash = circumference - callDash;
                  return (
                    <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
                      {/* Put arc (red background) */}
                      <circle
                        cx="60" cy="60" r={r}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="14"
                      />
                      {/* Call arc (green foreground) */}
                      <circle
                        cx="60" cy="60" r={r}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="14"
                        strokeDasharray={`${callDash} ${putDash}`}
                        strokeDashoffset={circumference / 4}
                        strokeLinecap="round"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
                      />
                      {/* Ratio in center */}
                      <text x="60" y="56" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">
                        {data.putCallRatio.toFixed(2)}
                      </text>
                      <text x="60" y="72" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">
                        P/C Ratio
                      </text>
                    </svg>
                  );
                })()}
                {/* Bar + labels */}
                <div className="flex-1">
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
                  <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                    <span>{((data.totalCallOI / data.totalOI) * 100).toFixed(1)}%</span>
                    <span>{((data.totalPutOI / data.totalOI) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Exchange Breakdown */}
            {data.exchangeBreakdown && data.exchangeBreakdown.length > 1 && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-hub-yellow" />
                  </div>
                  <h2 className="text-sm font-semibold text-white">OI by Exchange</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {data.exchangeBreakdown.map((ex) => (
                    <div key={ex.exchange} className="bg-white/[0.02] rounded-lg px-3 py-2">
                      <p className="text-xs text-neutral-500">{ex.exchange}</p>
                      <p className="text-sm font-bold text-white">${formatCompact(ex.totalOI)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full bg-hub-yellow rounded-full transition-all"
                            style={{ width: `${Math.min(ex.share, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-500">{ex.share.toFixed(1)}%</span>
                      </div>
                      <p className="text-[10px] text-neutral-600 mt-0.5">{ex.instruments} instruments</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OI by Strike Chart */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Open Interest by Strike</h2>
                  <p className="text-xs text-neutral-600">Dashed line = spot price</p>
                </div>
              </div>
              <div className="h-[250px] mt-3">
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
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Implied Volatility Smile</h2>
                    <p className="text-xs text-neutral-600">Mark IV across strike prices</p>
                  </div>
                </div>
                <div className="h-[180px] mt-3">
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
        <div className="mt-8 bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
            <div className="text-xs text-neutral-400 space-y-1">
              <p>
                <strong className="text-neutral-300">Options Data</strong> aggregated across Deribit, Binance, OKX, and Bybit.
                Max pain is weighted by combined OI across all exchanges.
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
      </main>
      <Footer />
    </div>
  );
}
