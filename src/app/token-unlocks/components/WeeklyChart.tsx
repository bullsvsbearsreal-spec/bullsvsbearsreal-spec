'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TokenUnlock, formatUnlockValue } from '@/lib/api/tokenunlocks';

const BAR_COLORS = ['#facc15', '#f59e0b', '#eab308', '#d97706', '#ca8a04', '#b45309', '#a16207', '#92400e'];

export default function WeeklyChart({ unlocks }: { unlocks: TokenUnlock[] }) {
  const data = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; value: number; count: number }[] = [];
    for (let w = 0; w < 8; w++) {
      const start = new Date(now);
      start.setDate(start.getDate() + w * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const weekUnlocks = unlocks.filter(u => {
        const d = new Date(u.unlockDate);
        return d >= start && d < end;
      });
      const label = w === 0 ? 'This Week' : w === 1 ? 'Next Week' : `Week ${w + 1}`;
      weeks.push({
        label,
        value: weekUnlocks.reduce((s, u) => s + u.unlockValue, 0),
        count: weekUnlocks.length,
      });
    }
    return weeks;
  }, [unlocks]);

  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Upcoming Unlock Value by Week</h3>
        <span className="text-[10px] text-neutral-600">Next 8 weeks</span>
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <XAxis
              dataKey="label"
              tick={{ fill: '#737373', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#525252', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => {
                if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
                if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
                if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
                return `$${v}`;
              }}
              width={60}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}
              formatter={(value: number, _name: string, props: { payload?: { count: number } }) => [
                `${formatUnlockValue(value)} (${props.payload?.count ?? 0} unlocks)`,
                'Value',
              ]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.value > 0 ? BAR_COLORS[i % BAR_COLORS.length] : '#262626'} fillOpacity={entry.value / maxVal * 0.6 + 0.4} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
