'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell, LabelList } from 'recharts';
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
      label: v.maxFillableSize > MAX_DEPTH_DISPLAY
        ? formatUSD(v.maxFillableSize, 1) + '+'
        : formatUSD(v.maxFillableSize, 1),
      method: v.method,
      canFill: v.maxFillableSize >= orderSizeUsd,
      fillPct: Math.min((v.maxFillableSize / orderSizeUsd) * 100, 100),
    }));

  const fmtUsd = (v: number) => formatUSD(v, 1);

  // Amber/yellow gradient matching hub theme
  const COLORS = ['#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F', '#713F12', '#854D0E', '#A16207'];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Available Depth by Venue</h3>
        <span className="text-[10px] text-neutral-500">Order size: <span className="text-hub-yellow font-mono">{fmtUsd(orderSizeUsd)}</span></span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 10 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="exchange" tick={{ fill: '#a3a3a3', fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
          <YAxis tickFormatter={fmtUsd} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, padding: '8px 12px' }}
            labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number, _: string, entry: any) => {
              const p = entry.payload;
              const depthStr = p.capped ? `${fmtUsd(value)}+ (vAMM)` : fmtUsd(value);
              const fillStr = p.canFill
                ? '✓ Can fill your order'
                : `${p.fillPct.toFixed(0)}% of your order`;
              return [
                <span key="d" style={{ fontFamily: 'monospace' }}>
                  {depthStr}
                  <br />
                  <span style={{ color: p.canFill ? '#22c55e' : '#f59e0b', fontSize: 10 }}>{fillStr}</span>
                  <br />
                  <span style={{ color: '#737373', fontSize: 9 }}>Method: {p.method?.toUpperCase()}</span>
                </span>,
                'Available depth',
              ];
            }}
            separator=": "
          />
          <ReferenceLine
            y={orderSizeUsd}
            stroke="#FACC15"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{ value: `Your order`, fill: '#FACC15', fontSize: 9, position: 'insideTopRight' }}
          />
          <Bar dataKey="depth" radius={[6, 6, 0, 0]} maxBarSize={80}>
            <LabelList dataKey="label" position="top" fill="#a3a3a3" fontSize={9} fontFamily="monospace" />
            {chartData.map((entry, index) => (
              <Cell key={entry.exchange} fill={COLORS[index % COLORS.length]} fillOpacity={entry.capped ? 0.5 : 0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
