'use client';

import { ReactNode } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { BarChart3 } from 'lucide-react';

// ── Custom tooltip — compact, sorted, max 10 visible ──

interface ChartTooltipEntry { name: string; value: number | null; color: string }

function FundingChartTooltip({ active, payload, label, annualized }: { active?: boolean; payload?: ChartTooltipEntry[]; label?: string; annualized?: boolean }) {
  if (!active || !payload?.length) return null;

  const entries = payload
    .filter((e: ChartTooltipEntry) => e.value != null)
    .sort((a: ChartTooltipEntry, b: ChartTooltipEntry) => b.value! - a.value!);

  const visible = entries.slice(0, 10);
  const remaining = entries.length - visible.length;
  const decimals = annualized ? 2 : 4;

  return (
    <div
      className="rounded-lg px-3 py-2.5 text-xs shadow-xl max-w-[240px]"
      style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-neutral-400 font-medium">
          {label ? new Date(label).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          }) : ''}
        </p>
        {annualized && <span className="text-[9px] text-hub-yellow font-semibold bg-hub-yellow/10 px-1 rounded">APR</span>}
      </div>
      <div className="flex flex-col gap-0.5">
        {visible.map((entry: ChartTooltipEntry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <ExchangeLogo exchange={entry.name.toLowerCase()} size={12} />
              <span className="text-neutral-400 truncate text-[11px]">{entry.name}</span>
            </div>
            <span
              className="font-mono tabular-nums font-semibold text-[11px] flex-shrink-0"
              style={{ color: (entry.value ?? 0) >= 0 ? '#34D399' : '#FB7185' }}
            >
              {(entry.value ?? 0) >= 0 ? '+' : ''}{(entry.value ?? 0).toFixed(decimals)}%
            </span>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <p className="text-[10px] text-neutral-600 mt-1">+{remaining} more</p>
      )}
    </div>
  );
}

interface FundingChartsProps {
  displayChartData: Record<string, any>[];
  visibleExchanges: string[];
  showAnnualized: boolean;
  hasChartData: boolean;
  exchangeHex: Record<string, string>;
  totalExchangeCount: number;
  hasDbData: boolean;
  oiHistoryData: Array<{ t: number; oi: number }>;
  hasOiHistory: boolean;
  days: number;
  children?: ReactNode;
}

export default function FundingCharts({
  displayChartData,
  visibleExchanges,
  showAnnualized,
  hasChartData,
  exchangeHex,
  totalExchangeCount,
  hasDbData,
  oiHistoryData,
  hasOiHistory,
  days,
  children,
}: FundingChartsProps) {
  return (
    <>
      {/* Funding Rate History Chart */}
      <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden mb-8">
        <div className="p-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-semibold text-sm">Funding Rate History</h2>
            <p className="text-neutral-600 text-xs mt-0.5">
              {showAnnualized ? 'Annualized rates' : 'Per-exchange rates'} over time
              {visibleExchanges.length < totalExchangeCount && ` (${visibleExchanges.length}/${totalExchangeCount} exchanges)`}
              {!hasDbData && ' (local data — sign in for full history)'}
            </p>
          </div>
          {children}
        </div>
        <div className="p-4">
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={displayChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t: number) =>
                    new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  }
                  stroke="#525252"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    showAnnualized
                      ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
                      : `${v >= 0 ? '+' : ''}${v.toFixed(4)}%`
                  }
                  stroke="#525252"
                  tick={{ fontSize: 10 }}
                  width={70}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
                <RechartsTooltip
                  content={<FundingChartTooltip annualized={showAnnualized} />}
                  cursor={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                {visibleExchanges.map(ex => (
                  <Line
                    key={ex}
                    type="monotone"
                    dataKey={ex}
                    stroke={exchangeHex[ex] || '#737373'}
                    dot={displayChartData.length < 3}
                    strokeWidth={1.5}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-600">
              <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No funding rate data available</p>
              <p className="text-xs mt-1 text-neutral-700">
                Check that the symbol is valid and try again.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* OI History Chart */}
      {hasOiHistory && (
        <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden mb-8">
          <div className="p-4 border-b border-white/[0.06]">
            <h2 className="text-white font-semibold text-sm">Open Interest History</h2>
            <p className="text-neutral-600 text-xs mt-0.5">
              Aggregated OI across all exchanges over the last {days} days
            </p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={oiHistoryData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="oiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f5a623" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f5a623" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="t"
                  tickFormatter={(t: number) =>
                    new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  }
                  stroke="#525252"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  tickFormatter={(v: number) => {
                    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
                    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
                    return `$${v.toLocaleString()}`;
                  }}
                  stroke="#525252"
                  tick={{ fontSize: 10 }}
                  width={60}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelFormatter={(t: number) =>
                    new Date(t).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })
                  }
                  formatter={(value: number) => {
                    if (value >= 1e9) return [`$${(value / 1e9).toFixed(2)}B`, 'Open Interest'];
                    if (value >= 1e6) return [`$${(value / 1e6).toFixed(1)}M`, 'Open Interest'];
                    return [`$${value.toLocaleString()}`, 'Open Interest'];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="oi"
                  stroke="#f5a623"
                  fill="url(#oiGradient)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}
