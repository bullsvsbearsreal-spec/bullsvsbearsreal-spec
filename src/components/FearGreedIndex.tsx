'use client';

import { marketOverview } from '@/lib/mockData';

export default function FearGreedIndex() {
  const value = marketOverview.fearGreedIndex;

  const getLabel = (val: number) => {
    if (val <= 20) return { text: 'Extreme Fear', color: 'text-red-400' };
    if (val <= 40) return { text: 'Fear', color: 'text-orange-400' };
    if (val <= 60) return { text: 'Neutral', color: 'text-gray-400' };
    if (val <= 80) return { text: 'Greed', color: 'text-green-400' };
    return { text: 'Extreme Greed', color: 'text-green-400' };
  };

  const label = getLabel(value);
  const rotation = (value / 100) * 180 - 90;

  return (
    <div className="bg-hub-gray/20 border border-hub-gray/20 rounded-xl p-5 h-full">
      <h3 className="text-white font-semibold mb-4">Fear & Greed Index</h3>

      <div className="flex flex-col items-center">
        {/* Simple gauge */}
        <div className="relative w-48 h-24 mb-4">
          <svg className="w-full h-full" viewBox="0 0 200 100">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            {/* Background */}
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="#333"
              strokeWidth="12"
              strokeLinecap="round"
            />

            {/* Colored arc */}
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth="10"
              strokeLinecap="round"
            />
          </svg>

          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          >
            <div className="w-0.5 h-16 bg-white rounded-full" />
          </div>

          {/* Center circle */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-white rounded-full" />
        </div>

        {/* Value */}
        <div className="text-center">
          <div className="text-4xl font-bold text-white mb-1">{value}</div>
          <div className={`text-sm font-medium ${label.color}`}>{label.text}</div>
        </div>

        {/* Scale labels */}
        <div className="flex justify-between w-full mt-4 text-xs text-hub-gray-text">
          <span>0 Fear</span>
          <span>100 Greed</span>
        </div>
      </div>
    </div>
  );
}
