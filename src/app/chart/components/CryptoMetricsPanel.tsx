'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { useApi } from '@/hooks/useSWRApi';
import type { Time, LineData } from 'lightweight-charts';

const LightweightChart = dynamic(
  () => import('@/components/charts/LightweightChart'),
  { ssr: false, loading: () => <div className="h-[120px] bg-white/[0.02] rounded-lg animate-pulse" /> },
);

/* ─── Types ──────────────────────────────────────────────────────── */

interface CryptoMetricsPanelProps {
  symbol: string;   // "BTC", "ETH"
  open: boolean;
  onToggle: () => void;
}

interface FundingEntry {
  symbol: string;
  exchange: string;
  rate: number;
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
  priceChangePercent?: number;
  quoteVolume24h?: number;
}

interface FundingHistoryPoint {
  t: string | number;
  rate: number;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function fmt(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function CryptoMetricsPanel({ symbol, open, onToggle }: CryptoMetricsPanelProps) {
  // Funding rates (shared across all symbols)
  const { data: fundingData } = useApi<{ data: FundingEntry[] }>({
    key: 'chart-funding-crypto',
    fetcher: async () => {
      const res = await fetch('/api/funding?assetClass=crypto');
      if (!res.ok) throw new Error('funding fetch failed');
      return res.json();
    },
    refreshInterval: 30_000,
  });

  // OI (shared across all symbols)
  const { data: oiData } = useApi<{ data: OIEntry[] }>({
    key: 'chart-oi-all',
    fetcher: async () => {
      const res = await fetch('/api/openinterest');
      if (!res.ok) throw new Error('oi fetch failed');
      return res.json();
    },
    refreshInterval: 60_000,
  });

  // Tickers (shared across all symbols)
  const { data: tickerData } = useApi<{ data: TickerEntry[] }>({
    key: 'chart-tickers-all',
    fetcher: async () => {
      const res = await fetch('/api/tickers');
      if (!res.ok) throw new Error('tickers fetch failed');
      return res.json();
    },
    refreshInterval: 15_000,
  });

  // Funding history (7d)
  const { data: historyData } = useApi<{ points: FundingHistoryPoint[] }>({
    key: `chart-funding-history-${symbol}`,
    fetcher: async () => {
      const res = await fetch(`/api/history/funding?symbol=${symbol}&source=exchange&exchange=hyperliquid&days=7`);
      if (!res.ok) throw new Error('history fetch failed');
      return res.json();
    },
    refreshInterval: 300_000,
    enabled: open,
  });

  // Compute metrics
  const metrics = useMemo(() => {
    const sym = symbol.toUpperCase();

    // Funding
    const fundingEntries = fundingData?.data?.filter(f => f.symbol === sym) ?? [];
    const rates = fundingEntries.map(f => f.rate).filter(r => typeof r === 'number' && isFinite(r));
    const avgFunding = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    let minFunding: { rate: number; exchange: string } | null = null;
    let maxFunding: { rate: number; exchange: string } | null = null;
    for (const f of fundingEntries) {
      if (typeof f.rate !== 'number' || !isFinite(f.rate)) continue;
      if (!minFunding || f.rate < minFunding.rate) minFunding = { rate: f.rate, exchange: f.exchange };
      if (!maxFunding || f.rate > maxFunding.rate) maxFunding = { rate: f.rate, exchange: f.exchange };
    }

    // OI
    const oiEntries = oiData?.data?.filter(o => o.symbol === sym) ?? [];
    const totalOI = oiEntries.reduce((sum, o) => sum + (o.openInterestValue ?? o.openInterest ?? 0), 0);

    // Tickers
    const tickerEntries = tickerData?.data?.filter(t => t.symbol === sym) ?? [];
    const totalVolume = tickerEntries.reduce((sum, t) => sum + (t.quoteVolume24h ?? 0), 0);
    const priceEntry = tickerEntries.find(t => t.lastPrice && t.lastPrice > 0);
    const price = priceEntry?.lastPrice ?? null;
    const change24h = priceEntry?.priceChangePercent ?? null;

    return { avgFunding, minFunding, maxFunding, totalOI, totalVolume, price, change24h, exchangeCount: fundingEntries.length };
  }, [symbol, fundingData, oiData, tickerData]);

  // Chart data
  const chartSeries = useMemo(() => {
    if (!historyData?.points || historyData.points.length === 0) return [];
    const lineData: LineData<Time>[] = historyData.points
      .map(p => ({
        time: (typeof p.t === 'string' ? Math.floor(new Date(p.t).getTime() / 1000) : Math.floor(p.t / 1000)) as Time,
        value: p.rate * 100,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    return [{ type: 'line' as const, data: lineData, options: { color: '#eab308', lineWidth: 1.5 } }];
  }, [historyData]);

  return (
    <div className="border-t border-white/[0.06] bg-black/80 backdrop-blur-sm flex-shrink-0">
      {/* Toggle bar */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xs font-medium text-neutral-400">
          {symbol} Market Data
          {metrics.exchangeCount > 0 && (
            <span className="text-neutral-600 ml-1.5">({metrics.exchangeCount} exchanges)</span>
          )}
        </span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronUp className="w-3.5 h-3.5 text-neutral-500" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3">
          {/* Metrics ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {/* Avg Funding */}
            <div className="bg-white/[0.03] rounded-lg px-3 py-2">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Avg Funding</p>
              <p className={`text-sm font-bold font-mono ${
                metrics.avgFunding === null ? 'text-neutral-600' :
                metrics.avgFunding > 0 ? 'text-green-400' : metrics.avgFunding < 0 ? 'text-red-400' : 'text-white'
              }`}>
                {metrics.avgFunding !== null ? `${metrics.avgFunding.toFixed(4)}%` : '—'}
              </p>
            </div>

            {/* Min Funding */}
            <div className="bg-white/[0.03] rounded-lg px-3 py-2">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Min Funding</p>
              <p className="text-sm font-bold font-mono text-red-400">
                {metrics.minFunding ? `${metrics.minFunding.rate.toFixed(4)}%` : '—'}
              </p>
              {metrics.minFunding && (
                <p className="text-[10px] text-neutral-600 truncate">{metrics.minFunding.exchange}</p>
              )}
            </div>

            {/* Max Funding */}
            <div className="bg-white/[0.03] rounded-lg px-3 py-2">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Max Funding</p>
              <p className="text-sm font-bold font-mono text-green-400">
                {metrics.maxFunding ? `${metrics.maxFunding.rate.toFixed(4)}%` : '—'}
              </p>
              {metrics.maxFunding && (
                <p className="text-[10px] text-neutral-600 truncate">{metrics.maxFunding.exchange}</p>
              )}
            </div>

            {/* Total OI */}
            <div className="bg-white/[0.03] rounded-lg px-3 py-2">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Open Interest</p>
              <p className="text-sm font-bold font-mono text-white">
                {metrics.totalOI > 0 ? `$${fmt(metrics.totalOI)}` : '—'}
              </p>
            </div>

            {/* 24h Volume */}
            <div className="bg-white/[0.03] rounded-lg px-3 py-2">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">24h Volume</p>
              <p className="text-sm font-bold font-mono text-white">
                {metrics.totalVolume > 0 ? `$${fmt(metrics.totalVolume)}` : '—'}
              </p>
            </div>

            {/* 24h Change */}
            <div className="bg-white/[0.03] rounded-lg px-3 py-2">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">24h Change</p>
              <div className="flex items-center gap-1">
                {metrics.change24h !== null ? (
                  <>
                    {metrics.change24h >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <p className={`text-sm font-bold font-mono ${
                      metrics.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {metrics.change24h >= 0 ? '+' : ''}{metrics.change24h.toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-bold font-mono text-neutral-600">—</p>
                )}
              </div>
            </div>
          </div>

          {/* Mini funding history chart */}
          {chartSeries.length > 0 && (
            <div className="rounded-lg overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-neutral-500">7-Day Funding Rate History (Hyperliquid)</span>
              </div>
              <LightweightChart series={chartSeries} height={100} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
