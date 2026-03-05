'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { formatUSD, formatPnl } from './utils';

export function ProfitCalculator({ grossSpread8h, roundTripFee, highExchange, lowExchange }: {
  grossSpread8h: number; roundTripFee: number; highExchange: string; lowExchange: string;
}) {
  const [size, setSize] = useState(10000);
  const [leverage, setLeverage] = useState(5);
  const [duration, setDuration] = useState<number>(30);

  // Fee model: round-trip fee is ONE-TIME (open + close), funding income accumulates daily
  const dailyGross = (grossSpread8h / 100) * size * 3; // 3 × 8h periods per day
  const feeCost = (roundTripFee / 100) * size;          // one-time entry+exit cost
  const grossIncome = dailyGross * duration;
  const periodNet = grossIncome - feeCost;               // net = gross - one-time fees
  const requiredMargin = (size / leverage) * 2; // both sides
  const roiOnMargin = requiredMargin > 0 ? (periodNet / requiredMargin) * 100 : 0;
  const breakEvenDays = dailyGross > 0 ? feeCost / dailyGross : Infinity;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-3.5 h-3.5 text-hub-yellow" />
        <span className="text-white text-xs font-semibold">Profit Calculator</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-neutral-500 text-[10px] block mb-1">Position Size</label>
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1">
            <span className="text-neutral-400 text-xs">$</span>
            <input type="number" value={size} onChange={e => setSize(Math.max(100, parseInt(e.target.value) || 100))} className="bg-transparent text-white text-xs font-mono w-full outline-none" />
          </div>
          <div className="flex gap-1 mt-1">
            {[1000, 5000, 10000, 50000, 100000].map(v => (
              <button key={v} onClick={() => setSize(v)} className={`px-1.5 py-0.5 rounded text-[9px] ${size === v ? 'bg-hub-yellow text-black' : 'text-neutral-600 bg-white/[0.04]'}`}>
                {v >= 1000 ? `${v / 1000}K` : v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-neutral-500 text-[10px] block mb-1">Leverage</label>
          <div className="flex items-center gap-2">
            <input type="range" min={1} max={20} value={leverage} onChange={e => setLeverage(parseInt(e.target.value))} className="w-full h-1 accent-hub-yellow" />
            <span className="text-white text-xs font-mono w-8">{leverage}x</span>
          </div>
        </div>
        <div>
          <label className="text-neutral-500 text-[10px] block mb-1">Duration</label>
          <div className="flex gap-1">
            {[{ d: 1, l: '1D' }, { d: 7, l: '7D' }, { d: 30, l: '30D' }, { d: 90, l: '90D' }, { d: 365, l: '1Y' }].map(({ d, l }) => (
              <button key={d} onClick={() => setDuration(d)} className={`px-2 py-1 rounded text-[10px] font-medium ${duration === d ? 'bg-hub-yellow text-black' : 'text-neutral-600 bg-white/[0.04]'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-neutral-500 text-[10px] block mb-1">Fees ({highExchange} + {lowExchange})</label>
          <span className="text-neutral-400 font-mono text-xs">{roundTripFee.toFixed(3)}% round-trip</span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'Gross Income', value: formatPnl(grossIncome), color: 'text-neutral-300' },
          { label: 'Fee Cost', value: `-$${feeCost.toFixed(2)}`, color: 'text-red-400' },
          { label: `Net (${duration}d)`, value: formatPnl(periodNet), color: periodNet > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'ROI on Margin', value: `${roiOnMargin.toFixed(1)}%`, color: roiOnMargin > 0 ? 'text-green-400' : 'text-neutral-500' },
          { label: 'Break-even', value: breakEvenDays === Infinity ? '-' : `${breakEvenDays.toFixed(1)}d`, color: 'text-neutral-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/[0.02] rounded px-2 py-1.5">
            <div className="text-neutral-600 text-[9px]">{label}</div>
            <div className={`font-mono text-xs font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="text-neutral-700 text-[9px] mt-2">
        Margin required: {formatUSD(requiredMargin)} ({leverage}x on ${formatUSD(size)} × 2 sides)
      </div>
    </div>
  );
}
