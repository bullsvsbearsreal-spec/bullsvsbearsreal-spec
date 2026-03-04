'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatUSD } from '@/lib/utils/format';

const CHART_COLORS = [
  '#FFA500', '#3b82f6', '#22c55e', '#ef4444', '#a855f7',
  '#eab308', '#06b6d4', '#f97316', '#ec4899', '#14b8a6',
  '#8b5cf6', '#64748b', '#d946ef', '#84cc16', '#f43f5e',
];

function formatRate(r: number): string {
  return `${r >= 0 ? '+' : ''}${(r * 100).toFixed(4)}%`;
}

function OITooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { exchange: string; totalOI: number; symbolCount: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-hub-gray border border-white/[0.1] rounded-lg p-2.5 shadow-xl text-xs">
      <div className="font-medium text-white mb-1">{d.exchange}</div>
      <div className="text-neutral-400">Open Interest: <span className="text-white font-mono">{formatUSD(d.totalOI)}</span></div>
      <div className="text-neutral-400">Symbols: <span className="text-white font-mono">{d.symbolCount}</span></div>
    </div>
  );
}

function FundingTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { exchange: string; rate: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-hub-gray border border-white/[0.1] rounded-lg p-2.5 shadow-xl text-xs">
      <div className="font-medium text-white mb-1">{d.exchange}</div>
      <div className="text-neutral-400">Funding Rate: <span className={`font-mono ${d.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRate(d.rate)}</span></div>
    </div>
  );
}

interface OIData {
  exchange: string;
  totalOI: number;
  symbolCount: number;
}

interface FundingData {
  exchange: string;
  rate: number;
}

interface ComparisonChartsProps {
  oiChartData: OIData[];
  fundingForSymbol: FundingData[];
  selectedSymbol: string;
  onSymbolChange: (sym: string) => void;
  availableSymbols: string[];
}

export default function ComparisonCharts({ oiChartData, fundingForSymbol, selectedSymbol, onSymbolChange, availableSymbols }: ComparisonChartsProps) {
  return (
    <div className="space-y-6">
      {/* OI Bar Chart */}
      <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
        <div className="text-sm font-medium text-neutral-400 mb-3">Total Open Interest by Exchange</div>
        <ResponsiveContainer width="100%" height={Math.max(300, oiChartData.length * 36)}>
          <BarChart data={oiChartData} layout="vertical" margin={{ left: 80, right: 20 }}>
            <XAxis type="number" tickFormatter={formatUSD} tick={{ fill: '#525252', fontSize: 10 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
            <YAxis type="category" dataKey="exchange" tick={{ fill: '#a3a3a3', fontSize: 11 }} axisLine={false} tickLine={false} width={75} />
            <Tooltip content={<OITooltip />} />
            <Bar dataKey="totalOI" radius={[0, 4, 4, 0]} barSize={20}>
              {oiChartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Funding Rate per symbol */}
      <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-neutral-400">
            Funding Rate by Exchange — {selectedSymbol}
          </div>
          <select
            value={selectedSymbol}
            onChange={e => onSymbolChange(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-white"
          >
            {availableSymbols.slice(0, 50).map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ))}
          </select>
        </div>
        {fundingForSymbol.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, fundingForSymbol.length * 32)}>
            <BarChart data={fundingForSymbol} layout="vertical" margin={{ left: 80, right: 20 }}>
              <XAxis type="number" tickFormatter={v => `${(v * 100).toFixed(3)}%`} tick={{ fill: '#525252', fontSize: 10 }} axisLine={{ stroke: '#262626' }} tickLine={false} />
              <YAxis type="category" dataKey="exchange" tick={{ fill: '#a3a3a3', fontSize: 11 }} axisLine={false} tickLine={false} width={75} />
              <Tooltip content={<FundingTooltip />} />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={18}>
                {fundingForSymbol.map((d, i) => (
                  <Cell key={i} fill={d.rate >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-neutral-600 text-sm">No funding data for {selectedSymbol}</div>
        )}
      </div>
    </div>
  );
}
