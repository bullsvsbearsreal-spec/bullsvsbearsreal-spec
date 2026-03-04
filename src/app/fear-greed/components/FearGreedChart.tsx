'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartDataPoint {
  date: string;
  value: number;
  fullDate: string;
  classification: string;
}

function getClassification(value: number): { label: string; color: string } {
  if (value <= 25) return { label: 'Extreme Fear', color: '#ef4444' };
  if (value <= 50) return { label: 'Fear', color: '#f97316' };
  if (value <= 75) return { label: 'Greed', color: '#4ade80' };
  return { label: 'Extreme Greed', color: '#22c55e' };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const cls = getClassification(data.value);

  return (
    <div className="bg-hub-gray border border-white/[0.12] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-neutral-500 text-xs">{data.fullDate}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-lg font-bold text-white">{data.value}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: cls.color, backgroundColor: `${cls.color}20` }}>
          {cls.label}
        </span>
      </div>
    </div>
  );
}

export default function FearGreedChart({ chartData }: { chartData: ChartDataPoint[] }) {
  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-600">
        <p>No historical data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="fearGreedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="50%" stopColor="#22c55e" stopOpacity={0.05} />
            <stop offset="50%" stopColor="#ef4444" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="fearGreedStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          stroke="#404040"
          tick={{ fill: '#737373', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          domain={[0, 100]}
          stroke="#404040"
          tick={{ fill: '#737373', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          ticks={[0, 25, 50, 75, 100]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="url(#fearGreedStroke)"
          strokeWidth={2}
          fill="url(#fearGreedGradient)"
          dot={false}
          activeDot={{ r: 5, fill: '#fff', stroke: '#FFA500', strokeWidth: 2 }}
          isAnimationActive={true}
          animationDuration={500}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
