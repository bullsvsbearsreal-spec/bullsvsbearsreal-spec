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
  maxPain?: number;
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

/* ─── OI by Strike Chart ──────────────────────────────────────────── */

function OIByStrikeChart({
  strikes,
  spotPrice,
  maxPain,
  height = 320,
}: {
  strikes: StrikeData[];
  spotPrice: number;
  maxPain: number;
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (strikes.length === 0)
    return (
      <div className="flex items-center justify-center h-[200px] text-neutral-600 text-sm">
        No strike data available
      </div>
    );

  // Filter to strikes with meaningful OI and cap count for readability
  const filtered = strikes.filter((s) => s.callOI + s.putOI > 0);
  const display = filtered.length > 80
    ? filtered.filter((_, i) => i % Math.ceil(filtered.length / 80) === 0)
    : filtered;

  const totalOI = display.reduce((sum, s) => sum + s.callOI + s.putOI, 0) || 1;
  const maxOI = Math.max(...display.map((s) => Math.max(s.callOI, s.putOI)), 1);
  const width = 1200;
  const pad = { top: 18, bottom: 32, left: 4, right: 4 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const groupW = chartW / display.length;
  const barW = groupW * 0.38;
  const gap = groupW * 0.06;

  const spotIdx = display.findIndex((s) => s.strike >= spotPrice);
  const maxPainIdx = display.findIndex((s) => s.strike >= maxPain);
  const sameIdx = spotIdx === maxPainIdx;

  const hoveredStrike = hovered !== null ? display[hovered] : null;
  const tooltipX = hovered !== null ? pad.left + hovered * groupW + groupW / 2 : 0;

  // Label step — show ~12-15 labels evenly
  const labelStep = Math.max(1, Math.floor(display.length / 14));

  return (
    <div className="relative" onMouseLeave={() => setHovered(null)}>
      {/* Tooltip */}
      {hoveredStrike && hovered !== null && (
        <div
          className="absolute z-20 pointer-events-none bg-black/90 border border-white/10 rounded-lg px-3 py-2 shadow-2xl backdrop-blur-sm"
          style={{
            left: `${(tooltipX / width) * 100}%`,
            top: 4,
            transform: `translateX(${hovered > display.length * 0.7 ? '-100%' : hovered < display.length * 0.3 ? '0%' : '-50%'})`,
          }}
        >
          <p className="text-[11px] font-bold text-white font-mono mb-1">
            Strike ${hoveredStrike.strike.toLocaleString()}
          </p>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-2 h-2 rounded-sm bg-green-500" />
            <span className="text-green-400">Call OI:</span>
            <span className="text-white font-mono">${formatCompact(hoveredStrike.callOI)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-2 h-2 rounded-sm bg-red-500" />
            <span className="text-red-400">Put OI:</span>
            <span className="text-white font-mono">${formatCompact(hoveredStrike.putOI)}</span>
          </div>
          <p className="text-[9px] text-neutral-500 mt-1 font-mono">
            {(((hoveredStrike.callOI + hoveredStrike.putOI) / totalOI) * 100).toFixed(1)}% of total
          </p>
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={pad.left}
            y1={pad.top + chartH * (1 - pct)}
            x2={width - pad.right}
            y2={pad.top + chartH * (1 - pct)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={0.5}
          />
        ))}

        {/* Spot dashed line (rendered behind bars) */}
        {spotIdx >= 0 && (
          <line
            x1={pad.left + spotIdx * groupW + groupW / 2}
            y1={pad.top}
            x2={pad.left + spotIdx * groupW + groupW / 2}
            y2={pad.top + chartH}
            stroke="#eab308"
            strokeDasharray="4,3"
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}

        {/* Max Pain dashed line (rendered behind bars) */}
        {maxPainIdx >= 0 && maxPainIdx !== spotIdx && (
          <line
            x1={pad.left + maxPainIdx * groupW + groupW / 2}
            y1={pad.top}
            x2={pad.left + maxPainIdx * groupW + groupW / 2}
            y2={pad.top + chartH}
            stroke="#f97316"
            strokeDasharray="3,4"
            strokeWidth={1.5}
            opacity={0.6}
          />
        )}

        {display.map((s, i) => {
          const x = pad.left + i * groupW;
          const callH = (s.callOI / maxOI) * chartH;
          const putH = (s.putOI / maxOI) * chartH;
          const isSpot = i === spotIdx;
          const isMaxPain = i === maxPainIdx;
          const isHovered = i === hovered;

          return (
            <g key={s.strike} onMouseEnter={() => setHovered(i)}>
              {/* Invisible hover target */}
              <rect x={x} y={pad.top} width={groupW} height={chartH} fill="transparent" />
              {/* Call bar */}
              <rect
                x={x + gap}
                y={pad.top + chartH - callH}
                width={barW}
                height={Math.max(callH, 0.5)}
                fill={isHovered ? '#22c55e' : '#22c55ecc'}
                rx={1}
              />
              {/* Put bar */}
              <rect
                x={x + barW + gap * 2}
                y={pad.top + chartH - putH}
                width={barW}
                height={Math.max(putH, 0.5)}
                fill={isHovered ? '#ef4444' : '#ef4444cc'}
                rx={1}
              />

              {/* Strike label */}
              {(i % labelStep === 0 || isSpot || isMaxPain) && (
                <text
                  x={x + groupW / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isSpot ? '#eab308' : isMaxPain ? '#f97316' : 'rgba(255,255,255,0.3)'}
                  fontWeight={isSpot || isMaxPain ? 'bold' : 'normal'}
                  fontFamily="monospace"
                >
                  {s.strike >= 1000 ? `${(s.strike / 1000).toFixed(0)}K` : s.strike}
                </text>
              )}
            </g>
          );
        })}

        {/* Spot label at top */}
        {spotIdx >= 0 && (
          <text
            x={pad.left + spotIdx * groupW + groupW / 2}
            y={pad.top - 4}
            textAnchor="middle"
            fontSize="8"
            fill="#eab308"
            fontWeight="bold"
          >
            {sameIdx ? 'SPOT / MAX PAIN' : 'SPOT'}
          </text>
        )}

        {/* Max Pain label at top */}
        {maxPainIdx >= 0 && maxPainIdx !== spotIdx && (
          <text
            x={pad.left + maxPainIdx * groupW + groupW / 2}
            y={pad.top - 4}
            textAnchor="middle"
            fontSize="8"
            fill="#f97316"
            fontWeight="bold"
          >
            MAX PAIN
          </text>
        )}
      </svg>
    </div>
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
              fill="#22c55ecc"
              rx={1}
            />
            <rect
              x={x + barW + gap * 2}
              y={pad.top + chartH - putH}
              width={barW}
              height={Math.max(putH, 0.5)}
              fill="#ef4444cc"
              rx={1}
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

  const callPoints: string[] = points
    .map((p, i) => (p.callIV > 0 ? `${scaleX(i)},${scaleY(p.callIV)}` : null))
    .filter((v): v is string => v !== null);
  const putPoints: string[] = points
    .map((p, i) => (p.putIV > 0 ? `${scaleX(i)},${scaleY(p.putIV)}` : null))
    .filter((v): v is string => v !== null);

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
      {/* X-axis strike labels */}
      {(() => {
        const step = Math.max(1, Math.floor(points.length / 10));
        return points.map((p, i) => {
          if (i % step !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={p.strike}
              x={scaleX(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize="7"
              fill="rgba(255,255,255,0.25)"
              fontFamily="monospace"
            >
              {p.strike >= 1000 ? `${(p.strike / 1000).toFixed(0)}K` : p.strike}
            </text>
          );
        });
      })()}
      {/* Call IV area + line */}
      {callPoints.length > 1 && (
        <>
          <polygon
            points={`${callPoints[0].split(',')[0]},${pad.top + chartH} ${callPoints.join(' ')} ${callPoints[callPoints.length - 1].split(',')[0]},${pad.top + chartH}`}
            fill="rgba(34,197,94,0.08)"
          />
          <polyline
            points={callPoints.join(' ')}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}
      {/* Put IV area + line */}
      {putPoints.length > 1 && (
        <>
          <polygon
            points={`${putPoints[0].split(',')[0]},${pad.top + chartH} ${putPoints.join(' ')} ${putPoints[putPoints.length - 1].split(',')[0]},${pad.top + chartH}`}
            fill="rgba(239,68,68,0.08)"
          />
          <polyline
            points={putPoints.join(' ')}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
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

  const exchangeNames = useMemo(() => {
    if (!data?.exchangeBreakdown) return [];
    return data.exchangeBreakdown.filter((e) => e.totalOI > 0).map((e) => e.exchange);
  }, [data?.exchangeBreakdown]);

  const activeCount = data?.health?.filter((h) => h.status === 'ok' && h.count > 0).length || 0;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-3 sm:px-5 py-4">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-hub-yellow" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Options Data</h1>
              <p className="text-neutral-600 text-[11px] mt-0.5 flex items-center gap-1.5">
                Max pain, OI by strike, IV smile across {activeCount} exchanges
                {data && !loading && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5 border border-white/[0.06]">
              {(['BTC', 'ETH', 'SOL'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-3.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
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
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UpdatedAgo date={lastUpdate} />
          </div>
        </div>

        {/* Loading */}
        {loading && !data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-lg h-20 animate-pulse" />
              ))}
            </div>
            <div className="bg-hub-darker border border-white/[0.06] rounded-lg h-[280px] animate-pulse" />
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {/* Max Pain — nearest expiry */}
              {(() => {
                const nearest = data.expiryBreakdown?.[0];
                const mp = nearest?.maxPain || data.maxPain || 0;
                const dist = data.underlyingPrice > 0 ? ((mp - data.underlyingPrice) / data.underlyingPrice * 100) : 0;
                const label = nearest ? nearest.date.slice(5) : 'All';
                return (
                  <div className="relative overflow-hidden bg-gradient-to-br from-hub-yellow/[0.08] to-transparent border border-hub-yellow/20 rounded-xl px-3.5 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-hub-yellow" />
                      <p className="text-[9px] text-neutral-500 uppercase tracking-wider font-semibold">Max Pain <span className="text-neutral-600">({label})</span></p>
                    </div>
                    <p className="text-xl font-bold text-hub-yellow font-mono leading-none">${mp.toLocaleString()}</p>
                    <div className={`flex items-center gap-0.5 mt-1.5 text-[10px] ${dist >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {dist >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      <span className="font-mono">{dist >= 0 ? '+' : ''}{dist.toFixed(1)}% from spot</span>
                    </div>
                  </div>
                );
              })()}

              {/* Put/Call Ratio */}
              <div className="relative overflow-hidden bg-hub-darker border border-white/[0.06] rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ArrowLeftRight
                    className={`w-3.5 h-3.5 ${data.putCallRatio > 1 ? 'text-red-400' : 'text-green-400'}`}
                  />
                  <p className="text-[9px] text-neutral-500 uppercase tracking-wider font-semibold">Put/Call Ratio</p>
                </div>
                <p
                  className={`text-xl font-bold font-mono leading-none ${
                    data.putCallRatio > 1 ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {(data.putCallRatio || 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-neutral-500 mt-1.5">
                  {data.putCallRatio > 1 ? 'Bearish bias' : data.putCallRatio < 0.7 ? 'Bullish bias' : 'Neutral'}
                </p>
              </div>

              {/* Total OI */}
              <div className="relative overflow-hidden bg-hub-darker border border-white/[0.06] rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-[9px] text-neutral-500 uppercase tracking-wider font-semibold">Total Options OI</p>
                </div>
                <p className="text-xl font-bold text-white font-mono leading-none">${formatCompact(data.totalOI)}</p>
                <p className="text-[10px] text-neutral-500 mt-1.5">{data.instrumentCount.toLocaleString()} instruments</p>
              </div>

              {/* Spot Price */}
              <div className="relative overflow-hidden bg-hub-darker border border-white/[0.06] rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
                  <p className="text-[9px] text-neutral-500 uppercase tracking-wider font-semibold">Spot Price</p>
                </div>
                <p className="text-xl font-bold text-white font-mono leading-none">{formatPrice(data.underlyingPrice)}</p>
                <p className="text-[10px] text-neutral-500 mt-1.5">{currency}/USD</p>
              </div>
            </div>

            {/* Exchange Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              <button
                onClick={() => setActiveExchange('all')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                  activeExchange === 'all'
                    ? 'bg-hub-yellow text-black font-bold border-hub-yellow shadow-glow-sm'
                    : 'bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/[0.06] border-white/[0.06]'
                }`}
              >
                All Exchanges
              </button>
              {exchangeNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveExchange(name)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                    activeExchange === name
                      ? 'bg-hub-yellow text-black font-bold border-hub-yellow shadow-glow-sm'
                      : 'bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/[0.06] border-white/[0.06]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Call/Put OI Split */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <ArrowLeftRight className="w-4 h-4 text-purple-400" />
                  <h2 className="text-[13px] font-semibold text-white">
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
                        {(data.putCallRatio || 0).toFixed(2)}
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
                    <span className="text-neutral-600 italic font-sans">
                      {data.putCallRatio > 1.2
                        ? 'Elevated hedging — contrarian bullish'
                        : data.putCallRatio < 0.6
                        ? 'Strong call speculation — contrarian warning'
                        : data.putCallRatio < 0.85
                        ? 'Moderately bullish positioning'
                        : 'Balanced market positioning'}
                    </span>
                    <span>
                      {filteredOI.totalOI ? ((filteredOI.putOI / filteredOI.totalOI) * 100).toFixed(1) : '50.0'}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* OI by Strike */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  <div>
                    <h2 className="text-xs font-semibold text-white">
                      Open Interest by Strike
                      {activeExchange !== 'all' && (
                        <span className="text-hub-yellow ml-1.5">— {activeExchange}</span>
                      )}
                    </h2>
                    <p className="text-[10px] text-neutral-600">
                      Yellow dashed = spot price · Orange dashed = max pain
                    </p>
                  </div>
                </div>
              </div>
              <div className="h-[300px] mt-1.5">
                <OIByStrikeChart
                  strikes={filteredStrikes}
                  spotPrice={data.underlyingPrice}
                  maxPain={data.expiryBreakdown?.[0]?.maxPain || data.maxPain}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
              {/* OI by Expiry */}
              {data.expiryBreakdown && data.expiryBreakdown.length > 0 && (
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <div>
                      <h2 className="text-xs font-semibold text-white">OI by Expiry Date</h2>
                      <p className="text-[10px] text-neutral-600">
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
                  <div className="flex items-center gap-2 mb-2.5">
                    <Globe className="w-3.5 h-3.5 text-hub-yellow" />
                    <h2 className="text-xs font-semibold text-white">OI by Exchange</h2>
                  </div>
                  <div className="space-y-3">
                    {data.exchangeBreakdown.map((ex) => {
                      const total = ex.totalOI || 1;
                      const callPct = (ex.callOI / total) * 100;
                      return (
                        <div
                          key={ex.exchange}
                          className={`rounded-xl px-3.5 py-3 transition-all cursor-pointer ${
                            activeExchange === ex.exchange
                              ? 'bg-hub-yellow/10 border border-hub-yellow/20 shadow-glow-sm'
                              : 'bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]'
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
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <div>
                    <h2 className="text-xs font-semibold text-white">Implied Volatility Smile</h2>
                    <p className="text-[10px] text-neutral-600">Mark IV across strike prices (70–130% of spot)</p>
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

            {/* Max Pain by Expiry — full width */}
            {data.expiryBreakdown && data.expiryBreakdown.length > 0 && (
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-3.5 h-3.5 text-orange-400" />
                    <div>
                      <h2 className="text-xs font-semibold text-white">Max Pain by Expiry</h2>
                      <p className="text-[10px] text-neutral-600">{data.expiryBreakdown.length} upcoming expiries · spot ${formatPrice(data.underlyingPrice)}</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-600">
                    <span className="text-orange-400">&#9679;</span> near expiry (&le;3d)
                  </div>
                </div>
                {/* Header row */}
                <div className="grid grid-cols-[60px_1fr_70px_80px_60px] gap-2 px-3 py-1.5 text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">
                  <span>Date</span>
                  <span>Call / Put OI</span>
                  <span className="text-right">Total OI</span>
                  <span className="text-right">Max Pain</span>
                  <span className="text-right">vs Spot</span>
                </div>
                <div className="space-y-1 max-h-[360px] overflow-y-auto">
                  {data.expiryBreakdown.slice(0, 15).map((exp) => {
                    const total = exp.totalOI || 1;
                    const callPct = (exp.callOI / total) * 100;
                    const expDate = new Date(exp.expiry);
                    const nowDate = new Date();
                    const daysUntil = Math.max(0, Math.ceil((expDate.getTime() - nowDate.getTime()) / 86400000));
                    const isNear = daysUntil <= 3;
                    const mpDist = data.underlyingPrice > 0 && exp.maxPain
                      ? ((exp.maxPain - data.underlyingPrice) / data.underlyingPrice * 100)
                      : 0;

                    return (
                      <div
                        key={exp.date}
                        className={`grid grid-cols-[60px_1fr_70px_80px_60px] gap-2 items-center rounded-lg px-3 py-2 ${
                          isNear ? 'bg-orange-500/5 border border-orange-500/10' : 'bg-white/[0.02]'
                        }`}
                      >
                        <div>
                          <p className={`text-[11px] font-mono font-semibold ${isNear ? 'text-orange-400' : 'text-white'}`}>
                            {exp.date.slice(5)}
                          </p>
                          <p className="text-[9px] text-neutral-600">
                            {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? '1d' : `${daysUntil}d`}
                          </p>
                        </div>
                        <div>
                          <div className="h-2.5 rounded-full overflow-hidden flex bg-white/[0.04]">
                            <div className="h-full bg-green-500/50" style={{ width: `${callPct}%` }} />
                            <div className="h-full bg-red-500/50" style={{ width: `${100 - callPct}%` }} />
                          </div>
                          <div className="flex justify-between mt-0.5">
                            <span className="text-[9px] text-green-400/60 font-mono">C:{callPct.toFixed(0)}%</span>
                            <span className="text-[9px] text-red-400/60 font-mono">P:{(100 - callPct).toFixed(0)}%</span>
                          </div>
                        </div>
                        <p className="text-[11px] font-mono text-neutral-400 text-right">${formatCompact(exp.totalOI)}</p>
                        <p className="text-[11px] font-mono text-orange-400 font-semibold text-right">
                          ${exp.maxPain ? exp.maxPain.toLocaleString() : '—'}
                        </p>
                        <p className={`text-[10px] font-mono text-right ${mpDist >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {mpDist >= 0 ? '+' : ''}{mpDist.toFixed(1)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Exchange Health — inline */}
            {data.health && data.health.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
                <span className="text-[9px] text-neutral-600 uppercase tracking-wider font-semibold">Sources</span>
                {data.health.map((h) => (
                  <div key={h.exchange} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${h.status === 'ok' && h.count > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-[10px] text-neutral-500">{h.exchange}</span>
                    <span className="text-[9px] text-neutral-700 font-mono">{h.count > 0 ? `${h.count} · ${h.latency}ms` : '—'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Info footer */}
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
              <div className="flex items-center gap-2 text-[10px] text-neutral-600">
                <Info className="w-3 h-3 flex-shrink-0" />
                <span>Aggregated across Deribit, Binance, OKX & Bybit · Max Pain = strike minimizing option holder profit · P/C &gt; 1 = bearish hedging · Updates every 60s</span>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
