'use client';

import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface OIPoint {
  t: number;
  oi: number;
  vol?: number | null;
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
  const oi = payload.find((p) => p.dataKey === 'oi')?.value;
  const vol = payload.find((p) => p.dataKey === 'vol')?.value;
  return (
    <div className="bg-hub-gray border border-white/[0.1] rounded-lg p-2.5 shadow-xl text-xs">
      <div className="text-neutral-500 mb-1.5">{formatTime(label ?? 0)}</div>
      {oi != null && (
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-hub-yellow" />
          <span className="text-hub-yellow font-mono">OI: {formatUsd(oi)}</span>
        </div>
      )}
      {vol != null && vol > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-blue-400 font-mono">Vol: {formatUsd(vol)}</span>
        </div>
      )}
    </div>
  );
}

export default function OIHistoryChart({
  data,
  symbolLabel,
  period,
  source,
}: {
  data: OIPoint[];
  symbolLabel: string;
  period: string;
  source: string;
}) {
  const hasVol = data.some((p) => p.vol != null && p.vol > 0);
  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-neutral-400">
          {symbolLabel} Open Interest {hasVol ? '& Volume' : ''} ({period})
        </div>
        <div className="text-[10px] text-neutral-600 uppercase tracking-wide">
          Source: {source}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="oiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#facc15" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#facc15" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            tickFormatter={formatTime}
            tick={{ fill: '#525252', fontSize: 10 }}
            axisLine={{ stroke: '#262626' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="oi"
            orientation="left"
            tick={{ fill: '#525252', fontSize: 10 }}
            axisLine={{ stroke: '#262626' }}
            tickLine={false}
            tickFormatter={formatUsd}
            domain={['auto', 'auto']}
          />
          {hasVol && (
            <YAxis
              yAxisId="vol"
              orientation="right"
              tick={{ fill: '#525252', fontSize: 10 }}
              axisLine={{ stroke: '#262626' }}
              tickLine={false}
              tickFormatter={formatUsd}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#737373' }}
            iconType="circle"
          />
          {hasVol && (
            <Bar yAxisId="vol" dataKey="vol" fill="#3b82f680" name="Volume" />
          )}
          <Area
            yAxisId="oi"
            type="monotone"
            dataKey="oi"
            name="Open Interest"
            stroke="#facc15"
            fill="url(#oiGrad)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
