'use client';

import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Fuel, Info, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

interface GasRow {
  chain: string;
  label: string;
  color: string;
  nativeSymbol: string;
  gwei: number;
  priorityGwei: number | null;
  blockTimeSec: number;
  nativeUsd: number;
  transferCostUsd: number;
  swapCostUsd: number;
  status: 'low' | 'moderate' | 'high';
}

interface GasResponse {
  data: GasRow[];
  summary: {
    ethMainnetGwei: number | null;
    cheapestL2: string | null;
    avgL2Gwei: number;
    ethToL2Multiplier: number;
  };
  meta: { timestamp: number };
}

function StatusBadge({ status }: { status: GasRow['status'] }) {
  if (status === 'low') {
    return (
      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-400/15 text-green-400 inline-flex items-center gap-0.5">
        <CheckCircle2 className="w-2.5 h-2.5" /> low
      </span>
    );
  }
  if (status === 'high') {
    return (
      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-400/15 text-red-400 inline-flex items-center gap-0.5">
        <AlertTriangle className="w-2.5 h-2.5" /> high
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-400/15 text-yellow-400">
      mod
    </span>
  );
}

export default function GasTrackerPage() {
  const { data, isLoading, isRefreshing, error, refresh } = useApi<GasResponse>({
    key: 'gas-tracker',
    fetcher: async () => {
      const res = await fetch('/api/gas-tracker', { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 15_000,
  });

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
              <Fuel className="w-4 h-4 text-orange-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Gas Tracker</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={data?.data?.length ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['Public RPC', 'CoinGecko']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Live gas prices across Ethereum mainnet + major L2s. Cost estimates assume 21k gas for transfers, 150k for a simple Uniswap-v3 swap.
          </p>
        </div>

        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">ETH Mainnet</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {data.summary.ethMainnetGwei != null ? `${data.summary.ethMainnetGwei.toFixed(2)} gwei` : '—'}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Avg L2 gwei</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {data.summary.avgL2Gwei.toFixed(3)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">Base · Arbitrum · OP</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">L1/L2 multiplier</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                {data.summary.ethToL2Multiplier > 0 ? `${data.summary.ethToL2Multiplier.toFixed(0)}×` : '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                how much cheaper L2 is
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Cheapest L2</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-green-400">
                {data.summary.cheapestL2 || '—'}
              </div>
            </div>
          </div>
        )}

        <div className="card-premium p-3 min-h-[300px]">
          <div className="hidden md:grid md:grid-cols-[160px,100px,110px,100px,140px,140px,70px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>Chain</div>
            <div className="text-right">Gas (gwei)</div>
            <div className="text-right">Priority</div>
            <div className="text-right">Block t</div>
            <div className="text-right">Transfer · 21k</div>
            <div className="text-right">Swap · 150k</div>
            <div className="text-right">Status</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {data?.data?.map(r => (
            <div
              key={r.chain}
              className="md:grid md:grid-cols-[160px,100px,110px,100px,140px,140px,70px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <div className="min-w-0">
                  <div className="text-sm text-white font-semibold truncate">{r.label}</div>
                  <div className="text-[10px] text-neutral-600 font-mono">{r.nativeSymbol}</div>
                </div>
              </div>
              <div className="text-right font-mono text-sm tabular-nums text-white font-semibold">
                {r.gwei > 0 ? (r.gwei < 1 ? r.gwei.toFixed(4) : r.gwei.toFixed(2)) : '—'}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                {r.priorityGwei != null ? (r.priorityGwei < 1 ? r.priorityGwei.toFixed(4) : r.priorityGwei.toFixed(2)) : '—'}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                {r.blockTimeSec}s
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                {r.transferCostUsd > 0 ? (
                  r.transferCostUsd < 0.01
                    ? `< $0.01`
                    : <UsdDisplay amount={r.transferCostUsd} />
                ) : '—'}
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-white">
                {r.swapCostUsd > 0 ? (
                  r.swapCostUsd < 0.01
                    ? `< $0.01`
                    : <UsdDisplay amount={r.swapCostUsd} />
                ) : '—'}
              </div>
              <div className="text-right">
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">Reading it:</strong> Ethereum is labeled&nbsp;
            <span className="text-green-400">low</span> below 20 gwei,&nbsp;
            <span className="text-yellow-400">moderate</span> 20-50,&nbsp;
            <span className="text-red-400">high</span> above 50. L2s are cheap — anything under 0.1 gwei is essentially free.
            Priority fees show the actual tip builders are paying (derived via <span className="font-mono">eth_feeHistory</span>). Polygon and BNB use gwei natively but are quoted here for parity.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
