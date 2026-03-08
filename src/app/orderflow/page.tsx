'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { useApi } from '@/hooks/useSWRApi';
import {
  RefreshCw, Info, Activity, ArrowDownUp, AlertTriangle, BarChart3, Table2, BookOpen,
} from 'lucide-react';
import MultiDepthChart from './components/MultiDepthChart';
import ExchangeDepthTable from './components/ExchangeDepthTable';

/* ─── Types ──────────────────────────────────────────────────────── */

interface DepthPoint {
  exchange: string;
  priceOffset: number;
  cumulativeUsd: number;
}

interface MultiVenue {
  exchange: string;
  available: boolean;
  midPrice: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  slippage: Record<number, { bid: number; ask: number }>;
  bidCurve?: DepthPoint[];
  askCurve?: DepthPoint[];
  error?: string;
}

interface MultiOrderbookResponse {
  symbol: string;
  timestamp: number;
  depthSizes: number[];
  venues: MultiVenue[];
}

// Single-exchange types (for Order Book tab)
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

type ViewTab = 'depth' | 'comparison' | 'orderbook';

const VIEW_TABS: { key: ViewTab; label: string; icon: React.ReactNode }[] = [
  { key: 'depth', label: 'Depth Chart', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: 'comparison', label: 'Exchange Comparison', icon: <Table2 className="w-3.5 h-3.5" /> },
  { key: 'orderbook', label: 'Order Book', icon: <BookOpen className="w-3.5 h-3.5" /> },
];

const SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK', 'SUI',
  'NEAR', 'APT', 'ARB', 'OP', 'PEPE',
];

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
  if (val >= 1_000_000_000) return '$' + (val / 1_000_000_000).toFixed(2) + 'B';
  if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2) + 'M';
  if (val >= 1_000) return '$' + (val / 1_000).toFixed(1) + 'K';
  return '$' + val.toFixed(0);
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function OrderflowPage() {
  const [symbol, setSymbol] = useState('BTC');
  const [activeTab, setActiveTab] = useState<ViewTab>('depth');

  // Multi-exchange depth data (for Depth Chart + Exchange Comparison tabs)
  const { data: multiData, isLoading: multiLoading, lastUpdate: multiLastUpdate, refresh: multiRefresh } = useApi<MultiOrderbookResponse>({
    key: `orderflow-multi-${symbol}`,
    fetcher: async () => {
      const res = await fetch(`/api/orderbook/multi?symbol=${symbol}&depth=true`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 5000,
    enabled: activeTab !== 'orderbook',
  });

  // Single-exchange orderbook (for Order Book tab)
  const [obData, setObData] = useState<OrderbookData | null>(null);
  const [obLoading, setObLoading] = useState(false);
  const obIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrderbook = useCallback(async () => {
    try {
      const res = await fetch(`/api/orderbook?symbol=${symbol}&limit=25`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setObData(json);
    } catch (err) {
      console.error('[OrderFlow] orderbook fetch error:', err);
    } finally {
      setObLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (activeTab === 'orderbook') {
      setObLoading(true);
      setObData(null);
      fetchOrderbook();
      obIntervalRef.current = setInterval(fetchOrderbook, 5000);
    }
    return () => { if (obIntervalRef.current) clearInterval(obIntervalRef.current); };
  }, [activeTab, fetchOrderbook]);

  // Multi-exchange summary
  const multiSummary = multiData ? (() => {
    const available = multiData.venues.filter(v => v.available);
    const totalBid = available.reduce((s, v) => s + v.bidDepthUsd, 0);
    const totalAsk = available.reduce((s, v) => s + v.askDepthUsd, 0);
    const prices = available.filter(v => v.midPrice > 0).map(v => v.midPrice);
    const avgMid = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const ratio = totalBid + totalAsk > 0 ? totalBid / (totalBid + totalAsk) : 0.5;
    return { totalBid, totalAsk, avgMid, ratio, exchangeCount: available.length };
  })() : null;

  const obMaxCum = obData
    ? Math.max(
        obData.bids.length > 0 ? obData.bids[obData.bids.length - 1].cumulative : 0,
        obData.asks.length > 0 ? obData.asks[obData.asks.length - 1].cumulative : 0,
      )
    : 0;

  const isLoading = activeTab === 'orderbook' ? obLoading : multiLoading;
  const lastUpdate = activeTab === 'orderbook' ? null : multiLastUpdate;

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
              <h1 className="heading-page">Order Flow & Depth</h1>
              <p className="text-neutral-500 text-sm mt-0.5">
                Multi-exchange orderbook depth for {symbol}USDT
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => activeTab === 'orderbook' ? fetchOrderbook() : multiRefresh()}
              disabled={isLoading}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {lastUpdate && <UpdatedAgo date={lastUpdate} />}
          </div>
        </div>

        {/* Symbol selector */}
        <div className="flex flex-wrap gap-1.5 mb-4">
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

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto scrollbar-none">
          {VIEW_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-hub-yellow/15 text-hub-yellow'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ Depth Chart Tab ═══ */}
        {activeTab === 'depth' && (
          <>
            {multiLoading && !multiData && (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
                <span className="ml-3 text-neutral-400">Loading depth data from 10 exchanges...</span>
              </div>
            )}

            {multiData && (
              <>
                {/* Summary cards */}
                {multiSummary && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                    <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                      <p className="text-xs text-neutral-500">Avg Mid Price</p>
                      <p className="text-lg font-bold text-white font-mono">{formatPrice(multiSummary.avgMid)}</p>
                    </div>
                    <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                      <p className="text-xs text-neutral-500">Total Bid Depth</p>
                      <p className="text-lg font-bold text-green-400 font-mono">{formatUsd(multiSummary.totalBid)}</p>
                    </div>
                    <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                      <p className="text-xs text-neutral-500">Total Ask Depth</p>
                      <p className="text-lg font-bold text-red-400 font-mono">{formatUsd(multiSummary.totalAsk)}</p>
                    </div>
                    <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                      <p className="text-xs text-neutral-500">Bid/Ask Ratio</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-3 rounded-full overflow-hidden bg-red-500/20 flex">
                          <div className="h-full bg-green-500/60 transition-all" style={{ width: `${multiSummary.ratio * 100}%` }} />
                        </div>
                        <span className={`text-xs font-bold font-mono ${multiSummary.ratio >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                          {(multiSummary.ratio * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                      <p className="text-xs text-neutral-500">Exchanges</p>
                      <p className="text-lg font-bold text-white font-mono">{multiSummary.exchangeCount}</p>
                    </div>
                  </div>
                )}

                <MultiDepthChart venues={multiData.venues} />
              </>
            )}
          </>
        )}

        {/* ═══ Exchange Comparison Tab ═══ */}
        {activeTab === 'comparison' && (
          <>
            {multiLoading && !multiData && (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
                <span className="ml-3 text-neutral-400">Loading exchange data...</span>
              </div>
            )}

            {multiData && (
              <ExchangeDepthTable venues={multiData.venues} depthSizes={multiData.depthSizes} />
            )}
          </>
        )}

        {/* ═══ Order Book Tab (single-exchange, preserved from original) ═══ */}
        {activeTab === 'orderbook' && (
          <>
            {obLoading && !obData && (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 animate-spin text-hub-yellow" />
                <span className="ml-3 text-neutral-400">Loading order book...</span>
              </div>
            )}

            {obData && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                    <p className="text-xs text-neutral-500">Mid Price</p>
                    <p className="text-lg font-bold text-white font-mono">{formatPrice(obData.midPrice)}</p>
                  </div>
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                    <p className="text-xs text-neutral-500">Spread</p>
                    <p className="text-lg font-bold text-white font-mono">{formatPrice(obData.spread)}</p>
                    <p className="text-xs text-neutral-500">
                      {obData.midPrice > 0 ? ((obData.spread / obData.midPrice) * 100).toFixed(4) : '0'}%
                    </p>
                  </div>
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                    <p className="text-xs text-neutral-500">Bid Depth</p>
                    <p className="text-lg font-bold text-green-400 font-mono">{formatUsd(obData.bidDepth)}</p>
                  </div>
                  <div className="bg-hub-darker border border-white/[0.06] rounded-xl px-4 py-3">
                    <p className="text-xs text-neutral-500">Ask Depth</p>
                    <p className="text-lg font-bold text-red-400 font-mono">{formatUsd(obData.askDepth)}</p>
                  </div>
                </div>

                {/* Buy/Sell ratio */}
                <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ArrowDownUp className="w-4 h-4 text-hub-yellow" />
                      <span className="text-sm font-semibold text-white">Buy / Sell Pressure</span>
                    </div>
                    <span className="text-xs text-neutral-500">Recent trades{obData.source ? ` — ${obData.source}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-green-400 w-16 text-right">
                      {(obData.buySellRatio * 100).toFixed(1)}%
                    </span>
                    <div className="flex-1 h-4 rounded-full overflow-hidden bg-red-500/30 flex">
                      <div className="h-full bg-green-500/80 transition-all duration-500" style={{ width: `${obData.buySellRatio * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-red-400 w-16">
                      {((1 - obData.buySellRatio) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-neutral-500">Buy: {formatUsd(obData.buyVolume)}</span>
                    <span className="text-xs text-neutral-500">Sell: {formatUsd(obData.sellVolume)}</span>
                  </div>
                </div>

                {/* Order book + Trade tape */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  <div className="lg:col-span-2 bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/[0.06]">
                      <h2 className="text-sm font-semibold text-white">Order Book Depth</h2>
                      <p className="text-xs text-neutral-600 mt-0.5">Top 25 levels{obData.source ? ` from ${obData.source}` : ''}</p>
                    </div>
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
                    <div className="grid grid-cols-2 gap-0 max-h-[500px] overflow-y-auto">
                      <div className="border-r border-white/[0.06]">
                        {obData.bids.map((bid, i) => {
                          const pct = obMaxCum > 0 ? (bid.cumulative / obMaxCum) * 100 : 0;
                          return (
                            <div key={i} className="relative flex items-center justify-between px-4 py-[5px] hover:bg-white/[0.02] transition-colors">
                              <div className="absolute inset-y-0 left-0 bg-green-500/10 transition-all" style={{ width: `${pct}%` }} />
                              <span className="relative text-xs text-neutral-400 font-mono">{formatQty(bid.quantity)}</span>
                              <span className="relative text-xs text-green-400 font-mono font-medium">{formatPrice(bid.price)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div>
                        {obData.asks.map((ask, i) => {
                          const pct = obMaxCum > 0 ? (ask.cumulative / obMaxCum) * 100 : 0;
                          return (
                            <div key={i} className="relative flex items-center justify-between px-4 py-[5px] hover:bg-white/[0.02] transition-colors">
                              <div className="absolute inset-y-0 right-0 bg-red-500/10 transition-all" style={{ width: `${pct}%` }} />
                              <span className="relative text-xs text-red-400 font-mono font-medium">{formatPrice(ask.price)}</span>
                              <span className="relative text-xs text-neutral-400 font-mono">{formatQty(ask.quantity)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

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
                          {obData.trades.map((trade, i) => {
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
                                <td className="px-3 py-[5px] text-xs text-neutral-600 text-right">{timeStr}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Info footer */}
        <div className="bg-hub-yellow/5 border border-hub-yellow/10 rounded-xl p-4 mt-6">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
            <div className="text-xs text-neutral-400 space-y-1">
              <p>
                <strong className="text-neutral-300">Order Flow & Depth</strong> shows real-time orderbook
                depth across {activeTab === 'orderbook' ? 'a single exchange' : '10 exchanges'}.
                Data refreshes every 5 seconds.
              </p>
              <p>
                <strong>Depth Chart</strong> shows cumulative bid and ask liquidity stacked by exchange.{' '}
                <strong>Exchange Comparison</strong> shows slippage at various order sizes.{' '}
                <strong>Order Book</strong> shows raw level-by-level data{obData?.source ? ` from ${obData.source}` : ''}.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
