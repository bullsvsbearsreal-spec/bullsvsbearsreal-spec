'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useApi } from '@/hooks/useSWRApi';
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
      const res = await fetch('/api/funding?assetClass=crypto');
      if (!res.ok) throw new Error('funding fetch failed');
      return res.json();
    },
    refreshInterval: 30_000,
  });

  const { data: oiData } = useApi<{ data: OIEntry[] }>({
    key: 'chart-oi-all',
    fetcher: async () => {
      const res = await fetch('/api/openinterest');
      if (!res.ok) throw new Error('oi fetch failed');
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const { data: tickerData } = useApi<{ data: TickerEntry[] }>({
    key: 'chart-tickers-all',
    fetcher: async () => {
      const res = await fetch('/api/tickers');
      if (!res.ok) throw new Error('tickers fetch failed');
      return res.json();
    },
    refreshInterval: 15_000,
  });

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

  const metrics = useMemo(() => {
    const sym = symbol.toUpperCase();

    // Funding
    const fundingEntries = fundingData?.data?.filter(f => f.symbol === sym) ?? [];
    const rates = fundingEntries.map(f => f.fundingRate).filter(r => typeof r === 'number' && isFinite(r));
    const avgFunding = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    let minFunding: { rate: number; exchange: string } | null = null;
    let maxFunding: { rate: number; exchange: string } | null = null;
    for (const f of fundingEntries) {
      if (typeof f.fundingRate !== 'number' || !isFinite(f.fundingRate)) continue;
      if (!minFunding || f.fundingRate < minFunding.rate) minFunding = { rate: f.fundingRate, exchange: f.exchange };
      if (!maxFunding || f.fundingRate > maxFunding.rate) maxFunding = { rate: f.fundingRate, exchange: f.exchange };
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

    return { avgFunding, minFunding, maxFunding, totalOI, totalVolume, price, change24h, exchangeCount: fundingEntries.length };
  }, [symbol, fundingData, oiData, tickerData]);

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
    <div className="border-t border-white/[0.08] bg-[#060606] flex-shrink-0">
      {/* Toggle bar — shows key stats inline even when collapsed */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Activity className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
          <span className="text-[11px] font-semibold text-neutral-300">
            {symbol}
          </span>
          {metrics.exchangeCount > 0 && (
            <span className="text-[10px] text-neutral-600">
              {metrics.exchangeCount}x
            </span>
          )}
        </div>

        {/* Inline preview stats (visible even when collapsed) */}
        <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono overflow-hidden">
          {metrics.avgFunding !== null && (
            <span className={fundingColor(metrics.avgFunding)}>
              FR {metrics.avgFunding.toFixed(4)}%
            </span>
          )}
          {metrics.totalOI > 0 && (
            <span className="text-neutral-500">
              OI ${fmt(metrics.totalOI)}
            </span>
          )}
          {metrics.totalVolume > 0 && (
            <span className="text-neutral-500">
              Vol ${fmt(metrics.totalVolume)}
            </span>
          )}
          {metrics.change24h !== null && (
            <span className={metrics.change24h >= 0 ? 'text-green-400/70' : 'text-red-400/70'}>
              {metrics.change24h >= 0 ? '+' : ''}{metrics.change24h.toFixed(2)}%
            </span>
          )}
        </div>

        <div className="flex-1" />
        {open
          ? <ChevronDown className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0" />
          : <ChevronUp className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="px-3 pb-2.5">
          {/* Metrics + chart side by side on wide screens */}
          <div className="flex flex-col lg:flex-row gap-2.5">
            {/* Metric cards */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 flex-1">
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

            {/* Mini funding chart — sits beside cards on lg+ */}
            {chartSeries.length > 0 && (
              <div className="lg:w-[320px] flex-shrink-0 rounded-md overflow-hidden border border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[9px] text-neutral-600">7d Funding (Hyperliquid)</span>
                </div>
                <LightweightChart series={chartSeries} height={60} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
