'use client';

import { useMemo } from 'react';
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
      <div className="grid grid-cols-8 gap-1.5 items-end">
        {data.map((week, i) => {
          const barPct = (week.value / maxVal) * 100;
          return (
            <div key={week.label} className="group text-center">
              {/* Value label */}
              <p className="text-[10px] font-mono font-semibold text-neutral-400 mb-1 group-hover:text-white transition-colors truncate">
                {week.value >= 1e9 ? `$${(week.value / 1e9).toFixed(1)}B`
                  : week.value >= 1e6 ? `$${(week.value / 1e6).toFixed(0)}M`
                  : week.value >= 1e3 ? `$${(week.value / 1e3).toFixed(0)}K`
                  : week.value > 0 ? `$${week.value.toFixed(0)}`
                  : '--'}
              </p>
              {/* Bar */}
              <div className="h-24 flex items-end">
                <div
                  className="w-full rounded-t transition-all group-hover:opacity-90"
                  style={{
                    height: `${Math.max(barPct, week.value > 0 ? 6 : 2)}%`,
                    backgroundColor: week.value > 0 ? BAR_COLORS[i % BAR_COLORS.length] : '#262626',
                    opacity: week.value > 0 ? (week.value / maxVal) * 0.5 + 0.5 : 0.3,
                  }}
                />
              </div>
              {/* Count badge */}
              {week.count > 0 && (
                <p className="text-[9px] text-neutral-500 mt-0.5 group-hover:text-neutral-300">
                  {week.count} unlock{week.count !== 1 ? 's' : ''}
                </p>
              )}
              {/* Week label */}
              <p className="text-[9px] text-neutral-600 mt-0.5 leading-tight truncate group-hover:text-neutral-400">
                {week.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
