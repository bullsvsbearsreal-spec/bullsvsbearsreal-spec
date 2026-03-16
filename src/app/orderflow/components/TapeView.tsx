'use client';

import { useRef, useEffect } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

/* ─── Types ──────────────────────────────────────────────────────── */

interface Bucket {
  time: number;
  buyVol: number;
  sellVol: number;
  delta: number;
  cvd: number;
}

interface RecentTrade {
  time: number;
  price: number;
  qty: number;
  isBuy: boolean;
  usdValue: number;
}

interface AggTradesResponse {
  symbol: string;
  tradeCount: number;
  totalBuyVol: number;
  totalSellVol: number;
  netDelta: number;
  buckets: Bucket[];
  recentTrades: RecentTrade[];
  source: string;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatUSD(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimeSec(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function TapeView({ symbol }: { symbol: string }) {
  const { data, isLoading } = useApi<AggTradesResponse>({
    key: `tape-${symbol}`,
    fetcher: async () => {
      const res = await fetch(`/api/aggtrades?symbol=${symbol}&limit=500`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 5000,
  });

  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [data?.recentTrades]);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-60 text-neutral-500 text-sm">
        Loading trade data...
      </div>
    );
  }

  if (!data || !data.buckets?.length) {
    return (
      <div className="flex items-center justify-center h-60 text-neutral-500 text-sm">
        No trade data available for {symbol}
      </div>
    );
  }

  const { totalBuyVol, totalSellVol, netDelta, tradeCount, buckets, recentTrades, source } = data;
  const timeSpanMin = buckets.length > 1
    ? (buckets[buckets.length - 1].time - buckets[0].time) / 60000
    : 1;
  const tradeSpeed = Math.round(tradeCount / Math.max(timeSpanMin, 1));

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Buy Volume" value={formatUSD(totalBuyVol)} color="text-green-400" />
        <StatCard label="Sell Volume" value={formatUSD(totalSellVol)} color="text-red-400" />
        <StatCard label="Net Delta" value={`${netDelta >= 0 ? '+' : ''}${formatUSD(netDelta)}`} color={netDelta >= 0 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="Trade Speed" value={`${tradeSpeed}/min`} color="text-white" />
        <StatCard label="Source" value={source} color="text-hub-yellow" />
      </div>

      {/* Delta bars + CVD line */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-neutral-400 mb-3">Delta Bars &amp; CVD</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={buckets} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#737373' }}
              tickFormatter={formatTime}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="delta"
              tick={{ fontSize: 10, fill: '#737373' }}
              tickFormatter={(v: number) => formatUSD(v)}
              axisLine={false}
              tickLine={false}
              width={65}
            />
            <YAxis
              yAxisId="cvd"
              orientation="right"
              tick={{ fontSize: 10, fill: '#a3a3a3' }}
              tickFormatter={(v: number) => formatUSD(v)}
              axisLine={false}
              tickLine={false}
              width={65}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v: number) => formatTime(v)}
              formatter={(value: number, name: string) => [
                formatUSD(value),
                name === 'delta' ? 'Delta' : 'CVD',
              ]}
            />
            <Bar yAxisId="delta" dataKey="delta" maxBarSize={12} radius={[2, 2, 0, 0]}>
              {buckets.map((b, i) => (
                <Cell key={i} fill={b.delta >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.8} />
              ))}
            </Bar>
            <Line
              yAxisId="cvd"
              dataKey="cvd"
              type="monotone"
              stroke="#eab308"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Recent trades feed */}
      {recentTrades && recentTrades.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-neutral-400 mb-3">
            Recent Trades <span className="text-neutral-600 font-normal">({recentTrades.length})</span>
          </h3>
          <div ref={feedRef} className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-hub-darker">
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-1.5 text-neutral-500 font-medium">Time</th>
                  <th className="text-right py-1.5 text-neutral-500 font-medium">Price</th>
                  <th className="text-right py-1.5 text-neutral-500 font-medium">Size</th>
                  <th className="text-right py-1.5 text-neutral-500 font-medium">USD</th>
                  <th className="text-right py-1.5 text-neutral-500 font-medium">Side</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((t, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="py-1 text-neutral-400 font-mono">{formatTimeSec(t.time)}</td>
                    <td className="py-1 text-right text-white font-mono">{formatPrice(t.price)}</td>
                    <td className="py-1 text-right text-neutral-300 font-mono">{t.qty < 1 ? t.qty.toFixed(4) : t.qty.toFixed(2)}</td>
                    <td className="py-1 text-right text-neutral-300 font-mono">{formatUSD(t.usdValue)}</td>
                    <td className="py-1 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        t.isBuy ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {t.isBuy ? 'BUY' : 'SELL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-mono font-semibold ${color}`}>{value}</p>
    </div>
  );
}
