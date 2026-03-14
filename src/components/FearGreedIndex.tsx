'use client';

import { useState, useEffect, useMemo } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FearGreedEntry {
  value: number;
  classification: string;
  timestamp: number;
}

const ZONES = [
  { max: 20, label: 'Extreme Fear', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { max: 40, label: 'Fear', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { max: 60, label: 'Neutral', color: '#FFA500', bg: 'rgba(255,165,0,0.12)' },
  { max: 80, label: 'Greed', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  { max: 100, label: 'Extreme Greed', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
] as const;

function getZone(val: number) {
  return ZONES.find((z) => val <= z.max) || ZONES[4];
}

export default function FearGreedIndex() {
  const [current, setCurrent] = useState<FearGreedEntry | null>(null);
  const [history, setHistory] = useState<FearGreedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/fear-greed?history=true&limit=7');
        if (res.ok) {
          const data = await res.json();
          setCurrent(data.current);
          setHistory(data.history || []);
        }
      } catch {
        // fallback — keep loading state
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const displayValue = current?.value ?? 50;
  const zone = getZone(displayValue);
  const rotation = (displayValue / 100) * 180 - 90;

  // Yesterday's value and change
  const yesterday = history.length > 1 ? history[1] : null;
  const change = yesterday ? displayValue - yesterday.value : null;

  // Sparkline data (reversed so oldest is left)
  const sparkData = useMemo(() => {
    const pts = [...history].reverse();
    if (pts.length < 2) return null;
    const values = pts.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 120;
    const h = 28;
    const pad = 2;
    return values
      .map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (w - pad * 2);
        const y = pad + (1 - (v - min) / range) * (h - pad * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [history]);

  return (
    <div className="card-premium p-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-hub-yellow/10 flex items-center justify-center">
            <Gauge className="w-3 h-3 text-hub-yellow" />
          </div>
          <h3 className="text-white font-semibold text-sm">Fear & Greed</h3>
        </div>
        <span className="text-neutral-600 text-[10px]">
          {loading ? 'Loading...' : 'Live'}
        </span>
      </div>

      <div className="flex flex-col items-center">
        {/* Gauge */}
        <div className="relative w-40 h-[85px]">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 110">
            <defs>
              <linearGradient id="fgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#FFA500" />
                <stop offset="75%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
              <filter id="fgGlow">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
              </filter>
            </defs>

            {/* Background track */}
            <path
              d="M 20 95 A 80 80 0 0 1 180 95"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="16"
              strokeLinecap="round"
            />

            {/* Glow */}
            <path
              d="M 20 95 A 80 80 0 0 1 180 95"
              fill="none"
              stroke="url(#fgGrad)"
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${(displayValue / 100) * 251.2} 251.2`}
              opacity="0.15"
              filter="url(#fgGlow)"
            />

            {/* Active arc */}
            <path
              d="M 20 95 A 80 80 0 0 1 180 95"
              fill="none"
              stroke="url(#fgGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(displayValue / 100) * 251.2} 251.2`}
            />

            {/* Tick marks */}
            {[0, 25, 50, 75, 100].map((tick) => {
              const angle = (tick / 100) * Math.PI;
              const x1 = 100 - Math.cos(angle) * 68;
              const y1 = 95 - Math.sin(angle) * 68;
              const x2 = 100 - Math.cos(angle) * 62;
              const y2 = 95 - Math.sin(angle) * 62;
              return (
                <line
                  key={tick}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Needle */}
          <div
            className="absolute bottom-[8px] left-1/2 origin-bottom transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          >
            <div className="w-0.5 h-[46px] bg-gradient-to-t from-white to-white/30 rounded-full" />
          </div>

          {/* Center dot */}
          <div className="absolute bottom-[5px] left-1/2 transform -translate-x-1/2">
            <div className="w-2.5 h-2.5 bg-white rounded-full border-2 border-neutral-800 shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
          </div>
        </div>

        {/* Value + label */}
        <div className="text-center mt-2">
          <div className="flex items-baseline justify-center gap-1.5">
            {loading ? (
              <div className="h-7 w-10 bg-white/[0.06] rounded animate-pulse" />
            ) : (
              <span className="text-3xl font-bold text-white font-mono tabular-nums">{displayValue}</span>
            )}
            <span className="text-neutral-600 text-xs font-mono">/100</span>
          </div>
          <div
            className="text-[11px] font-semibold mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ color: zone.color, background: zone.bg }}
          >
            {zone.label}
          </div>
        </div>

        {/* Change from yesterday */}
        {change !== null && !loading && (
          <div className="flex items-center gap-1 mt-1.5 text-[11px]">
            {change > 0 ? (
              <TrendingUp className="w-3 h-3 text-green-400" />
            ) : change < 0 ? (
              <TrendingDown className="w-3 h-3 text-red-400" />
            ) : (
              <Minus className="w-3 h-3 text-neutral-500" />
            )}
            <span className={change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-neutral-500'}>
              {change > 0 ? '+' : ''}{change}
            </span>
            <span className="text-neutral-600">from yesterday</span>
          </div>
        )}

        {/* 7-day sparkline */}
        {sparkData && !loading && (
          <div className="mt-2 w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-neutral-600">7-day trend</span>
              <div className="flex items-center gap-2 text-[10px] text-neutral-600">
                <span>{history[history.length - 1]?.value}</span>
                <span className="text-neutral-700">&rarr;</span>
                <span style={{ color: zone.color }}>{displayValue}</span>
              </div>
            </div>
            <svg viewBox="0 0 120 28" className="w-full h-7" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={zone.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={zone.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Fill area */}
              <path
                d={`${sparkData} L118,26 L2,26 Z`}
                fill="url(#sparkFill)"
              />
              {/* Line */}
              <path
                d={sparkData}
                fill="none"
                stroke={zone.color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {/* Zone legend */}
        <div className="flex items-center gap-3 mt-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
            <span className="text-neutral-500">Fear</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full bg-hub-yellow" />
            <span className="text-neutral-500">Neutral</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full bg-gradient-to-r from-green-500 to-green-400" />
            <span className="text-neutral-500">Greed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
