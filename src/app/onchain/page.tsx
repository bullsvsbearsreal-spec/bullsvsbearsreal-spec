'use client';

import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import DataFreshness from '@/components/DataFreshness';
import PageHero from '@/components/PageHero';
import { useApi } from '@/hooks/useSWRApi';
import { useFlash } from '@/hooks/useFlash';
import { formatUSD, formatCompact } from '@/lib/utils/format';
import {
  RefreshCw,
  AlertTriangle,
  Cpu,
  Coins,
  BarChart3,
  Activity,
  Zap,
  Clock,
} from 'lucide-react';
import type { Time, LineData, HistogramData } from 'lightweight-charts';

const LightweightChart = dynamic(
  () => import('@/components/charts/LightweightChart'),
  { ssr: false, loading: () => <div className="h-[250px] bg-white/[0.02] rounded-xl animate-pulse" /> },
);

/* ─── Types ──────────────────────────────────────────────────────── */

interface HistoryPoint {
  time: number;
  value: number;
}

interface MetricData {
  /** May be null when upstream data is partial / Puell needs 365d history. */
  current: number | null;
  history: HistoryPoint[];
  signal?: string;
  change30d?: number;
}

interface MempoolFee {
  fastest: number;
  halfHour: number;
  hour: number;
  economy: number;
}

interface MempoolData {
  pendingTxCount: number;
  totalFees: number;
  recommendedFees: MempoolFee | null;
}

interface OnChainResponse {
  hashRate: MetricData;
  difficulty: MetricData & { nextAdjustment?: { estimatedPercent: number; remainingBlocks: number; estimatedDate: string } };
  minerRevenue: MetricData;
  puellMultiple: MetricData;
  mvrv: MetricData;
  mempool: MempoolData;
  transactionVolume: MetricData;
  supply: MetricData & { maxSupply: number; percentMined: number };
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatHashRate(val: number): string {
  const eh = val / 1e6;
  if (eh >= 1000) return `${(eh / 1000).toFixed(1)} ZH/s`;
  return `${eh.toFixed(0)} EH/s`;
}

function signalColor(signal?: string): string {
  if (!signal) return 'text-neutral-500';
  const s = signal.toLowerCase();
  if (s.includes('buy') || s.includes('under') || s.includes('low')) return 'text-green-400';
  if (s.includes('sell') || s.includes('over') || s.includes('high')) return 'text-red-400';
  return 'text-hub-yellow';
}

function signalBgColor(signal?: string): string {
  if (!signal) return 'bg-neutral-500/10';
  const s = signal.toLowerCase();
  if (s.includes('buy') || s.includes('under') || s.includes('low')) return 'bg-green-400/10';
  if (s.includes('sell') || s.includes('over') || s.includes('high')) return 'bg-red-400/10';
  return 'bg-hub-yellow/10';
}

function mvrvColor(val: number): string {
  if (val < 1) return '#22c55e';
  if (val < 3) return '#eab308';
  return '#ef4444';
}

function puellColor(val: number): string {
  if (val < 0.5) return '#22c55e';
  if (val < 1.5) return '#eab308';
  return '#ef4444';
}

function historyToLineData(history: HistoryPoint[]): LineData<Time>[] {
  return history
    .map((p) => ({
      time: p.time as Time,
      value: p.value,
    }))
    .sort((a, b) => (a.time as number) - (b.time as number));
}

function historyToHistogramData(history: HistoryPoint[], color: string): HistogramData<Time>[] {
  return history
    .map((p) => ({
      time: p.time as Time,
      value: p.value,
      color,
    }))
    .sort((a, b) => (a.time as number) - (b.time as number));
}

/* ─── Chart Card Wrapper ─────────────────────────────────────────── */

function ChartCard({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-neutral-600 mt-0.5">{subtitle}</p>}
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

/* ─── Summary Card ───────────────────────────────────────────────── */

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent,
  flash,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  flash?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-neutral-500">{icon}</div>
        <span className="text-xs text-neutral-500 font-medium">{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono ${flash || ''}`} style={accent ? { color: accent } : undefined}>
        <span className={accent ? '' : 'text-white'}>{value}</span>
      </div>
      {sub && <p className="text-[11px] text-neutral-500 mt-1">{sub}</p>}
      {children}
    </div>
  );
}

/* ─── Page Component ─────────────────────────────────────────────── */

export default function OnChainPage() {
  const fetcher = useCallback(async () => {
    const res = await fetch('/api/onchain');
    if (!res.ok) throw new Error(`Failed to fetch on-chain data (${res.status})`);
    return res.json() as Promise<OnChainResponse>;
  }, []);

  const { data, isLoading, isRefreshing, lastUpdate, refresh, error } = useApi<OnChainResponse>({
    key: 'onchain',
    fetcher,
    refreshInterval: 10 * 60 * 1000,
  });

  const hashRateLineData = useMemo(
    () => (data?.hashRate?.history ? historyToLineData(data.hashRate.history) : []),
    [data],
  );
  const difficultyLineData = useMemo(
    () => (data?.difficulty?.history ? historyToLineData(data.difficulty.history) : []),
    [data],
  );
  const minerRevenueHistogramData = useMemo(
    () => (data?.minerRevenue?.history ? historyToHistogramData(data.minerRevenue.history, '#22c55e') : []),
    [data],
  );
  const puellLineData = useMemo(
    () => (data?.puellMultiple?.history ? historyToLineData(data.puellMultiple.history) : []),
    [data],
  );
  const txVolumeHistogramData = useMemo(
    () => (data?.transactionVolume?.history ? historyToHistogramData(data.transactionVolume.history, '#3b82f6') : []),
    [data],
  );

  const hashFlash = useFlash(data?.hashRate?.current);
  const mvrvFlash = useFlash(data?.mvrv?.current);
  const puellFlash = useFlash(data?.puellMultiple?.current);

  const hashRateChange = data?.hashRate?.change30d;
  const supplyPercent = data?.supply?.percentMined ?? ((data?.supply?.maxSupply ?? 0) > 0 ? ((data?.supply?.current ?? 0) / (data?.supply?.maxSupply ?? 1)) * 100 : 0);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        <PageHero
          icon={Cpu}
          eyebrow="On-chain · BTC network"
          title="On-chain"
          accentNoun="metrics"
          accent="orange"
          description={
            <>Bitcoin network health, miner economics, and valuation metrics.
              Hash rate, difficulty, fees, MVRV, NUPL — the standard toolkit for
              reading cycle position from network state rather than price.</>
          }
          className="mb-8"
          actions={
            <>
              <DataFreshness exchangeCount={1} lastUpdated={lastUpdate} sources={['Blockchain']} />
              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors text-xs font-semibold disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </>
          }
        />

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-6 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={refresh} className="ml-auto text-xs text-hub-yellow hover:underline">
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                  <div className="h-3 w-20 bg-white/[0.06] rounded mb-3" />
                  <div className="h-7 w-28 bg-white/[0.06] rounded mb-2" />
                  <div className="h-3 w-16 bg-white/[0.04] rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 animate-pulse">
                  <div className="h-4 w-32 bg-white/[0.06] rounded mb-4" />
                  <div className="h-[250px] bg-white/[0.04] rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                icon={<Cpu className="w-4 h-4" />}
                label="Hash Rate"
                value={data.hashRate?.current != null ? formatHashRate(data.hashRate.current) : '—'}
                flash={hashFlash}
                sub={
                  hashRateChange != null
                    ? `${hashRateChange >= 0 ? '+' : ''}${hashRateChange.toFixed(1)}% (30d)`
                    : undefined
                }
              />

              <SummaryCard
                icon={<Coins className="w-4 h-4" />}
                label="BTC Supply"
                value={`${formatCompact(data.supply.current)} / 21M`}
              >
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-1">
                    <span>{supplyPercent.toFixed(2)}% mined</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-hub-yellow rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(supplyPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </SummaryCard>

              <SummaryCard
                icon={<BarChart3 className="w-4 h-4" />}
                label="MVRV Z-Score"
                value={data.mvrv?.current != null ? data.mvrv.current.toFixed(2) : '—'}
                accent={data.mvrv?.current != null ? mvrvColor(data.mvrv.current) : undefined}
                flash={mvrvFlash}
              >
                {data.mvrv?.signal && (
                  <span
                    className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${signalColor(data.mvrv.signal)} ${signalBgColor(data.mvrv.signal)}`}
                  >
                    {data.mvrv.signal}
                  </span>
                )}
              </SummaryCard>

              <SummaryCard
                icon={<Activity className="w-4 h-4" />}
                label="Puell Multiple"
                value={data.puellMultiple?.current != null ? data.puellMultiple.current.toFixed(2) : '—'}
                accent={data.puellMultiple?.current != null ? puellColor(data.puellMultiple.current) : undefined}
                flash={puellFlash}
              >
                {data.puellMultiple.signal && (
                  <span
                    className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${signalColor(data.puellMultiple.signal)} ${signalBgColor(data.puellMultiple.signal)}`}
                  >
                    {data.puellMultiple.signal}
                  </span>
                )}
              </SummaryCard>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hash Rate Chart */}
              <ChartCard title="Hash Rate" subtitle="1-year network hash rate (TH/s)">
                {hashRateLineData.length > 0 ? (
                  <LightweightChart
                    height={250}
                    series={[
                      {
                        type: 'line',
                        data: hashRateLineData,
                        options: { color: '#06b6d4', lineWidth: 2 },
                      },
                    ]}
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-neutral-600 text-sm">
                    No hash rate history available
                  </div>
                )}
              </ChartCard>

              {/* Mining Difficulty Chart */}
              <ChartCard
                title="Mining Difficulty"
                subtitle="1-year difficulty adjustments"
                badge={
                  data.difficulty.nextAdjustment ? (
                    <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400">
                      Next: {data.difficulty.nextAdjustment.estimatedPercent >= 0 ? '+' : ''}
                      {data.difficulty.nextAdjustment.estimatedPercent.toFixed(1)}% in{' '}
                      {data.difficulty.nextAdjustment.remainingBlocks.toLocaleString()} blocks
                    </span>
                  ) : undefined
                }
              >
                {difficultyLineData.length > 0 ? (
                  <LightweightChart
                    height={250}
                    series={[
                      {
                        type: 'line',
                        data: difficultyLineData,
                        options: { color: '#f97316', lineWidth: 2 },
                      },
                    ]}
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-neutral-600 text-sm">
                    No difficulty history available
                  </div>
                )}
              </ChartCard>

              {/* Miner Revenue Chart */}
              <ChartCard title="Miner Revenue" subtitle="1-year daily miner revenue (USD)">
                {minerRevenueHistogramData.length > 0 ? (
                  <LightweightChart
                    height={250}
                    series={[
                      {
                        type: 'histogram',
                        data: minerRevenueHistogramData,
                        options: { color: '#22c55e' },
                      },
                    ]}
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-neutral-600 text-sm">
                    No miner revenue history available
                  </div>
                )}
              </ChartCard>

              {/* Puell Multiple Chart */}
              <ChartCard title="Puell Multiple" subtitle="1-year Puell Multiple with reference zones">
                {puellLineData.length > 0 ? (
                  <LightweightChart
                    height={250}
                    series={[
                      {
                        type: 'line',
                        data: puellLineData,
                        options: { color: '#eab308', lineWidth: 2 },
                      },
                    ]}
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-neutral-600 text-sm">
                    No Puell Multiple history available
                  </div>
                )}
                <div className="flex items-center gap-4 mt-2 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-green-400 rounded" />
                    <span className="text-green-400">Below 0.5 — Undervalued zone</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-red-400 rounded" />
                    <span className="text-red-400">Above 1.5 — Overheated zone</span>
                  </div>
                </div>
              </ChartCard>

              {/* Transaction Volume Chart */}
              <ChartCard title="Transaction Volume" subtitle="1-year on-chain transaction volume (USD)">
                {txVolumeHistogramData.length > 0 ? (
                  <LightweightChart
                    height={250}
                    series={[
                      {
                        type: 'histogram',
                        data: txVolumeHistogramData,
                        options: { color: '#3b82f6' },
                      },
                    ]}
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-neutral-600 text-sm">
                    No transaction volume history available
                  </div>
                )}
              </ChartCard>

              {/* Mempool & Fees Card */}
              <ChartCard title="Mempool & Fees" subtitle="Current Bitcoin mempool status">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      <span className="text-[11px] text-neutral-500">Pending Transactions</span>
                    </div>
                    <span className="text-lg font-bold font-mono text-white">
                      {data.mempool.pendingTxCount != null
                        ? data.mempool.pendingTxCount.toLocaleString()
                        : '-'}
                    </span>
                  </div>

                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3 h-3 text-red-400" />
                      <span className="text-[11px] text-neutral-500">Fastest</span>
                    </div>
                    <span className="text-lg font-bold font-mono text-red-400">
                      {data.mempool.recommendedFees?.fastest != null
                        ? `${data.mempool.recommendedFees.fastest} sat/vB`
                        : '-'}
                    </span>
                  </div>

                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-orange-400" />
                      <span className="text-[11px] text-neutral-500">30 Minutes</span>
                    </div>
                    <span className="text-lg font-bold font-mono text-orange-400">
                      {data.mempool.recommendedFees?.halfHour != null
                        ? `${data.mempool.recommendedFees.halfHour} sat/vB`
                        : '-'}
                    </span>
                  </div>

                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-hub-yellow" />
                      <span className="text-[11px] text-neutral-500">1 Hour</span>
                    </div>
                    <span className="text-lg font-bold font-mono text-hub-yellow">
                      {data.mempool.recommendedFees?.hour != null
                        ? `${data.mempool.recommendedFees.hour} sat/vB`
                        : '-'}
                    </span>
                  </div>

                  <div className="col-span-2 bg-white/[0.03] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-green-400" />
                      <span className="text-[11px] text-neutral-500">Economy (No rush)</span>
                    </div>
                    <span className="text-lg font-bold font-mono text-green-400">
                      {data.mempool.recommendedFees?.economy != null
                        ? `${data.mempool.recommendedFees.economy} sat/vB`
                        : '-'}
                    </span>
                  </div>
                </div>
              </ChartCard>
            </div>

            {/* Info footer */}
            <div className="mt-6 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
              <p className="text-neutral-500 text-xs leading-relaxed">
                On-chain metrics track the fundamental health of the Bitcoin network. Hash rate reflects cumulative mining power securing the network. The Puell Multiple compares daily miner revenue to the 365-day moving average — values below 0.5 historically indicate undervaluation, above 1.5 indicate overheating. MVRV Z-Score measures market value vs realized value — below 1 suggests accumulation territory, above 3 signals potential tops. Data refreshes every 10 minutes.
              </p>
            </div>
          </>
        ) : null}
      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}
