'use client';

import { useState, useRef, useEffect } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import { useRealtimeTrades, type RealtimeTrade } from '@/hooks/useRealtimeTrades';
import { Wifi, WifiOff } from 'lucide-react';
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
  if (price >= 1000) return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return '$' + price.toFixed(4);
  return '$' + price.toFixed(6);
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function TapeView({ symbol }: { symbol: string }) {
  const [liveMode, setLiveMode] = useState(false);

  // REST polling mode (default)
  const { data, isLoading } = useApi<AggTradesResponse>({
    key: `tape-${symbol}`,
    fetcher: async () => {
      const res = await fetch(`/api/aggtrades?symbol=${symbol}&limit=500`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 5000,
    enabled: !liveMode,
  });

  // WebSocket real-time mode
  const rt = useRealtimeTrades(liveMode ? symbol : '');

  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [liveMode ? rt.trades : data?.recentTrades]);

  // Derive display data from either mode
  const isLiveLoading = liveMode && !rt.connected && rt.trades.length === 0;
  const isRestLoading = !liveMode && isLoading && !data;

  if (isLiveLoading || isRestLoading) {
    return (
      <div className="flex items-center justify-center h-60 text-neutral-500 text-sm">
        {liveMode ? 'Connecting to Binance WebSocket...' : 'Loading trade data...'}
      </div>
    );
  }

  if (!liveMode && (!data || !data.buckets?.length)) {
    return (
      <div className="space-y-4">
        <LiveToggle liveMode={liveMode} setLiveMode={setLiveMode} connected={rt.connected} />
        <div className="flex items-center justify-center h-60 text-neutral-500 text-sm">
          No trade data available for {symbol}
        </div>
      </div>
    );
  }

  // Stats
  const totalBuyVol = liveMode ? rt.stats.buyVolume : data!.totalBuyVol;
  const totalSellVol = liveMode ? rt.stats.sellVolume : data!.totalSellVol;
  const netDelta = liveMode ? rt.stats.netDelta : data!.netDelta;
  const tradeCount = liveMode ? rt.stats.tradeCount : data!.tradeCount;
  const tradeSpeed = liveMode ? rt.stats.tradeSpeed : (() => {
    const buckets = data!.buckets;
    const spanMin = buckets.length > 1 ? (buckets[buckets.length - 1].time - buckets[0].time) / 60000 : 1;
    return Math.round(data!.tradeCount / Math.max(spanMin, 1));
  })();
  const source = liveMode ? `Binance WS${rt.connected ? '' : ' (reconnecting...)'}` : data!.source;
  const buckets = liveMode ? [] : data!.buckets;
  const recentTrades: RecentTrade[] = liveMode
    ? rt.trades.map((t: RealtimeTrade) => ({ time: t.time, price: t.price, qty: t.qty, isBuy: t.isBuy, usdValue: t.quoteQty }))
    : data!.recentTrades;

  return (
    <div className="space-y-4">
      {/* Live toggle + Stats row */}
      <LiveToggle liveMode={liveMode} setLiveMode={setLiveMode} connected={rt.connected} />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Buy Volume" value={formatUSD(totalBuyVol)} color="text-green-400" />
        <StatCard label="Sell Volume" value={formatUSD(totalSellVol)} color="text-red-400" />
        <StatCard label="Net Delta" value={`${netDelta >= 0 ? '+' : ''}${formatUSD(netDelta)}`} color={netDelta >= 0 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="Trade Speed" value={`${tradeSpeed}/min`} color="text-white" />
        <StatCard label="Source" value={source} color="text-hub-yellow" />
      </div>
      {liveMode && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Big Buys (>$50K)" value={String(rt.stats.bigBuys)} color="text-green-400" />
          <StatCard label="Big Sells (>$50K)" value={String(rt.stats.bigSells)} color="text-red-400" />
        </div>
      )}

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

function LiveToggle({
  liveMode, setLiveMode, connected,
}: { liveMode: boolean; setLiveMode: (v: boolean) => void; connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLiveMode(!liveMode)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          liveMode
            ? 'bg-green-500/15 text-green-400 border border-green-500/20'
            : 'bg-white/[0.04] text-neutral-400 hover:text-white border border-white/[0.06]'
        }`}
      >
        {liveMode ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {liveMode ? 'Live' : 'Polling'}
      </button>
      {liveMode && (
        <span className="flex items-center gap-1 text-[10px] text-neutral-500">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          {connected ? 'Connected' : 'Connecting...'}
        </span>
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
