'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Activity, Zap, Wifi, WifiOff } from 'lucide-react';
import { useApi } from '@/hooks/useSWRApi';
import { useRealtimeLiquidations, LIQ_WINDOWS } from '@/hooks/useRealtimeLiquidations';
import { ALL_EXCHANGES } from '@/lib/constants';
import type { Time, LineData } from 'lightweight-charts';

const LightweightChart = dynamic(
  () => import('@/components/charts/LightweightChart'),
  { ssr: false, loading: () => <div className="h-[90px] bg-white/[0.02] rounded-lg animate-pulse" /> },
);

/* ─── Types ──────────────────────────────────────────────────────── */

interface CryptoMetricsPanelProps {
  symbol: string;
  open: boolean;
  onToggle: () => void;
}

interface FundingEntry {
  symbol: string;
  exchange: string;
  fundingRate: number;
  fundingInterval?: string;
  annualized?: number;
}

interface OIEntry {
  symbol: string;
  exchange: string;
  openInterestValue?: number;
  openInterest?: number;
}

interface TickerEntry {
  symbol: string;
  exchange: string;
  lastPrice?: number;
  priceChangePercent24h?: number;
  quoteVolume24h?: number;
}

interface FundingHistoryPoint {
  t: string | number;
  rate: number;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function fmt(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

function fundingColor(rate: number | null): string {
  if (rate === null) return 'text-neutral-600';
  if (rate > 0.01) return 'text-green-400';
  if (rate > 0) return 'text-green-400/70';
  if (rate < -0.01) return 'text-red-400';
  if (rate < 0) return 'text-red-400/70';
  return 'text-neutral-400';
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function CryptoMetricsPanel({ symbol, open, onToggle }: CryptoMetricsPanelProps) {
  const { data: fundingData } = useApi<{ data: FundingEntry[] }>({
    key: 'chart-funding-crypto',
    fetcher: async () => {
      const res = await fetch('/api/funding?assetClass=crypto', { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('funding fetch failed');
      return res.json();
    },
    refreshInterval: 15_000,
  });

  const { data: oiData } = useApi<{ data: OIEntry[] }>({
    key: 'chart-oi-all',
    fetcher: async () => {
      const res = await fetch('/api/openinterest', { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('oi fetch failed');
      return res.json();
    },
    refreshInterval: 30_000,
  });

  const { data: tickerData } = useApi<{ data: TickerEntry[] }>({
    key: 'chart-tickers-all',
    fetcher: async () => {
      const res = await fetch('/api/tickers', { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('tickers fetch failed');
      return res.json();
    },
    refreshInterval: 10_000,
  });

  const { data: historyData } = useApi<{ points: FundingHistoryPoint[] }>({
    key: `chart-funding-history-${symbol}`,
    fetcher: async () => {
      const res = await fetch(`/api/history/funding?symbol=${symbol}&source=exchange&exchange=hyperliquid&days=7`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('history fetch failed');
      return res.json();
    },
    refreshInterval: 60_000,
    enabled: open,
  });

  // Real-time liquidation feed (Binance WebSocket + DB backfill, in-memory only)
  const { stats: liqStats, connected: liqConnected, liqWindow, setLiqWindow, getFilteredLiqs } = useRealtimeLiquidations(open);

  const [showDetail, setShowDetail] = useState(false);

  const metrics = useMemo(() => {
    const sym = symbol.toUpperCase();

    // Funding — normalize to 8h basis for fair averaging across exchanges
    const fundingEntries = fundingData?.data?.filter(f => f.symbol === sym) ?? [];
    const norm8h = (f: FundingEntry) => f.fundingRate * (f.fundingInterval === '1h' ? 8 : f.fundingInterval === '4h' ? 2 : 1);
    const rates = fundingEntries.map(f => norm8h(f)).filter(r => typeof r === 'number' && isFinite(r));
    const avgFunding = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    let minFunding: { rate: number; exchange: string } | null = null;
    let maxFunding: { rate: number; exchange: string } | null = null;
    for (const f of fundingEntries) {
      if (typeof f.fundingRate !== 'number' || !isFinite(f.fundingRate)) continue;
      const rate8h = norm8h(f);
      if (!minFunding || rate8h < minFunding.rate) minFunding = { rate: rate8h, exchange: f.exchange };
      if (!maxFunding || rate8h > maxFunding.rate) maxFunding = { rate: rate8h, exchange: f.exchange };
    }

    // OI
    const oiEntries = oiData?.data?.filter(o => o.symbol === sym) ?? [];
    const totalOI = oiEntries.reduce((sum, o) => sum + (o.openInterestValue ?? o.openInterest ?? 0), 0);

    // Tickers — deduplicate by exchange, cap per-entry to filter inflated data
    const tickerEntries = tickerData?.data?.filter(t => t.symbol === sym) ?? [];
    const MAX_SANE_VOL = 100_000_000_000;
    const volByExchange = new Map<string, number>();
    for (const t of tickerEntries) {
      const vol = Number(t.quoteVolume24h) || 0;
      if (vol <= 0 || vol > MAX_SANE_VOL) continue;
      const existing = volByExchange.get(t.exchange) || 0;
      if (vol > existing) volByExchange.set(t.exchange, vol);
    }
    const totalVolume = Array.from(volByExchange.values()).reduce((sum, v) => sum + v, 0);
    const priceEntry = tickerEntries.find(t => t.lastPrice && t.lastPrice > 0);
    const price = priceEntry?.lastPrice ?? null;
    const change24h = priceEntry?.priceChangePercent24h ?? null;

    // Per-exchange funding for bar chart (sorted by 8h-normalized rate)
    const perExchangeFunding = fundingEntries
      .filter(f => typeof f.fundingRate === 'number' && isFinite(f.fundingRate))
      .map(f => ({ ...f, fundingRate: norm8h(f) }))
      .sort((a, b) => b.fundingRate - a.fundingRate)
      .slice(0, 15);

    // Price spread across exchanges
    const prices = tickerEntries
      .filter(t => t.lastPrice && t.lastPrice > 0)
      .map(t => ({ exchange: t.exchange, price: t.lastPrice! }));
    const priceHigh = prices.length > 0 ? prices.reduce((a, b) => a.price > b.price ? a : b) : null;
    const priceLow = prices.length > 0 ? prices.reduce((a, b) => a.price < b.price ? a : b) : null;
    const priceSpreadPct = priceHigh && priceLow && priceLow.price > 0
      ? ((priceHigh.price - priceLow.price) / priceLow.price) * 100
      : null;

    // Per-exchange prices sorted high→low for spread bar chart
    const perExchangePrices = prices
      .sort((a, b) => b.price - a.price)
      .slice(0, 20);

    return {
      avgFunding, minFunding, maxFunding, totalOI, totalVolume, price, change24h,
      exchangeCount: fundingEntries.length, perExchangeFunding, priceHigh, priceLow, priceSpreadPct,
      perExchangePrices,
    };
  }, [symbol, fundingData, oiData, tickerData]);

  const chartSeries = useMemo(() => {
    if (!historyData?.points || historyData.points.length === 0) return [];
    const lineData: LineData<Time>[] = historyData.points
      .map(p => ({
        time: (typeof p.t === 'string' ? Math.floor(new Date(p.t).getTime() / 1000) : Math.floor(p.t / 1000)) as Time,
        // API already returns rate as percentage (fraction * 100), no further conversion needed
        value: p.rate,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
    return [{ type: 'line' as const, data: lineData, options: { color: '#eab308', lineWidth: 1.5, priceFormat: { type: 'price', precision: 4, minMove: 0.0001 } } }];
  }, [historyData]);

  return (
    <section className="border-t border-white/[0.08] bg-[#060606] flex-shrink-0 relative z-10" aria-label={`${symbol} metrics`}>
      {/* Toggle bar — shows key stats inline even when collapsed */}
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Activity className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
          <span className="text-[11px] font-semibold text-neutral-300">
            {symbol}
          </span>
          {metrics.exchangeCount > 0 && (
            <span
              className="text-[10px] text-neutral-500 cursor-help relative group/tip"
            >
              {metrics.exchangeCount}x
              <span className="pointer-events-none absolute left-0 top-full mt-1.5 z-50 w-[200px] rounded-md bg-[#141414] border border-white/[0.08] px-2.5 py-1.5 text-[9px] text-neutral-400 leading-snug shadow-xl opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
                {metrics.exchangeCount} funding entries from {ALL_EXCHANGES.length} exchanges. Some list multiple contract types per symbol.
              </span>
            </span>
          )}
        </div>

        {/* Inline preview stats (visible even when collapsed) */}
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] font-mono overflow-hidden min-w-0">
          {metrics.avgFunding !== null && (
            <span className={`flex-shrink-0 ${fundingColor(metrics.avgFunding)}`}>
              FR {metrics.avgFunding.toFixed(4)}%
            </span>
          )}
          {metrics.totalOI > 0 && (
            <span className="text-neutral-500 flex-shrink-0 hidden min-[480px]:inline">
              OI ${fmt(metrics.totalOI)}
            </span>
          )}
          {metrics.totalVolume > 0 && (
            <span className="text-neutral-500 flex-shrink-0 hidden sm:inline">
              Vol ${fmt(metrics.totalVolume)}
            </span>
          )}
          {metrics.change24h !== null && isFinite(metrics.change24h) && (
            <span className={`flex-shrink-0 ${metrics.change24h >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
              {metrics.change24h >= 0 ? '+' : ''}{metrics.change24h.toFixed(2)}%
            </span>
          )}
        </div>

        <div className="flex-1" />
        {open
          ? <ChevronUp className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0" />
          : <ChevronDown className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="px-3 pb-2.5 max-h-[45vh] overflow-y-auto scrollbar-thin">
          {/* Metrics + chart side by side on wide screens */}
          <div className="flex flex-col lg:flex-row gap-2.5">
            {/* Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 flex-1">
              {/* Avg Funding */}
              <div className="bg-white/[0.03] rounded-md px-2.5 py-1.5 border border-white/[0.04]">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider leading-none mb-1">Avg Funding</p>
                <p className={`text-xs font-bold font-mono leading-none ${fundingColor(metrics.avgFunding)}`}>
                  {metrics.avgFunding !== null ? `${metrics.avgFunding.toFixed(4)}%` : '—'}
                </p>
              </div>

              {/* Min Funding */}
              <div className="bg-white/[0.03] rounded-md px-2.5 py-1.5 border border-white/[0.04]">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider leading-none mb-1">Min Funding</p>
                <p className="text-xs font-bold font-mono text-red-400 leading-none">
                  {metrics.minFunding ? `${metrics.minFunding.rate.toFixed(4)}%` : '—'}
                </p>
                {metrics.minFunding && (
                  <p className="text-[9px] text-neutral-600 truncate mt-0.5 leading-none">{metrics.minFunding.exchange}</p>
                )}
              </div>

              {/* Max Funding */}
              <div className="bg-white/[0.03] rounded-md px-2.5 py-1.5 border border-white/[0.04]">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider leading-none mb-1">Max Funding</p>
                <p className="text-xs font-bold font-mono text-green-400 leading-none">
                  {metrics.maxFunding ? `${metrics.maxFunding.rate.toFixed(4)}%` : '—'}
                </p>
                {metrics.maxFunding && (
                  <p className="text-[9px] text-neutral-600 truncate mt-0.5 leading-none">{metrics.maxFunding.exchange}</p>
                )}
              </div>

              {/* Total OI */}
              <div className="bg-white/[0.03] rounded-md px-2.5 py-1.5 border border-white/[0.04]">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider leading-none mb-1">Open Interest</p>
                <p className="text-xs font-bold font-mono text-white leading-none">
                  {metrics.totalOI > 0 ? `$${fmt(metrics.totalOI)}` : '—'}
                </p>
              </div>

              {/* 24h Volume */}
              <div className="bg-white/[0.03] rounded-md px-2.5 py-1.5 border border-white/[0.04]">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider leading-none mb-1">24h Volume</p>
                <p className="text-xs font-bold font-mono text-white leading-none">
                  {metrics.totalVolume > 0 ? `$${fmt(metrics.totalVolume)}` : '—'}
                </p>
              </div>

              {/* 24h Change */}
              <div className="bg-white/[0.03] rounded-md px-2.5 py-1.5 border border-white/[0.04]">
                <p className="text-[9px] text-neutral-600 uppercase tracking-wider leading-none mb-1">24h Change</p>
                <div className="flex items-center gap-0.5">
                  {metrics.change24h !== null ? (
                    <>
                      {metrics.change24h >= 0 ? (
                        <TrendingUp className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                      )}
                      <p className={`text-xs font-bold font-mono leading-none ${
                        metrics.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {metrics.change24h >= 0 ? '+' : ''}{metrics.change24h.toFixed(2)}%
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-bold font-mono text-neutral-600 leading-none">—</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right column: charts + spread */}
            <div className="lg:w-[320px] flex-shrink-0 flex flex-col gap-1.5">
              {/* Mini funding chart */}
              {chartSeries.length > 0 && (
                <div className="rounded-md overflow-hidden border border-white/[0.04] bg-white/[0.01]">
                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-[9px] text-neutral-600">7d Funding (Hyperliquid)</span>
                  </div>
                  <LightweightChart series={chartSeries} height={60} />
                </div>
              )}

              {/* Price spread indicator */}
              {metrics.priceSpreadPct !== null && metrics.priceHigh && metrics.priceLow && (
                <div className="rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-neutral-600 uppercase tracking-wider">Price Spread</span>
                    <span className={`text-[10px] font-mono font-bold ${metrics.priceSpreadPct > 0.1 ? 'text-hub-yellow' : 'text-neutral-400'}`}>
                      {metrics.priceSpreadPct.toFixed(4)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-mono">
                    <span className="text-red-400/70">{metrics.priceLow.exchange}: ${metrics.priceLow.price >= 1 ? metrics.priceLow.price.toFixed(2) : metrics.priceLow.price.toFixed(6)}</span>
                    <span className="text-green-400/70">{metrics.priceHigh.exchange}: ${metrics.priceHigh.price >= 1 ? metrics.priceHigh.price.toFixed(2) : metrics.priceHigh.price.toFixed(6)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expandable detail row: per-exchange funding + liquidations */}
          <button
            onClick={() => setShowDetail(d => !d)}
            aria-expanded={showDetail}
            className="mt-1.5 w-full flex items-center justify-center gap-1 py-0.5 text-[9px] text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            {showDetail ? 'Hide' : 'Show'} exchange detail
            {showDetail ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>

          {showDetail && (
            <div className="mt-1 flex flex-col lg:flex-row gap-2.5">
              {/* Per-exchange funding bars */}
              {metrics.perExchangeFunding.length > 0 && (() => {
                const sorted = [...metrics.perExchangeFunding].sort((a, b) => b.fundingRate - a.fundingRate);
                const positiveCount = sorted.filter(f => f.fundingRate >= 0).length;
                const negativeCount = sorted.filter(f => f.fundingRate < 0).length;
                const maxAbs = Math.max(...sorted.map(x => Math.abs(x.fundingRate)), 0.001);
                return (
                  <div className="flex-1 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Funding by Exchange</p>
                      <div className="flex items-center gap-2 text-[8px] font-mono">
                        <span className="text-green-400/70">{positiveCount} long pay</span>
                        <span className="text-neutral-700">|</span>
                        <span className="text-red-400/70">{negativeCount} short pay</span>
                      </div>
                    </div>
                    <div className="space-y-[2px]">
                      {sorted.map((f, i) => {
                        const pct = Math.min(Math.abs(f.fundingRate) / maxAbs * 100, 100);
                        const isPositive = f.fundingRate >= 0;
                        const isExtreme = Math.abs(f.fundingRate) >= 0.01;
                        const isTop = i === 0;
                        const isBottom = i === sorted.length - 1;
                        return (
                          <div
                            key={f.exchange}
                            className={`flex items-center gap-1.5 py-[2px] px-1 rounded-sm transition-colors ${
                              (isTop || isBottom) ? 'bg-white/[0.02]' : ''
                            }`}
                          >
                            <span className={`text-[9px] w-[68px] truncate text-right flex-shrink-0 ${
                              isExtreme ? 'text-neutral-300 font-medium' : 'text-neutral-500'
                            }`}>
                              {f.exchange}
                            </span>
                            <div className="flex-1 h-[8px] rounded-[2px] overflow-hidden relative bg-white/[0.03]">
                              <div
                                className={`absolute top-0 h-full rounded-[2px] transition-all duration-500 ${
                                  isPositive
                                    ? isExtreme ? 'bg-green-400/50' : 'bg-green-500/30'
                                    : isExtreme ? 'bg-red-400/50' : 'bg-red-500/30'
                                }`}
                                style={{ width: `${pct}%`, left: 0 }}
                              />
                            </div>
                            <span className={`text-[9px] font-mono w-[58px] text-right flex-shrink-0 font-medium ${
                              isPositive
                                ? isExtreme ? 'text-green-400' : 'text-green-400/70'
                                : isExtreme ? 'text-red-400' : 'text-red-400/70'
                            }`}>
                              {isPositive ? '+' : ''}{f.fundingRate.toFixed(4)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Average line */}
                    {metrics.avgFunding !== null && (
                      <div className="mt-1.5 pt-1.5 border-t border-white/[0.04] flex items-center justify-between">
                        <span className="text-[8px] text-neutral-600">AVG across {sorted.length} exchanges</span>
                        <span className={`text-[9px] font-mono font-bold ${fundingColor(metrics.avgFunding)}`}>
                          {metrics.avgFunding >= 0 ? '+' : ''}{metrics.avgFunding.toFixed(4)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Per-exchange price spread bars */}
              {metrics.perExchangePrices.length >= 2 && (() => {
                const sorted = metrics.perExchangePrices;
                const high = sorted[0].price;
                const low = sorted[sorted.length - 1].price;
                const range = high - low || 1;
                const mid = (high + low) / 2;
                const decimals = mid >= 1000 ? 2 : mid >= 1 ? 4 : 6;
                return (
                  <div className="flex-1 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Price by Exchange</p>
                      {metrics.priceSpreadPct !== null && (
                        <span className={`text-[8px] font-mono font-bold ${metrics.priceSpreadPct > 0.1 ? 'text-hub-yellow' : 'text-neutral-400'}`}>
                          spread {metrics.priceSpreadPct.toFixed(4)}%
                        </span>
                      )}
                    </div>
                    <div className="space-y-[2px]">
                      {sorted.map((p, i) => {
                        const pct = range > 0 ? ((p.price - low) / range) * 100 : 50;
                        const isTop = i === 0;
                        const isBottom = i === sorted.length - 1;
                        return (
                          <div
                            key={p.exchange}
                            className={`flex items-center gap-1.5 py-[2px] px-1 rounded-sm transition-colors ${
                              (isTop || isBottom) ? 'bg-white/[0.02]' : ''
                            }`}
                          >
                            <span className={`text-[9px] w-[68px] truncate text-right flex-shrink-0 ${
                              isTop ? 'text-green-400 font-medium' : isBottom ? 'text-red-400 font-medium' : 'text-neutral-500'
                            }`}>
                              {p.exchange}
                            </span>
                            <div className="flex-1 h-[8px] rounded-[2px] overflow-hidden relative bg-white/[0.03]">
                              <div
                                className={`absolute top-0 h-full rounded-[2px] transition-all duration-500 ${
                                  isTop ? 'bg-green-400/40' : isBottom ? 'bg-red-400/40' : 'bg-blue-400/25'
                                }`}
                                style={{ width: `${Math.max(pct, 3)}%`, left: 0 }}
                              />
                            </div>
                            <span className={`text-[9px] font-mono w-[72px] text-right flex-shrink-0 font-medium ${
                              isTop ? 'text-green-400' : isBottom ? 'text-red-400' : 'text-neutral-300'
                            }`}>
                              ${p.price.toFixed(decimals)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-white/[0.04] flex items-center justify-between">
                      <span className="text-[8px] text-neutral-600">Range across {sorted.length} exchanges</span>
                      <span className="text-[9px] font-mono font-bold text-hub-yellow">
                        ${(high - low).toFixed(decimals)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Real-time liquidations (Binance + OKX WebSocket) */}
              {(() => {
                const filtered = getFilteredLiqs();
                const anyConnected = liqConnected;

                return (
                  <div className="lg:w-[280px] flex-shrink-0 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-2 flex flex-col">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-hub-yellow" />
                        <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Live Liquidations</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] px-1 py-[1px] rounded bg-[#F0B90B]/10 text-[#F0B90B] font-medium">Binance</span>
                        {anyConnected ? (
                          <Wifi className="w-2.5 h-2.5 text-green-400" />
                        ) : (
                          <WifiOff className="w-2.5 h-2.5 text-red-400" />
                        )}
                      </div>
                    </div>

                    {/* Session note */}
                    <p className="text-[8px] text-neutral-500 text-center mb-1.5">
                      Session data only, clears on refresh
                    </p>

                    {/* Time window tabs */}
                    <div className="flex items-center gap-[2px] mb-1.5" role="tablist" aria-label="Liquidation time window">
                      {LIQ_WINDOWS.map(w => (
                        <button
                          key={w.key}
                          role="tab"
                          aria-selected={liqWindow === w.key}
                          onClick={() => setLiqWindow(w.key)}
                          className={`flex-1 px-1 py-[2px] rounded text-[8px] font-semibold transition-colors ${
                            liqWindow === w.key
                              ? 'bg-hub-yellow/15 text-hub-yellow'
                              : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04]'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>

                    {/* Summary stats */}
                    {liqStats.count > 0 && (
                      <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="text-[8px] text-neutral-500 font-mono">
                          {liqStats.count} liqs | ${liqStats.totalValue >= 1e6 ? `${(liqStats.totalValue / 1e6).toFixed(1)}M` : liqStats.totalValue >= 1000 ? `${(liqStats.totalValue / 1000).toFixed(0)}K` : liqStats.totalValue.toFixed(0)} total
                        </span>
                        <span className="text-[8px] font-mono">
                          <span className="text-red-400/70">{liqStats.longCount}L</span>
                          {' '}
                          <span className="text-green-400/70">{liqStats.shortCount}S</span>
                        </span>
                      </div>
                    )}

                    {/* Liq list */}
                    <div className="flex-1">
                      {filtered.length === 0 ? (
                        <div className="flex items-center justify-center py-3">
                          <span className="text-[9px] text-neutral-600 animate-pulse">
                            {anyConnected ? 'Waiting for liquidations...' : 'Connecting...'}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-[2px]">
                          {filtered.slice(0, 15).map((liq, i) => {
                            const isBig = liq.value >= 100_000;
                            return (
                              <div key={`${liq.time}-${i}`} className={`flex items-center gap-1 text-[9px] font-mono ${isBig ? 'bg-white/[0.02]' : ''}`}>
                                <span className={`w-[28px] font-bold ${liq.side === 'long' ? 'text-red-400' : 'text-green-400'}`}>
                                  {liq.side === 'long' ? 'L' : 'S'}
                                </span>
                                <span className="text-neutral-400 text-[8px] w-[32px] truncate font-semibold">{liq.symbol}</span>
                                <span className={`font-bold flex-1 text-right ${isBig ? 'text-hub-yellow' : 'text-neutral-300'}`}>
                                  ${liq.value >= 1e6 ? `${(liq.value / 1e6).toFixed(1)}M` : liq.value >= 1000 ? `${(liq.value / 1000).toFixed(1)}K` : liq.value.toFixed(0)}
                                </span>
                                <span className="text-neutral-600 text-[8px] w-[36px] truncate text-right">{liq.exchange}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
