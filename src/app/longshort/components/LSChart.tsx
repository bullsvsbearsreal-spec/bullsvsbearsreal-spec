'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface ChartPoint {
  longRatio: number;
  shortRatio: number;
  timestamp: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: number }) {
  if (!active || !payload?.length) return null;
  const long = payload.find((p) => p.dataKey === 'longRatio')?.value ?? 0;
  const short = payload.find((p) => p.dataKey === 'shortRatio')?.value ?? 0;
  return (
    <div className="bg-hub-gray border border-white/[0.1] rounded-lg p-2.5 shadow-xl text-xs">
      <div className="text-neutral-500 mb-1.5">{formatTime(label ?? 0)}</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-green-400 font-mono">{long.toFixed(2)}% Long</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-red-400 font-mono">{short.toFixed(2)}% Short</span>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] text-neutral-500">
        L/S Ratio: {short > 0 ? (long / short).toFixed(3) : 'N/A'}
      </div>
    </div>
  );
}

export default function LSChart({ chartData, symbolLabel, period }: { chartData: ChartPoint[]; symbolLabel: string; period: string }) {
  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
      <div className="text-sm font-medium text-neutral-400 mb-3">
        {symbolLabel}/USDT Long/Short Ratio History ({period})
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="longGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="shortGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fill: '#525252', fontSize: 10 }}
            axisLine={{ stroke: '#262626' }}
            tickLine={false}
          />
          <YAxis
            domain={['dataMin - 2', 'dataMax + 2']}
            tick={{ fill: '#525252', fontSize: 10 }}
            axisLine={{ stroke: '#262626' }}
            tickLine={false}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke="#525252" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="longRatio"
            stroke="#22c55e"
            fill="url(#longGrad)"
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
          <Area
            type="monotone"
            dataKey="shortRatio"
            stroke="#ef4444"
            fill="url(#shortGrad)"
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
