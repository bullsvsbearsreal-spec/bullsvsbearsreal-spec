'use client';

import { marketOverview } from '@/lib/mockData';

export default function FearGreedIndex() {
  const value = marketOverview.fearGreedIndex;

  const getLabel = (val: number) => {
    if (val <= 20) return { text: 'Extreme Fear', color: 'text-red-400' };
    if (val <= 40) return { text: 'Fear', color: 'text-orange-400' };
    if (val <= 60) return { text: 'Neutral', color: 'text-hub-yellow' };
    if (val <= 80) return { text: 'Greed', color: 'text-green-400' };
    return { text: 'Extreme Greed', color: 'text-green-400' };
  };

  const label = getLabel(value);
  const rotation = (value / 100) * 180 - 90;

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">Fear & Greed</h3>
        <span className="text-neutral-600 text-[10px]">Market sentiment</span>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative w-48 h-24">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#FFA500" />
                <stop offset="75%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="14"
              strokeLinecap="round"
            />

            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(value / 100) * 251.2} 251.2`}
            />
          </svg>

          <div
            className="absolute bottom-0 left-1/2 origin-bottom transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          >
            <div className="w-0.5 h-16 bg-gradient-to-t from-white to-white/40 rounded-full" />
          </div>

          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
            <div className="w-3 h-3 bg-white rounded-full border-2 border-neutral-800" />
          </div>
        </div>

        <div className="text-center mt-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-bold text-white font-mono">{value}</span>
            <span className="text-neutral-600 text-sm">/100</span>
          </div>
          <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
        </div>

        <div className="flex items-center gap-4 mt-3 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-red-500" />
            <span className="text-neutral-600">Fear</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-hub-yellow" />
            <span className="text-neutral-600">Neutral</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-green-500" />
            <span className="text-neutral-600">Greed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
