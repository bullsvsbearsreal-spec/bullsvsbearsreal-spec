'use client';

import { useState, useEffect } from 'react';
import { Gauge } from 'lucide-react';

export default function FearGreedIndex() {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFearGreed = async () => {
      try {
        const res = await fetch('/api/fear-greed');
        if (res.ok) {
          const data = await res.json();
          setValue(data.value);
        }
      } catch {
        // Keep null — will show loading/fallback
      } finally {
        setLoading(false);
      }
    };

    fetchFearGreed();
    const interval = setInterval(fetchFearGreed, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const displayValue = value ?? 50;

  const getLabel = (val: number) => {
    if (val <= 20) return { text: 'Extreme Fear', color: 'text-red-400', barColor: 'bg-red-500' };
    if (val <= 40) return { text: 'Fear', color: 'text-orange-400', barColor: 'bg-orange-500' };
    if (val <= 60) return { text: 'Neutral', color: 'text-hub-yellow', barColor: 'bg-hub-yellow' };
    if (val <= 80) return { text: 'Greed', color: 'text-green-400', barColor: 'bg-green-500' };
    return { text: 'Extreme Greed', color: 'text-green-400', barColor: 'bg-green-500' };
  };

  const label = getLabel(displayValue);
  const rotation = (displayValue / 100) * 180 - 90;

  return (
    <div className="card-premium p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-hub-yellow/10 flex items-center justify-center">
            <Gauge className="w-3 h-3 text-hub-yellow" />
          </div>
          <h3 className="text-white font-semibold text-sm">Fear & Greed</h3>
        </div>
        <span className="text-neutral-600 text-[10px]">
          {loading ? 'Loading...' : 'Live · Alternative.me'}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative w-52 h-28">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 110">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#FFA500" />
                <stop offset="75%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
              <filter id="gaugeGlow">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
              </filter>
            </defs>

            {/* Background track */}
            <path
              d="M 20 95 A 80 80 0 0 1 180 95"
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="16"
              strokeLinecap="round"
            />

            {/* Glow behind active arc */}
            <path
              d="M 20 95 A 80 80 0 0 1 180 95"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${(displayValue / 100) * 251.2} 251.2`}
              opacity="0.15"
              filter="url(#gaugeGlow)"
            />

            {/* Active arc */}
            <path
              d="M 20 95 A 80 80 0 0 1 180 95"
              fill="none"
              stroke="url(#gaugeGradient)"
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
                <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
              );
            })}
          </svg>

          {/* Needle */}
          <div
            className="absolute bottom-[10px] left-1/2 origin-bottom transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          >
            <div className="w-0.5 h-[60px] bg-gradient-to-t from-white to-white/30 rounded-full" />
          </div>

          {/* Center dot */}
          <div className="absolute bottom-[6px] left-1/2 transform -translate-x-1/2">
            <div className="w-3 h-3 bg-white rounded-full border-2 border-neutral-800 shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
          </div>
        </div>

        {/* Value display */}
        <div className="text-center mt-3">
          <div className="flex items-baseline justify-center gap-1">
            {loading ? (
              <div className="h-8 w-12 bg-white/[0.06] rounded animate-pulse" />
            ) : (
              <span className="text-4xl font-bold text-white font-mono tabular-nums">{displayValue}</span>
            )}
            <span className="text-neutral-600 text-sm font-mono">/100</span>
          </div>
          <div className={`text-xs font-semibold ${label.color} mt-0.5`}>{label.text}</div>
        </div>

        {/* Color legend */}
        <div className="flex items-center gap-4 mt-4 text-[10px]">
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
