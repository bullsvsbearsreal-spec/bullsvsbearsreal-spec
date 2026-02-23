'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { RefreshCw, Info, Activity, ArrowDownUp } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────── */

interface OrderLevel {
  price: number;
  quantity: number;
  total: number;
  cumulative: number;
}

interface Trade {
  price: number;
  quantity: number;
  quoteQty: number;
  isBuyerMaker: boolean;
  time: number;
}

interface OrderbookData {
  symbol: string;
  pair: string;
  bids: OrderLevel[];
  asks: OrderLevel[];
  trades: Trade[];
  spread: number;
  midPrice: number;
  bidDepth: number;
  askDepth: number;
  buyVolume: number;
  sellVolume: number;
  buySellRatio: number;
  timestamp: number;
  source?: string;
}

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK', 'SUI'];

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function formatQty(qty: number): string {
  if (qty >= 1_000_000) return (qty / 1_000_000).toFixed(2) + 'M';
  if (qty >= 1_000) return (qty / 1_000).toFixed(2) + 'K';
  return qty.toFixed(4);
}

function formatUsd(val: number): string {
  if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2) + 'M';
  if (val >= 1_000) return '$' + (val / 1_000).toFixed(1) + 'K';
  return '$' + val.toFixed(0);
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function OrderflowPage() {
  const [symbol, setSymbol] = useState('BTC');
  const [data, setData] = useState<OrderbookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/orderbook?symbol=${symbol}&limit=25`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetchData();
    intervalRef.current = setInterval(fetchData, 5000); // 5s refresh
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const maxCumulative = data
    ? Math.max(
        data.bids.length > 0 ? data.bids[data.bids.length - 1].cumulative : 0,
        data.asks.length > 0 ? data.asks[data.asks.length - 1].cumulative : 0,
      )
    : 0;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-hub-yellow" />
            </div>
            <div>
              <h1 className="heading-page">Order Flow</h1>
              <p className="text-neutral-500 text-sm mt-0.5">
                Real-time order book depth and trade flow for {symbol}USDT
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading && !data}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading && !data ? 'animate-spin' : ''}`} />
            </button>
            <UpdatedAgo date={lastUpdate} />
          </div>
        </div>

        {/* Symbol selector */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                symbol === s
                  ? 'bg-hub-yellow text-black'
                  : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
            <span className="ml-3 text-neutral-400">Loading order book...</span>
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-xs text-neutral-500">Mid Price</p>
                <p className="text-lg font-bold text-white font-mono">{formatPrice(data.midPrice)}</p>
              </div>
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-xs text-neutral-500">Spread</p>
                <p className="text-lg font-bold text-white font-mono">{formatPrice(data.spread)}</p>
                <p className="text-xs text-neutral-500">
                  {data.midPrice > 0 ? ((data.spread / data.midPrice) * 100).toFixed(4) : '0'}%
                </p>
              </div>
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-xs text-neutral-500">Bid Depth</p>
                <p className="text-lg font-bold text-green-400 font-mono">{formatUsd(data.bidDepth)}</p>
              </div>
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-xs text-neutral-500">Ask Depth</p>
                <p className="text-lg font-bold text-red-400 font-mono">{formatUsd(data.askDepth)}</p>
              </div>
            </div>

            {/* Buy/Sell ratio bar */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4 text-hub-yellow" />
                  <span className="text-sm font-semibold text-white">Buy / Sell Pressure</span>
                </div>
                <span className="text-xs text-neutral-500">Recent trades</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-green-400 w-16 text-right">
                  {(data.buySellRatio * 100).toFixed(1)}%
                </span>
                <div className="flex-1 h-4 rounded-full overflow-hidden bg-red-500/30 flex">
                  <div
                    className="h-full bg-green-500/80 transition-all duration-500"
                    style={{ width: `${data.buySellRatio * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-red-400 w-16">
                  {((1 - data.buySellRatio) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-neutral-500">Buy: {formatUsd(data.buyVolume)}</span>
                <span className="text-xs text-neutral-500">Sell: {formatUsd(data.sellVolume)}</span>
              </div>
            </div>

            {/* Depth Delta Visualization */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4 text-cyan-400" />
                  <div>
                    <h2 className="text-sm font-semibold text-white">Depth Delta</h2>
                    <p className="text-xs text-neutral-600 mt-0.5">Bid vs ask liquidity at each price level</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500/50" /> Bid depth</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500/50" /> Ask depth</div>
                </div>
              </div>
              <svg viewBox="0 0 900 180" className="w-full" preserveAspectRatio="xMidYMid meet">
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map((pct) => (
                  <line key={pct} x1={0} y1={180 * (1 - pct)} x2={900} y2={180 * (1 - pct)}
                    stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
                ))}
                {/* Mid price line */}
                <line x1={450} y1={0} x2={450} y2={180} stroke="#eab308" strokeWidth={1} strokeDasharray="4,4" opacity={0.4} />
                <text x={450} y={10} textAnchor="middle" fontSize="8" fill="#eab308" fontWeight="bold">MID</text>
                {/* Bid bars (left side, going outward from center) */}
                {data.bids.slice(0, 25).map((bid, i) => {
                  const barH = maxCumulative > 0 ? (bid.quantity * data.midPrice / maxCumulative) * 180 * 5 : 0;
                  const clamped = Math.min(barH, 170);
                  const barW = 16;
                  const x = 440 - (i + 1) * barW;
                  return (
                    <rect key={`b${i}`} x={x} y={180 - clamped} width={barW - 1} height={clamped}
                      fill="rgba(34,197,94,0.35)" rx={1} />
                  );
                })}
                {/* Ask bars (right side, going outward from center) */}
                {data.asks.slice(0, 25).map((ask, i) => {
                  const barH = maxCumulative > 0 ? (ask.quantity * data.midPrice / maxCumulative) * 180 * 5 : 0;
                  const clamped = Math.min(barH, 170);
                  const barW = 16;
                  const x = 460 + i * barW;
                  return (
                    <rect key={`a${i}`} x={x} y={180 - clamped} width={barW - 1} height={clamped}
                      fill="rgba(239,68,68,0.35)" rx={1} />
                  );
                })}
              </svg>
              {/* Imbalance indicator */}
              {(() => {
                const totalBid = data.bidDepth;
                const totalAsk = data.askDepth;
                const delta = totalBid - totalAsk;
                const imbalance = totalBid + totalAsk > 0 ? (delta / (totalBid + totalAsk)) * 100 : 0;
                return (
                  <div className="flex items-center justify-between mt-2 px-2">
                    <span className="text-[10px] text-neutral-500">
                      Bid-Ask Delta: <span className={`font-bold ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {delta >= 0 ? '+' : ''}{formatUsd(delta)}
                      </span>
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Imbalance: <span className={`font-bold ${imbalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {imbalance >= 0 ? '+' : ''}{imbalance.toFixed(1)}%
                      </span>
                      {Math.abs(imbalance) > 20 && (
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          imbalance > 20 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {imbalance > 20 ? 'BID HEAVY' : 'ASK HEAVY'}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Order book depth + Trade tape */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Order book */}
              <div className="lg:col-span-2 bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/[0.06]">
                  <h2 className="text-sm font-semibold text-white">Order Book Depth</h2>
                  <p className="text-xs text-neutral-600 mt-0.5">Top 25 levels{data?.source ? ` from ${data.source}` : ''}</p>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-2 gap-0">
                  <div className="px-4 py-1.5 border-b border-r border-white/[0.06] flex justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-green-400/60 font-semibold">Bids</span>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold">Price</span>
                  </div>
                  <div className="px-4 py-1.5 border-b border-white/[0.06] flex justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold">Price</span>
                    <span className="text-[10px] uppercase tracking-wider text-red-400/60 font-semibold">Asks</span>
                  </div>
                </div>

                {/* Order book rows */}
                <div className="grid grid-cols-2 gap-0 max-h-[500px] overflow-y-auto">
                  {/* Bids (descending price = best bid at top) */}
                  <div className="border-r border-white/[0.06]">
                    {data.bids.map((bid, i) => {
                      const pct = maxCumulative > 0 ? (bid.cumulative / maxCumulative) * 100 : 0;
                      return (
                        <div
                          key={i}
                          className="relative flex items-center justify-between px-4 py-[5px] hover:bg-white/[0.02] transition-colors"
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-green-500/10 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                          <span className="relative text-xs text-neutral-400 font-mono">{formatQty(bid.quantity)}</span>
                          <span className="relative text-xs text-green-400 font-mono font-medium">{formatPrice(bid.price)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Asks (ascending price = best ask at top) */}
                  <div>
                    {data.asks.map((ask, i) => {
                      const pct = maxCumulative > 0 ? (ask.cumulative / maxCumulative) * 100 : 0;
                      return (
                        <div
                          key={i}
                          className="relative flex items-center justify-between px-4 py-[5px] hover:bg-white/[0.02] transition-colors"
                        >
                          <div
                            className="absolute inset-y-0 right-0 bg-red-500/10 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                          <span className="relative text-xs text-red-400 font-mono font-medium">{formatPrice(ask.price)}</span>
                          <span className="relative text-xs text-neutral-400 font-mono">{formatQty(ask.quantity)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Trade tape */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/[0.06]">
                  <h2 className="text-sm font-semibold text-white">Recent Trades</h2>
                  <p className="text-xs text-neutral-600 mt-0.5">Last 30 trades</p>
                </div>
                <div className="overflow-y-auto max-h-[500px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 text-left">Price</th>
                        <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Size</th>
                        <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trades.map((trade, i) => {
                        const isBuy = !trade.isBuyerMaker;
                        const d = new Date(trade.time);
                        const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        return (
                          <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className={`px-3 py-[5px] text-xs font-mono font-medium ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                              {formatPrice(trade.price)}
                            </td>
                            <td className="px-3 py-[5px] text-xs font-mono text-neutral-400 text-right">
                              {formatQty(trade.quantity)}
                            </td>
                            <td className="px-3 py-[5px] text-xs text-neutral-600 text-right">
                              {timeStr}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Info footer */}
            <div className="bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
                <div className="text-xs text-neutral-400 space-y-1">
                  <p>
                    <strong className="text-neutral-300">Order Flow</strong> shows real-time order book
                    depth and trade flow{data?.source ? ` from ${data.source}` : ''}. Data refreshes every 5 seconds.
                  </p>
                  <p>
                    <strong>Bid Depth</strong> is the total USD value of buy orders.{' '}
                    <strong>Ask Depth</strong> is the total USD value of sell orders.
                    The buy/sell ratio is calculated from recent trades.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
