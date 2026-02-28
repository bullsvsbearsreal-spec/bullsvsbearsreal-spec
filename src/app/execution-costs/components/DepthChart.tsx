'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import { VenueCost } from '@/lib/execution-costs/types';
import { formatUSD } from '@/lib/utils/format';

interface Props { venues: VenueCost[]; orderSizeUsd: number; }

// Cap depth at $1B — anything higher is virtual (vAMM) liquidity
const MAX_DEPTH_DISPLAY = 1_000_000_000;

export default function DepthChart({ venues, orderSizeUsd }: Props) {
  const available = venues.filter(v => v.available && v.maxFillableSize > 0 && v.maxFillableSize !== Infinity);
  if (available.length === 0) {
    return <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-neutral-600 text-sm">No depth data available for chart</div>;
  }

  const chartData = available
    .sort((a, b) => b.maxFillableSize - a.maxFillableSize)
    .map(v => ({
      exchange: v.exchange,
      depth: Math.min(v.maxFillableSize, MAX_DEPTH_DISPLAY),
      capped: v.maxFillableSize > MAX_DEPTH_DISPLAY,
    }));

  const fmtUsd = (v: number) => formatUSD(v, 1);

  const COLORS = ['#22D3EE', '#06B6D4', '#0891B2', '#0E7490', '#155E75', '#164E63', '#134E4A', '#115E59'];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Available Depth by Venue</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="exchange" tick={{ fill: '#737373', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
          <YAxis tickFormatter={fmtUsd} tick={{ fill: '#737373', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} width={60} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: number, _: string, entry: any) => [
              entry.payload.capped ? `${fmtUsd(value)}+ (vAMM)` : fmtUsd(value),
              'Depth',
            ]}
          />
          <ReferenceLine y={orderSizeUsd} stroke="#FACC15" strokeDasharray="5 5" label={{ value: `Order: ${fmtUsd(orderSizeUsd)}`, fill: '#FACC15', fontSize: 10 }} />
          <Bar dataKey="depth" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={entry.exchange} fill={COLORS[index % COLORS.length]} fillOpacity={entry.capped ? 0.5 : 0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
