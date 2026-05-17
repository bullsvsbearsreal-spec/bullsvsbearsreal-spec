'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import PageHero from '@/components/PageHero';
import { Vault, Info, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

interface VaultRow {
  address: string;
  leader: string;
  name: string;
  tvlUsd: number;
  aprPct: number;
  pnlDay: number;
  pnlWeek: number;
  pnlMonth: number;
  pnlAllTime: number;
  windowPnl: number;
  ageDays: number;
  isClosed: boolean;
  createdAt: number;
}

interface VaultsResponse {
  data: VaultRow[];
  summary: {
    totalVaults: number;
    activeVaults: number;
    closedVaults: number;
    totalTvlUsd: number;
    medianApr: number;
    biggestVault: string | null;
    biggestVaultTvl: number;
  };
  meta: { timestamp: number; window: string; sort: string; status: string; returned: number };
}

type Sort = 'tvl' | 'apr' | 'pnl30d' | 'age';
type Status = 'active' | 'closed' | 'all';

function short(a: string): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtApr(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export default function HlVaultsPage() {
  const [sort, setSort] = useState<Sort>('tvl');
  const [status, setStatus] = useState<Status>('active');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<VaultsResponse>({
    key: `hl-vaults:${sort}:${status}`,
    fetcher: async () => {
      const res = await fetch(`/api/hl-vaults?limit=100&sort=${sort}&status=${status}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 300_000,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Vault}
          eyebrow="Hyperliquid · copy-trade"
          title="HL"
          accentNoun="vaults"
          accent="purple"
          description={
            <>Public vaults on Hyperliquid. APR + PnL windows + age. Deposit
              anywhere to share a leader&apos;s upside (and their downside —
              vaults are non-custodial leveraged-trader exposure, not yield).</>
          }
          className="mb-4"
          actions={
            <>
              <DataFreshness exchangeCount={data?.summary?.activeVaults ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['Hyperliquid']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </>
          }
        />

        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Active vaults</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {data.summary.activeVaults.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {data.summary.closedVaults.toLocaleString()} closed
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">TVL shown</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                <UsdDisplay amount={data.summary.totalTvlUsd} />
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                top {data.meta.returned} vaults
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Median APR (profitable)</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${data.summary.medianApr > 0 ? 'text-green-400' : 'text-neutral-500'}`}>
                {fmtApr(data.summary.medianApr)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">vaults w/ positive APR</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Biggest vault</div>
              <div className="font-mono tabular-nums text-xs font-semibold text-white truncate">
                {data.summary.biggestVault || '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                <UsdDisplay amount={data.summary.biggestVaultTvl} />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit">
            {([
              ['tvl', 'By TVL'],
              ['apr', 'By APR'],
              ['pnl30d', 'By 30d PnL'],
              ['age', 'By age'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                  sort === k ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit">
            {([
              ['active', 'Active'],
              ['closed', 'Closed'],
              ['all', 'All'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setStatus(k)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                  status === k ? 'bg-purple-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[40px,1fr,110px,90px,100px,100px,70px,40px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Vault</div>
            <div className="text-right">TVL</div>
            <div className="text-right">APR</div>
            <div className="text-right">30d PnL</div>
            <div className="text-right">All-time</div>
            <div className="text-right">Age</div>
            <div className="text-right"></div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 12 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {!isLoading && !error && rows.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">No vaults match current filters.</div>
          )}

          {rows.map((r, i) => (
            <div
              key={r.address}
              className="md:grid md:grid-cols-[40px,1fr,110px,90px,100px,100px,70px,40px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
            >
              <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
              <div className="min-w-0">
                <div className="text-sm text-white font-semibold truncate flex items-center gap-1">
                  {r.name}
                  {r.isClosed && (
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-neutral-500/15 text-neutral-400">
                      closed
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-neutral-600 font-mono truncate">
                  leader {short(r.leader)} · {short(r.address)}
                </div>
              </div>
              <div className="text-right font-mono text-sm tabular-nums text-white font-semibold">
                <UsdDisplay amount={r.tvlUsd} />
              </div>
              <div className={`text-right font-mono text-xs tabular-nums font-semibold ${r.aprPct > 0 ? 'text-green-400' : r.aprPct < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                {fmtApr(r.aprPct)}
              </div>
              <div className={`text-right font-mono text-xs tabular-nums inline-flex items-center justify-end gap-1 ${r.pnlMonth > 0 ? 'text-green-400' : r.pnlMonth < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                {r.pnlMonth > 0 ? <TrendingUp className="w-3 h-3" /> : r.pnlMonth < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                {r.pnlMonth === 0 ? '—' : <UsdDisplay amount={r.pnlMonth} />}
              </div>
              <div className={`text-right font-mono text-xs tabular-nums ${r.pnlAllTime >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                {r.pnlAllTime === 0 ? '—' : <UsdDisplay amount={r.pnlAllTime} />}
              </div>
              <div className="text-right font-mono text-[10px] tabular-nums text-neutral-400">
                {r.ageDays}d
              </div>
              <div className="text-right">
                <a
                  href={`https://app.hyperliquid.xyz/vaults/${r.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-end text-neutral-500 hover:text-hub-yellow transition-colors"
                  aria-label={`Open ${r.name} on Hyperliquid`}
                  title="Open on Hyperliquid"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Vault data straight from Hyperliquid&apos;s public stats feed. APR is annualized from the vault&apos;s own accounting.
            PnL windows use the vault&apos;s checkpointed series (last minus first), so a freshly-created vault will show 0 for day/week/month until enough data accumulates.
            Click any vault to open it on Hyperliquid directly.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
