'use client';

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

interface TakerPoint {
  timestamp: number;
  buyVol: number;
  sellVol: number;
  buySellRatio: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatUsd(v: number): string {
  if (!isFinite(v)) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: number }) {
  if (!active || !payload?.length) return null;
  const buy = payload.find((p) => p.dataKey === 'buyVol')?.value ?? 0;
  const sell = payload.find((p) => p.dataKey === 'sellVol')?.value ?? 0;
  const ratio = payload.find((p) => p.dataKey === 'buySellRatio')?.value ?? 0;
  return (
    <div className="bg-hub-gray border border-white/[0.1] rounded-lg p-2.5 shadow-xl text-xs">
      <div className="text-neutral-500 mb-1.5">{formatTime(label ?? 0)}</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-green-400 font-mono">Buy: {formatUsd(buy)}</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-red-400 font-mono">Sell: {formatUsd(sell)}</span>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] text-neutral-400">
        Buy/Sell Ratio: <span className="font-mono text-white">{ratio.toFixed(3)}</span>
      </div>
    </div>
  );
}

export default function TakerRatioChart({
  data,
  symbolLabel,
  period,
}: {
  data: TakerPoint[];
  symbolLabel: string;
  period: string;
}) {
  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
      <div className="text-sm font-medium text-neutral-400 mb-3">
        {symbolLabel} Taker Buy/Sell Volume ({period})
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fill: '#525252', fontSize: 10 }}
            axisLine={{ stroke: '#262626' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="vol"
            orientation="left"
            tick={{ fill: '#525252', fontSize: 10 }}
            axisLine={{ stroke: '#262626' }}
            tickLine={false}
            tickFormatter={formatUsd}
          />
          <YAxis
            yAxisId="ratio"
            orientation="right"
            tick={{ fill: '#525252', fontSize: 10 }}
            axisLine={{ stroke: '#262626' }}
            tickLine={false}
            domain={[0, 'auto']}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, color: '#737373' }} iconType="circle" />
          <ReferenceLine yAxisId="ratio" y={1} stroke="#525252" strokeDasharray="3 3" />
          <Bar yAxisId="vol" dataKey="buyVol" name="Buy Volume" stackId="stack" fill="#22c55e" />
          <Bar yAxisId="vol" dataKey="sellVol" name="Sell Volume" stackId="stack" fill="#ef4444" />
          <Line
            yAxisId="ratio"
            type="monotone"
            dataKey="buySellRatio"
            name="Buy/Sell Ratio"
            stroke="#facc15"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
