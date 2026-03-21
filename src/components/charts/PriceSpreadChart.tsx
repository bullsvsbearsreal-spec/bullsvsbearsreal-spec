'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import { formatPrice } from '@/lib/utils/format';

interface Ticker {
  exchange: string;
  lastPrice: number;
  volume24h: number;
}

interface Props {
  tickers: Ticker[];
  symbol: string;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function PriceSpreadChart({ tickers, symbol }: Props) {
  const { data, med, high, low, spreadBps } = useMemo(() => {
    const prices = tickers.map((t) => t.lastPrice).filter((p) => p > 0);
    if (prices.length < 2) return { data: [], med: 0, high: null, low: null, spreadBps: 0 };

    const med = median(prices);
    const sorted = [...tickers]
      .filter((t) => t.lastPrice > 0)
      .map((t) => ({
        exchange: t.exchange,
        price: t.lastPrice,
        deviation: ((t.lastPrice - med) / med) * 10000, // bps
      }))
      .sort((a, b) => b.deviation - a.deviation);

    const high = sorted[0];
    const low = sorted[sorted.length - 1];
    const spreadBps = high && low ? high.deviation - low.deviation : 0;

    return { data: sorted, med, high, low, spreadBps };
  }, [tickers]);

  if (data.length < 2) return null;

  const chartHeight = Math.max(200, data.length * 26);

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-white">Price Spread</h2>
        <span className="text-[11px] text-neutral-500">
          {data.length} exchanges &middot; Median {formatPrice(med)}
        </span>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-4 mb-3 text-[11px]">
        <span className="text-neutral-400">
          Spread: <span className="text-white font-mono">{spreadBps.toFixed(1)} bps</span>
        </span>
        {high && (
          <span className="text-neutral-400">
            High: <span className="text-green-400 font-mono">{formatPrice(high.price)}</span>{' '}
            <span className="text-neutral-500">({high.exchange})</span>
          </span>
        )}
        {low && (
          <span className="text-neutral-400">
            Low: <span className="text-red-400 font-mono">{formatPrice(low.price)}</span>{' '}
            <span className="text-neutral-500">({low.exchange})</span>
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: '#737373' }}
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="exchange"
            tick={{ fontSize: 11, fill: '#a3a3a3' }}
            width={90}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, _name: string, entry: any) => {
              const price = entry.payload?.price;
              const sign = value > 0 ? '+' : '';
              const color = value >= 0 ? '#22c55e' : '#ef4444';
              return [
                <span key="v" style={{ color, fontFamily: 'monospace' }}>{sign}{value.toFixed(2)} bps</span>,
                <span key="l" style={{ color: '#9ca3af', fontSize: 10 }}>{formatPrice(price)}</span>,
              ];
            }}
            labelStyle={{ color: '#eab308', fontWeight: 600 }}
            separator=""
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          <Bar dataKey="deviation" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.deviation >= 0 ? '#22c55e' : '#ef4444'}
                fillOpacity={0.7 + Math.min(Math.abs(entry.deviation) / spreadBps, 1) * 0.3}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
