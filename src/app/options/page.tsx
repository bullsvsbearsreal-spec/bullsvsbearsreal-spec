'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { formatCompact, formatPrice, formatUSD } from '@/lib/utils/format';
import {
  RefreshCw, Info, Target, Crosshair, ArrowLeftRight, BarChart3,
  DollarSign, Activity, Globe, TrendingUp, TrendingDown, Calendar,
} from 'lucide-react';

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

interface ExpiryEntry {
  date: string;
  callOI: number;
  putOI: number;
  totalOI: number;
  expiry: number;
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
  expiryBreakdown?: ExpiryEntry[];
  exchangeStrikes?: Record<string, StrikeData[]>;
  health?: Array<{ exchange: string; status: string; count: number; latency: number }>;
}

/* ─── OI by Strike Chart (enhanced SVG) ──────────────────────────── */

function OIByStrikeChart({
  strikes,
  spotPrice,
  maxPain,
  height = 280,
}: {
  strikes: StrikeData[];
  spotPrice: number;
  maxPain: number;
  height?: number;
}) {
  if (strikes.length === 0)
    return (
      <div className="flex items-center justify-center h-[200px] text-neutral-600 text-sm">
        No strike data available
      </div>
    );

  const maxOI = Math.max(...strikes.map((s) => Math.max(s.callOI, s.putOI)), 1);
  const width = 900;
  const pad = { top: 12, bottom: 36, left: 4, right: 4 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const groupW = chartW / strikes.length;
  const barW = groupW * 0.35;
  const gap = groupW * 0.08;

  const spotIdx = strikes.findIndex((s) => s.strike >= spotPrice);
  const maxPainIdx = strikes.findIndex((s) => s.strike >= maxPain);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line
          key={pct}
          x1={pad.left}
          y1={pad.top + chartH * (1 - pct)}
          x2={width - pad.right}
          y2={pad.top + chartH * (1 - pct)}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={0.5}
        />
      ))}

      {strikes.map((s, i) => {
        const x = pad.left + i * groupW;
        const callH = (s.callOI / maxOI) * chartH;
        const putH = (s.putOI / maxOI) * chartH;
        const isSpot = i === spotIdx;
        const isMaxPain = i === maxPainIdx;

        return (
          <g key={s.strike}>
            {/* Call bar */}
            <rect
              x={x + gap}
              y={pad.top + chartH - callH}
              width={barW}
              height={Math.max(callH, 0.5)}
              fill="rgba(34,197,94,0.55)"
              rx={1.5}
            />
            {/* Put bar */}
            <rect
              x={x + barW + gap * 2}
              y={pad.top + chartH - putH}
              width={barW}
              height={Math.max(putH, 0.5)}
              fill="rgba(239,68,68,0.55)"
              rx={1.5}
            />

            {/* Strike label */}
            {(i % Math.max(1, Math.floor(strikes.length / 15)) === 0 || isSpot || isMaxPain) && (
              <text
                x={x + groupW / 2}
                y={height - 6}
                textAnchor="middle"
                fontSize="8"
                fill={isSpot ? '#eab308' : isMaxPain ? '#f97316' : 'rgba(255,255,255,0.25)'}
                fontWeight={isSpot || isMaxPain ? 'bold' : 'normal'}
                fontFamily="monospace"
              >
                {s.strike >= 1000 ? `${(s.strike / 1000).toFixed(0)}K` : s.strike}
              </text>
            )}

            {/* Spot marker */}
            {isSpot && (
              <>
                <line
                  x1={x + groupW / 2}
                  y1={pad.top}
                  x2={x + groupW / 2}
                  y2={pad.top + chartH}
                  stroke="#eab308"
                  strokeDasharray="3,3"
                  strokeWidth={1}
                  opacity={0.6}
                />
                <text
                  x={x + groupW / 2}
                  y={pad.top - 2}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#eab308"
                  fontWeight="bold"
                >
                  SPOT
                </text>
              </>
            )}

            {/* Max Pain marker */}
            {isMaxPain && !isSpot && (
              <>
                <line
                  x1={x + groupW / 2}
                  y1={pad.top}
                  x2={x + groupW / 2}
                  y2={pad.top + chartH}
                  stroke="#f97316"
                  strokeDasharray="2,4"
                  strokeWidth={1}
                  opacity={0.5}
                />
                <text
                  x={x + groupW / 2}
                  y={pad.top - 2}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#f97316"
                  fontWeight="bold"
                >
                  MAX PAIN
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── OI by Expiry Chart ─────────────────────────────────────────── */

function OIByExpiryChart({
  entries,
  height = 200,
}: {
  entries: ExpiryEntry[];
  height?: number;
}) {
  if (entries.length === 0) return null;

  const maxOI = Math.max(...entries.map((e) => Math.max(e.callOI, e.putOI)), 1);
  const width = 900;
  const pad = { top: 8, bottom: 40, left: 4, right: 4 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const groupW = chartW / entries.length;
  const barW = groupW * 0.32;
  const gap = groupW * 0.1;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {entries.map((e, i) => {
        const x = pad.left + i * groupW;
        const callH = (e.callOI / maxOI) * chartH;
        const putH = (e.putOI / maxOI) * chartH;

        const d = new Date(e.expiry);
        const label = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        return (
          <g key={e.date}>
            <rect
              x={x + gap}
              y={pad.top + chartH - callH}
              width={barW}
              height={Math.max(callH, 0.5)}
              fill="rgba(34,197,94,0.5)"
              rx={1.5}
            />
            <rect
              x={x + barW + gap * 2}
              y={pad.top + chartH - putH}
              width={barW}
              height={Math.max(putH, 0.5)}
              fill="rgba(239,68,68,0.5)"
              rx={1.5}
            />
            {/* Total OI label on top */}
            <text
              x={x + groupW / 2}
              y={pad.top + chartH - Math.max(callH, putH) - 4}
              textAnchor="middle"
              fontSize="6.5"
              fill="rgba(255,255,255,0.3)"
              fontFamily="monospace"
            >
              {formatCompact(e.totalOI)}
            </text>
            {/* Date label */}
            <text
              x={x + groupW / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="7.5"
              fill="rgba(255,255,255,0.3)"
              fontFamily="monospace"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── IV Smile Chart ─────────────────────────────────────────────── */

function IVSmileChart({
  points,
  spotPrice,
  height = 200,
}: {
  points: IVPoint[];
  spotPrice: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const allIVs = points.flatMap((p) => [p.callIV, p.putIV].filter((v) => v > 0));
  if (allIVs.length === 0) return null;

  const minIV = Math.min(...allIVs) * 0.9;
  const maxIV = Math.max(...allIVs) * 1.05;
  const range = maxIV - minIV || 1;

  const width = 900;
  const pad = { top: 16, bottom: 28, left: 40, right: 8 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const scaleX = (i: number) => pad.left + (i / (points.length - 1)) * chartW;
  const scaleY = (val: number) => pad.top + (1 - (val - minIV) / range) * chartH;

  const callPoints = points
    .map((p, i) => (p.callIV > 0 ? `${scaleX(i)},${scaleY(p.callIV)}` : null))
    .filter(Boolean);
  const putPoints = points
    .map((p, i) => (p.putIV > 0 ? `${scaleX(i)},${scaleY(p.putIV)}` : null))
    .filter(Boolean);

  // Y-axis labels
  const yTicks = [0.25, 0.5, 0.75, 1].map((pct) => ({
    value: minIV + pct * range,
    y: scaleY(minIV + pct * range),
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid + labels */}
      {yTicks.map((tick) => (
        <g key={tick.value}>
          <line
            x1={pad.left}
            y1={tick.y}
            x2={width - pad.right}
            y2={tick.y}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={0.5}
          />
          <text x={pad.left - 4} y={tick.y + 3} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.25)" fontFamily="monospace">
            {tick.value.toFixed(0)}%
          </text>
        </g>
      ))}
      {/* Call IV line */}
      {callPoints.length > 1 && (
        <polyline
          points={callPoints.join(' ')}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {/* Put IV line */}
      {putPoints.length > 1 && (
        <polyline
          points={putPoints.join(' ')}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

export default function OptionsPage() {
  const [currency, setCurrency] = useState<'BTC' | 'ETH' | 'SOL'>('BTC');
  const [data, setData] = useState<OptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeExchange, setActiveExchange] = useState<string>('all');

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
      setActiveExchange('all');
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

  /* Derived data based on exchange filter */
  const filteredStrikes = useMemo(() => {
    if (!data) return [];
    if (activeExchange === 'all') return data.strikeData;
    return data.exchangeStrikes?.[activeExchange] || [];
  }, [data, activeExchange]);

  const filteredOI = useMemo(() => {
    if (!data) return { callOI: 0, putOI: 0, totalOI: 0 };
    if (activeExchange === 'all') {
      return { callOI: data.totalCallOI, putOI: data.totalPutOI, totalOI: data.totalOI };
    }
    const ex = data.exchangeBreakdown?.find((e) => e.exchange === activeExchange);
    return ex
      ? { callOI: ex.callOI, putOI: ex.putOI, totalOI: ex.totalOI }
      : { callOI: 0, putOI: 0, totalOI: 0 };
  }, [data, activeExchange]);

  const maxPainDistance = useMemo(() => {
    if (!data || !data.underlyingPrice) return 0;
    return ((data.maxPain - data.underlyingPrice) / data.underlyingPrice) * 100;
  }, [data]);

  const exchangeNames = useMemo(() => {
    if (!data?.exchangeBreakdown) return [];
    return data.exchangeBreakdown.filter((e) => e.totalOI > 0).map((e) => e.exchange);
  }, [data?.exchangeBreakdown]);

  const activeCount = data?.health?.filter((h) => h.status === 'ok' && h.count > 0).length || 0;

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
                Max pain, OI by strike, IV smile across {activeCount} exchanges
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
              {(['BTC', 'ETH', 'SOL'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                    currency === c
                      ? 'bg-hub-yellow text-black shadow-glow-sm'
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

        {/* Loading */}
        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-xl h-24 animate-pulse" />
              ))}
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl h-[300px] animate-pulse" />
          </div>
        )}

        {error && !data && (
          <div className="text-center py-12 text-red-400">
            <p>{error}</p>
            <button onClick={fetchData} className="mt-3 text-sm text-hub-yellow hover:underline">
              Retry
            </button>
          </div>
        )}

        {data && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {/* Max Pain */}
              <div className="bg-hub-darker border border-hub-yellow/20 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Crosshair className="w-3.5 h-3.5 text-hub-yellow" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Max Pain</p>
                </div>
                <p className="text-xl font-bold text-hub-yellow font-mono">${data.maxPain.toLocaleString()}</p>
                <div
                  className={`flex items-center gap-1 mt-0.5 text-xs ${
                    maxPainDistance >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {maxPainDistance >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span className="font-mono">
                    {maxPainDistance >= 0 ? '+' : ''}
                    {maxPainDistance.toFixed(1)}% from spot
                  </span>
                </div>
              </div>

              {/* Put/Call Ratio */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowLeftRight
                    className={`w-3.5 h-3.5 ${data.putCallRatio > 1 ? 'text-red-400' : 'text-green-400'}`}
                  />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Put/Call Ratio</p>
                </div>
                <p
                  className={`text-xl font-bold font-mono ${
                    data.putCallRatio > 1 ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {data.putCallRatio.toFixed(2)}
                </p>
                <p className="text-xs text-neutral-500">
                  {data.putCallRatio > 1 ? 'Bearish bias' : data.putCallRatio < 0.7 ? 'Bullish bias' : 'Neutral'}
                </p>
              </div>

              {/* Total OI */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Total Options OI</p>
                </div>
                <p className="text-xl font-bold text-white font-mono">${formatCompact(data.totalOI)}</p>
                <p className="text-xs text-neutral-500">{data.instrumentCount.toLocaleString()} instruments</p>
              </div>

              {/* Spot Price */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-white" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Spot Price</p>
                </div>
                <p className="text-xl font-bold text-white font-mono">{formatPrice(data.underlyingPrice)}</p>
                <p className="text-xs text-neutral-500">{currency}/USD</p>
              </div>
            </div>

            {/* Exchange Tabs */}
            <div className="flex flex-wrap gap-1 mb-4">
              <button
                onClick={() => setActiveExchange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeExchange === 'all'
                    ? 'bg-hub-yellow text-black shadow-glow-sm'
                    : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                All Exchanges
              </button>
              {exchangeNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveExchange(name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeExchange === name
                      ? 'bg-hub-yellow text-black shadow-glow-sm'
                      : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Call/Put OI Split */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <ArrowLeftRight className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Call / Put Open Interest
                    {activeExchange !== 'all' && (
                      <span className="text-hub-yellow ml-1.5">— {activeExchange}</span>
                    )}
                  </h2>
                </div>
                <span className="text-xs text-neutral-500 font-mono">
                  Total: ${formatCompact(filteredOI.totalOI)}
                </span>
              </div>

              <div className="flex items-center gap-5">
                {/* Donut */}
                {(() => {
                  const total = filteredOI.totalOI || 1;
                  const callPct = (filteredOI.callOI / total) * 100;
                  const r = 42;
                  const c = 2 * Math.PI * r;
                  const callDash = (callPct / 100) * c;

                  return (
                    <svg width="110" height="110" viewBox="0 0 110 110" className="flex-shrink-0">
                      <circle cx="55" cy="55" r={r} fill="none" stroke="#ef4444" strokeWidth="12" opacity="0.6" />
                      <circle
                        cx="55"
                        cy="55"
                        r={r}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="12"
                        strokeDasharray={`${callDash} ${c - callDash}`}
                        strokeDashoffset={c / 4}
                        strokeLinecap="round"
                        opacity="0.8"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '55px 55px' }}
                      />
                      <text x="55" y="51" textAnchor="middle" fontSize="15" fontWeight="bold" fill="white">
                        {data.putCallRatio.toFixed(2)}
                      </text>
                      <text x="55" y="66" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.35)">
                        P/C Ratio
                      </text>
                    </svg>
                  );
                })()}

                {/* Bar + breakdown */}
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-green-400 font-medium">
                      Calls — ${formatCompact(filteredOI.callOI)}
                    </span>
                    <span className="text-red-400 font-medium">
                      Puts — ${formatCompact(filteredOI.putOI)}
                    </span>
                  </div>
                  <div className="h-5 rounded-full overflow-hidden flex bg-white/[0.04]">
                    <div
                      className="h-full bg-green-500/70 transition-all duration-500"
                      style={{ width: `${filteredOI.totalOI ? (filteredOI.callOI / filteredOI.totalOI) * 100 : 50}%` }}
                    />
                    <div
                      className="h-full bg-red-500/70 transition-all duration-500"
                      style={{ width: `${filteredOI.totalOI ? (filteredOI.putOI / filteredOI.totalOI) * 100 : 50}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-500 mt-1 font-mono">
                    <span>
                      {filteredOI.totalOI ? ((filteredOI.callOI / filteredOI.totalOI) * 100).toFixed(1) : '50.0'}%
                    </span>
                    <span>
                      {filteredOI.totalOI ? ((filteredOI.putOI / filteredOI.totalOI) * 100).toFixed(1) : '50.0'}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* OI by Strike */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Open Interest by Strike
                      {activeExchange !== 'all' && (
                        <span className="text-hub-yellow ml-1.5">— {activeExchange}</span>
                      )}
                    </h2>
                    <p className="text-xs text-neutral-600">
                      Yellow dashed = spot price
                      {data.maxPain !== data.underlyingPrice && ' · Orange dashed = max pain'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="h-[280px] mt-2">
                <OIByStrikeChart
                  strikes={filteredStrikes}
                  spotPrice={data.underlyingPrice}
                  maxPain={data.maxPain}
                />
              </div>
              <div className="flex justify-center gap-6 mt-2 text-xs text-neutral-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-green-500/55" /> Calls
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-red-500/55" /> Puts
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-hub-yellow" /> Spot
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-orange-500" /> Max Pain
                </div>
              </div>
            </div>

            {/* OI by Expiry + Exchange Breakdown — side by side on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* OI by Expiry */}
              {data.expiryBreakdown && data.expiryBreakdown.length > 0 && (
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2.5 mb-1">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <div>
                      <h2 className="text-sm font-semibold text-white">OI by Expiry Date</h2>
                      <p className="text-xs text-neutral-600">
                        {data.expiryBreakdown.length} upcoming expiries
                      </p>
                    </div>
                  </div>
                  <div className="h-[200px] mt-2">
                    <OIByExpiryChart entries={data.expiryBreakdown.slice(0, 12)} />
                  </div>
                  <div className="flex justify-center gap-6 mt-2 text-xs text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-green-500/50" /> Calls
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-red-500/50" /> Puts
                    </div>
                  </div>
                </div>
              )}

              {/* Exchange Breakdown */}
              {data.exchangeBreakdown && data.exchangeBreakdown.length > 1 && (
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Globe className="w-4 h-4 text-hub-yellow" />
                    <h2 className="text-sm font-semibold text-white">OI by Exchange</h2>
                  </div>
                  <div className="space-y-3">
                    {data.exchangeBreakdown.map((ex) => {
                      const total = ex.totalOI || 1;
                      const callPct = (ex.callOI / total) * 100;
                      return (
                        <div
                          key={ex.exchange}
                          className={`rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                            activeExchange === ex.exchange
                              ? 'bg-hub-yellow/10 border border-hub-yellow/20'
                              : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04]'
                          }`}
                          onClick={() => setActiveExchange(ex.exchange === activeExchange ? 'all' : ex.exchange)}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-semibold text-white">{ex.exchange}</span>
                            <span className="text-sm font-bold text-white font-mono">
                              ${formatCompact(ex.totalOI)}
                            </span>
                          </div>
                          {/* Call/Put split bar */}
                          <div className="h-2 rounded-full overflow-hidden flex bg-white/[0.04]">
                            <div
                              className="h-full bg-green-500/60 transition-all"
                              style={{ width: `${callPct}%` }}
                            />
                            <div
                              className="h-full bg-red-500/60 transition-all"
                              style={{ width: `${100 - callPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-neutral-500">
                              {ex.share.toFixed(1)}% share · {ex.instruments} instruments
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              C:{callPct.toFixed(0)}% / P:{(100 - callPct).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* IV Smile */}
            {data.ivSmile.length > 2 && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <div>
                    <h2 className="text-sm font-semibold text-white">Implied Volatility Smile</h2>
                    <p className="text-xs text-neutral-600">Mark IV across strike prices (70–130% of spot)</p>
                  </div>
                </div>
                <div className="h-[200px] mt-2">
                  <IVSmileChart points={data.ivSmile} spotPrice={data.underlyingPrice} />
                </div>
                <div className="flex justify-center gap-6 mt-2 text-xs text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 rounded-full bg-green-500" /> Call IV
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 rounded-full bg-red-500" /> Put IV
                  </div>
                </div>
              </div>
            )}

            {/* Exchange Health */}
            {data.health && data.health.length > 0 && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Data Sources</h3>
                <div className="flex flex-wrap gap-3">
                  {data.health.map((h) => (
                    <div
                      key={h.exchange}
                      className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-1.5"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          h.status === 'ok' && h.count > 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-xs text-neutral-400">{h.exchange}</span>
                      <span className="text-[10px] text-neutral-600 font-mono">
                        {h.count > 0 ? `${h.count} · ${h.latency}ms` : 'unavailable'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info footer */}
            <div className="bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
                <div className="text-xs text-neutral-400 space-y-1">
                  <p>
                    <strong className="text-neutral-300">Options Data</strong> aggregated across Deribit, Binance,
                    OKX, and Bybit. Click exchange tabs to filter by source.
                  </p>
                  <p>
                    <strong>Max Pain:</strong> The strike price where option holders lose the most money at
                    expiry. Price tends to gravitate toward max pain near expiration.
                  </p>
                  <p>
                    <strong>Put/Call Ratio:</strong> Above 1 = more puts (bearish hedging). Below 1 = more
                    calls (bullish speculation). Below 0.7 = strongly bullish.
                  </p>
                  <p>Updates every 60 seconds.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
