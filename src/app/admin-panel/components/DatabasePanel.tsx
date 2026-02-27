'use client';

import { Database, TrendingUp, HardDrive } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  data: {
    currentSize: string;
    currentSizeBytes: number;
    tables: Array<{ name: string; rowCount: number; sizeBytes: number; sizePretty: string }>;
    growthRate: { fundingPerDay: number; oiPerDay: number; liqPerDay: number };
    sizeHistory: Array<{ date: string; sizeBytes: number }>;
  } | null;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function DatabasePanel({ data }: Props) {
  if (!data) return <p className="text-neutral-500 text-sm">Loading database metrics...</p>;

  const chartData = [...data.sizeHistory].reverse().map(h => ({
    date: h.date,
    sizeMB: Math.round(h.sizeBytes / 1e6),
  }));

  return (
    <div className="space-y-4">
      {/* Size + growth cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1 text-neutral-500 text-[11px] mb-1">
            <Database className="w-3.5 h-3.5" />
            DB Size
          </div>
          <p className="text-lg font-bold text-white">{data.currentSize}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1 text-neutral-500 text-[11px] mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Funding/day
          </div>
          <p className="text-lg font-bold text-white">{formatNum(data.growthRate.fundingPerDay)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1 text-neutral-500 text-[11px] mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            OI/day
          </div>
          <p className="text-lg font-bold text-white">{formatNum(data.growthRate.oiPerDay)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1 text-neutral-500 text-[11px] mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Liq/day
          </div>
          <p className="text-lg font-bold text-white">{formatNum(data.growthRate.liqPerDay)}</p>
        </div>
      </div>

      {/* Size history chart */}
      {chartData.length > 1 && (
        <div className="rounded-lg border border-white/[0.06] p-3">
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">DB Size History (MB)</p>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={40} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(v: number) => [`${v} MB`, 'Size']}
              />
              <Area type="monotone" dataKey="sizeMB" stroke="#f59e0b" fill="rgba(245,158,11,0.1)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table sizes */}
      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Table Sizes</span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-neutral-500 text-left border-b border-white/[0.06]">
              <th className="px-3 py-2 font-medium">Table</th>
              <th className="px-3 py-2 font-medium text-right">Rows</th>
              <th className="px-3 py-2 font-medium text-right">Size</th>
            </tr>
          </thead>
          <tbody>
            {data.tables.map(t => (
              <tr key={t.name} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-neutral-600" />
                    <span className="text-white">{t.name}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right text-neutral-400 tabular-nums">{formatNum(t.rowCount)}</td>
                <td className="px-3 py-1.5 text-right text-neutral-400 tabular-nums">{t.sizePretty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
