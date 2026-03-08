'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface FGEntry {
  value: number;
  classification: string;
  timestamp: number;
}

function getColor(value: number): string {
  if (value <= 25) return '#ef4444';  // Extreme Fear — red
  if (value <= 45) return '#f97316';  // Fear — orange
  if (value <= 55) return '#eab308';  // Neutral — yellow
  if (value <= 75) return '#84cc16';  // Greed — lime
  return '#22c55e';                    // Extreme Greed — green
}

export default function FearGreedChartWidget({ wide }: { wide?: boolean }) {
  const [data, setData] = useState<FGEntry[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/fear-greed?history=true&limit=30');
        if (!res.ok) return;
        const json = await res.json();
        if (json.history && Array.isArray(json.history) && json.history.length > 0 && mounted) {
          // Reverse so oldest is first for chart
          setData([...json.history].reverse());
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[FearGreedChart] error:', err); }
    };
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!data) return <WidgetSkeleton variant="chart" />;

  const current = data.length > 0 ? data[data.length - 1] : null;
  const color = current ? getColor(current.value) : '#eab308';

  return (
    <div>
      {current && (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold" style={{ color }}>{current.value}</span>
          <span className="text-xs text-neutral-500">{current.classification}</span>
        </div>
      )}
      <div style={{ height: wide ? 100 : 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload;
                return p?.timestamp ? new Date(p.timestamp).toLocaleDateString() : '';
              }}
              formatter={(v: number) => [v, 'Index']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill="url(#fgGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-neutral-600">30-day history</span>
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
