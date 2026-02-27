'use client';

import { Bell, Mail, Smartphone, Send } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  data: {
    today: { total: number; email: number; push: number; telegram: number; uniqueUsers: number; uniqueSymbols: number };
    last7d: Array<{ date: string; fired: number; email: number; push: number; telegram: number }>;
    topSymbols: Array<{ symbol: string; count: number }>;
    topUsers: Array<{ userId: string; email: string; count: number }>;
    config: { usersWithAlerts: number; enabledAlerts: number; telegramAlerts: number; byMetric: Record<string, number> };
  } | null;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AlertHealthPanel({ data }: Props) {
  if (!data) return <p className="text-neutral-500 text-sm">Loading alert metrics...</p>;

  return (
    <div className="space-y-4">
      {/* Today's summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniCard icon={<Bell className="w-3.5 h-3.5" />} label="Fired Today" value={data.today.total} />
        <MiniCard icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={data.today.email} />
        <MiniCard icon={<Smartphone className="w-3.5 h-3.5" />} label="Push" value={data.today.push} />
        <MiniCard icon={<Send className="w-3.5 h-3.5" />} label="Telegram" value={data.today.telegram} />
      </div>

      <div className="flex items-center gap-4 text-[11px] text-neutral-500">
        <span>Unique users: <span className="text-white font-medium">{data.today.uniqueUsers}</span></span>
        <span>Unique symbols: <span className="text-white font-medium">{data.today.uniqueSymbols}</span></span>
      </div>

      {/* 7-day chart */}
      {data.last7d.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] p-3">
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">7-Day Alert Volume</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.last7d}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={35} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="email" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} name="Email" />
              <Bar dataKey="push" stackId="a" fill="#8b5cf6" name="Push" />
              <Bar dataKey="telegram" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Telegram" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top symbols + config */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.topSymbols.length > 0 && (
          <div className="rounded-lg border border-white/[0.06] p-3">
            <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">Top Triggered Symbols</p>
            <div className="space-y-1">
              {data.topSymbols.slice(0, 5).map(s => (
                <div key={s.symbol} className="flex items-center justify-between text-[12px]">
                  <span className="text-white font-medium">{s.symbol}</span>
                  <span className="text-neutral-400">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-white/[0.06] p-3">
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">Alert Configuration</p>
          <div className="space-y-1 text-[12px]">
            <div className="flex justify-between"><span className="text-neutral-400">Users with alerts</span><span className="text-white font-medium">{data.config.usersWithAlerts}</span></div>
            <div className="flex justify-between"><span className="text-neutral-400">Enabled alerts</span><span className="text-white font-medium">{data.config.enabledAlerts}</span></div>
            <div className="flex justify-between"><span className="text-neutral-400">Telegram alerts</span><span className="text-white font-medium">{data.config.telegramAlerts}</span></div>
            {Object.entries(data.config.byMetric).map(([metric, count]) => (
              <div key={metric} className="flex justify-between">
                <span className="text-neutral-500 pl-2">{metric}</span>
                <span className="text-neutral-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-1 text-neutral-500 text-[11px] mb-1">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold text-white">{formatNum(value)}</p>
    </div>
  );
}
