'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const PIE_COLORS = [
  '#FFA500', '#3b82f6', '#22c55e', '#ef4444', '#a855f7',
  '#eab308', '#06b6d4', '#f97316', '#ec4899', '#14b8a6',
  '#8b5cf6', '#64748b', '#d946ef', '#84cc16', '#f43f5e',
];

interface PieDataItem {
  name: string;
  value: number;
  pct: number;
}

export default function AllocationPieChart({ pieData }: { pieData: PieDataItem[] }) {
  if (pieData.length === 0) {
    return (
      <div className="h-60 flex items-center justify-center text-neutral-600 text-sm">
        No data
      </div>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as PieDataItem;
              return (
                <div className="bg-hub-darker border border-white/[0.08] rounded-lg px-3 py-2 text-xs shadow-xl">
                  <span className="font-semibold">{d.name}</span>
                  <span className="text-neutral-400 ml-2 font-mono">
                    {d.pct.toFixed(1)}%
                  </span>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {pieData.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="text-neutral-400">{d.name}</span>
            <span className="text-neutral-600 font-mono">{d.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}
