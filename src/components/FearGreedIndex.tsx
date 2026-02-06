'use client';

import { marketOverview } from '@/lib/mockData';
import { Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function FearGreedIndex() {
  const value = marketOverview.fearGreedIndex;

  const getLabel = (val: number) => {
    if (val <= 20) return { text: 'Extreme Fear', color: 'text-danger', bgColor: 'bg-danger/20', gradient: 'from-danger' };
    if (val <= 40) return { text: 'Fear', color: 'text-orange-400', bgColor: 'bg-orange-400/20', gradient: 'from-orange-400' };
    if (val <= 60) return { text: 'Neutral', color: 'text-hub-gray-text-light', bgColor: 'bg-hub-gray/30', gradient: 'from-hub-gray-text' };
    if (val <= 80) return { text: 'Greed', color: 'text-success', bgColor: 'bg-success/20', gradient: 'from-success' };
    return { text: 'Extreme Greed', color: 'text-success', bgColor: 'bg-success/20', gradient: 'from-success' };
  };

  const label = getLabel(value);
  const rotation = (value / 100) * 180 - 90;

  // Generate gauge segments
  const segments = [
    { label: 'Extreme Fear', color: '#ef4444', range: '0-20' },
    { label: 'Fear', color: '#f97316', range: '21-40' },
    { label: 'Neutral', color: '#6b7280', range: '41-60' },
    { label: 'Greed', color: '#22c55e', range: '61-80' },
    { label: 'Extreme Greed', color: '#22c55e', range: '81-100' },
  ];

  return (
    <div className="glass-card rounded-2xl p-6 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-hub-yellow/20 to-hub-orange/10 rounded-xl">
          <Gauge className="w-5 h-5 text-hub-yellow" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Fear & Greed</h2>
          <p className="text-hub-gray-text text-xs">Market sentiment indicator</p>
        </div>
      </div>

      {/* Gauge */}
      <div className="flex flex-col items-center">
        <div className="relative w-56 h-28">
          {/* Background arc */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="75%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            {/* Gauge background */}
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="rgba(42, 42, 42, 0.5)"
              strokeWidth="16"
              strokeLinecap="round"
            />

            {/* Gauge fill */}
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${(value / 100) * 251.2} 251.2`}
            />

            {/* Tick marks */}
            {[0, 25, 50, 75, 100].map((tick, i) => {
              const angle = ((tick / 100) * 180 - 180) * (Math.PI / 180);
              const x1 = 100 + 75 * Math.cos(angle);
              const y1 = 90 + 75 * Math.sin(angle);
              const x2 = 100 + 85 * Math.cos(angle);
              const y2 = 90 + 85 * Math.sin(angle);
              return (
                <line
                  key={tick}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />
              );
            })}
          </svg>

          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 origin-bottom transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          >
            <div className="w-1 h-20 bg-gradient-to-t from-white to-white/60 rounded-full shadow-lg shadow-white/20" />
          </div>

          {/* Center dot */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
            <div className="w-5 h-5 bg-white rounded-full shadow-lg shadow-white/30 border-2 border-hub-gray" />
          </div>
        </div>

        {/* Value display */}
        <div className="text-center mt-6">
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-bold text-gradient">{value}</span>
            <span className="text-hub-gray-text text-lg">/100</span>
          </div>
          <div className={`mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${label.bgColor}`}>
            {value > 50 ? (
              <TrendingUp className={`w-4 h-4 ${label.color}`} />
            ) : value < 50 ? (
              <TrendingDown className={`w-4 h-4 ${label.color}`} />
            ) : (
              <Minus className={`w-4 h-4 ${label.color}`} />
            )}
            <span className={`font-semibold ${label.color}`}>{label.text}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-danger" />
            <span className="text-xs text-hub-gray-text">Fear</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-hub-yellow" />
            <span className="text-xs text-hub-gray-text">Neutral</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-success" />
            <span className="text-xs text-hub-gray-text">Greed</span>
          </div>
        </div>
      </div>
    </div>
  );
}