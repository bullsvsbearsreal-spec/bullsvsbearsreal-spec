'use client';

import { useMemo, useState, useCallback } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UsdDisplay from '@/components/UsdDisplay';
import { useTraderBookmarks } from '@/hooks/useTraderBookmarks';
import PageHero from '@/components/PageHero';
import Link from 'next/link';
import { Layers, Plus, X, ExternalLink, ChevronLeft, Minus, GitCompareArrows } from 'lucide-react';

/* ─── Types (trimmed copies from dossier endpoints) ──────────────── */

interface GMXDossier {
  address: string;
  summary: {
    realizedPnl: number;
    unrealizedPnl: number;
    volume: number;
    wins: number;
    losses: number;
    totalTrades: number;
    winRate: number;
    maxCapital: number;
    realizedFees: number;
  };
  openPositions: Array<{ marketSymbol: string; isLong: boolean; sizeUsd: number; unrealizedPnl: number }>;
}

interface HLDossier {
  address: string;
  displayName: string | null;
  summary: {
    accountValue: number;
    totalNotional: number;
    marginUsed: number;
    unrealizedPnl: number;
    performance: Record<string, { pnl: number; volume: number; roi: number }>;
  };
  openPositions: Array<{ coin: string; isLong: boolean; sizeUsd: number; unrealizedPnl: number }>;
}

interface TraderData {
  address: string;
  displayName: string | null;
  hlData: HLDossier | null;
  gmxArb: GMXDossier | null;
  gmxAvax: GMXDossier | null;
  loading: boolean;
  error: string | null;
  /** Rolled-up stats across all 3 venues */
  rolled: {
    totalRealizedPnl: number;
    totalUnrealized: number;
    totalVolume: number;
    totalTrades: number;
    combinedWinRate: number;
    combinedOpenPositions: number;
    combinedNotional: number;
    accountValue: number;
    activeVenues: string[];
  };
}

/* ─── Hook: fetch all three venues for one address ──────────────── */

function useTraderComparison(address: string): TraderData {
  const hl = useApi<HLDossier>({
    key: address ? `cmp-hl-${address}` : null,
    fetcher: async () => {
      const res = await fetch(`/api/hl-traders/${address}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!address,
  });

  const gmxArb = useApi<GMXDossier>({
    key: address ? `cmp-gmx-arb-${address}` : null,
    fetcher: async () => {
      const res = await fetch(`/api/gmx-traders/${address}?chain=arbitrum`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!address,
  });

  const gmxAvax = useApi<GMXDossier>({
    key: address ? `cmp-gmx-avax-${address}` : null,
    fetcher: async () => {
      const res = await fetch(`/api/gmx-traders/${address}?chain=avalanche`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!address,
  });

  return useMemo(() => {
    const hlData = hl.data ?? null;
    const arbData = gmxArb.error ? null : (gmxArb.data ?? null);
    const avaxData = gmxAvax.error ? null : (gmxAvax.data ?? null);

    const arbPnl = arbData?.summary.realizedPnl ?? 0;
    const avaxPnl = avaxData?.summary.realizedPnl ?? 0;
    const hlAllTimePnl = hlData?.summary?.performance?.allTime?.pnl ?? 0;
    const totalRealized = arbPnl + avaxPnl + hlAllTimePnl;

    const arbVolume = arbData?.summary.volume ?? 0;
    const avaxVolume = avaxData?.summary.volume ?? 0;
    const hlVolume = hlData?.summary?.performance?.allTime?.volume ?? 0;
    const totalVolume = arbVolume + avaxVolume + hlVolume;

    const arbTrades = arbData?.summary.totalTrades ?? 0;
    const avaxTrades = avaxData?.summary.totalTrades ?? 0;
    const gmxTotalTrades = arbTrades + avaxTrades;
    // HL doesn't expose per-trade counts cleanly — use GMX only for combined WR
    const gmxWins = (arbData?.summary.wins ?? 0) + (avaxData?.summary.wins ?? 0);
    const gmxLosses = (arbData?.summary.losses ?? 0) + (avaxData?.summary.losses ?? 0);
    const combinedWR = gmxTotalTrades > 0 ? (gmxWins / gmxTotalTrades) * 100 : 0;

    const arbOpen = arbData?.openPositions?.length ?? 0;
    const avaxOpen = avaxData?.openPositions?.length ?? 0;
    const hlOpen = hlData?.openPositions?.length ?? 0;
    const combinedOpen = arbOpen + avaxOpen + hlOpen;

    const notional =
      (arbData?.openPositions ?? []).reduce((s, p) => s + p.sizeUsd, 0) +
      (avaxData?.openPositions ?? []).reduce((s, p) => s + p.sizeUsd, 0) +
      (hlData?.openPositions ?? []).reduce((s, p) => s + p.sizeUsd, 0);

    const unrealized =
      (arbData?.openPositions ?? []).reduce((s, p) => s + p.unrealizedPnl, 0) +
      (avaxData?.openPositions ?? []).reduce((s, p) => s + p.unrealizedPnl, 0) +
      (hlData?.openPositions ?? []).reduce((s, p) => s + p.unrealizedPnl, 0);

    const activeVenues = [
      arbOpen > 0 || arbTrades > 0 ? 'GMX·Arb' : null,
      avaxOpen > 0 || avaxTrades > 0 ? 'GMX·Avax' : null,
      hlOpen > 0 || hlAllTimePnl !== 0 ? 'HL' : null,
    ].filter(Boolean) as string[];

    return {
      address,
      displayName: hlData?.displayName ?? null,
      hlData,
      gmxArb: arbData,
      gmxAvax: avaxData,
      loading: hl.isLoading || gmxArb.isLoading || gmxAvax.isLoading,
      error: hl.error,
      rolled: {
        totalRealizedPnl: totalRealized,
        totalUnrealized: unrealized,
        totalVolume,
        totalTrades: gmxTotalTrades,
        combinedWinRate: combinedWR,
        combinedOpenPositions: combinedOpen,
        combinedNotional: notional,
        accountValue: hlData?.summary?.accountValue ?? 0,
        activeVenues,
      },
    };
  }, [address, hl.data, gmxArb.data, gmxAvax.data, hl.isLoading, gmxArb.isLoading, gmxAvax.isLoading, hl.error, gmxArb.error, gmxAvax.error]);
}

/* ─── Stat row component ──────────────────────────────────────── */

function StatRow({
  label,
  values,
  format = 'usd',
  highlight = 'max',
}: {
  label: string;
  values: (number | null)[];
  format?: 'usd' | 'pct' | 'int' | 'text';
  highlight?: 'max' | 'min' | 'none';
}) {
  const numericValues = values.filter((v): v is number => typeof v === 'number');
  const winner = highlight === 'none' || numericValues.length === 0 ? null :
    highlight === 'max' ? Math.max(...numericValues) : Math.min(...numericValues);

  const render = (v: number | null) => {
    if (v === null) return <span className="text-neutral-700">—</span>;
    if (format === 'pct') return <span className="font-mono tabular-nums">{v.toFixed(1)}%</span>;
    if (format === 'int') return <span className="font-mono tabular-nums">{v.toLocaleString()}</span>;
    if (format === 'usd') return <UsdDisplay amount={v} showPositiveSign={label.toLowerCase().includes('pnl') && v !== 0} />;
    return <span className="font-mono">{String(v)}</span>;
  };

  return (
    <div className="grid grid-cols-[140px,1fr] sm:grid-cols-[180px,1fr] gap-2 py-1.5 border-b border-white/[0.04] last:border-0">
      <div className="text-[11px] text-neutral-500 font-medium">{label}</div>
      <div className="flex items-stretch gap-2">
        {values.map((v, i) => {
          const isWinner = winner !== null && v === winner && values.filter(x => x === winner).length < values.length;
          return (
            <div
              key={i}
              className={`flex-1 text-sm font-mono tabular-nums text-right ${
                isWinner ? 'text-hub-yellow font-semibold' : 'text-white'
              }`}
            >
              {render(v)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function CompareTradersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { bookmarks } = useTraderBookmarks();

  // Parse addresses from URL (?addresses=0x1,0x2,0x3)
  const initialAddresses = (searchParams.get('addresses') || '')
    .split(',')
    .map(a => a.trim())
    .filter(a => /^0x[a-fA-F0-9]{40}$/.test(a));

  const [addresses, setAddresses] = useState<string[]>(initialAddresses.slice(0, 3));
  const [newAddr, setNewAddr] = useState('');

  const syncUrl = useCallback((list: string[]) => {
    const q = list.length > 0 ? `?addresses=${list.join(',')}` : '';
    globalThis.history?.replaceState(null, '', `/compare-traders${q}`);
  }, []);

  const addAddress = useCallback((addr: string) => {
    const trimmed = addr.trim().toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return;
    if (addresses.includes(trimmed) || addresses.length >= 3) return;
    const next = [...addresses, trimmed];
    setAddresses(next);
    syncUrl(next);
  }, [addresses, syncUrl]);

  const removeAddress = useCallback((addr: string) => {
    const next = addresses.filter(a => a !== addr);
    setAddresses(next);
    syncUrl(next);
  }, [addresses, syncUrl]);

  const handleAdd = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    addAddress(newAddr);
    setNewAddr('');
  }, [newAddr, addAddress]);

  // Fetch data for up to 3 addresses (hooks must be unconditionally called)
  const t0 = useTraderComparison(addresses[0] ?? '');
  const t1 = useTraderComparison(addresses[1] ?? '');
  const t2 = useTraderComparison(addresses[2] ?? '');
  const traders = [t0, t1, t2].filter((t, i) => i < addresses.length);

  // Available bookmarks not yet in the comparison
  const availableBookmarks = bookmarks.filter(b => !addresses.includes(b.address));

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        {/* Back nav */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/smart-money" className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-white">
            <ChevronLeft className="w-3 h-3" /> Smart Money
          </Link>
          <span className="text-neutral-700">·</span>
          <Link href="/gmx-traders" className="text-[11px] text-neutral-500 hover:text-white">GMX Traders</Link>
          <span className="text-neutral-700">·</span>
          <Link href="/hl-traders" className="text-[11px] text-neutral-500 hover:text-white">HL Traders</Link>
        </div>

        <PageHero
          icon={GitCompareArrows}
          eyebrow={`Side-by-side · ${addresses.length}/3 loaded`}
          title="Compare"
          accentNoun="traders"
          accent="hub-yellow"
          description={
            <>Pick up to <span className="text-white font-medium">3 wallets</span> and
              see their stats side-by-side across GMX V2 (Arb + Avax) and Hyperliquid.
              Bigger numbers in each row are highlighted in yellow.</>
          }
          className="mb-4"
        />

        {/* Add trader form */}
        <div className="card-premium p-3 mb-4 space-y-2">
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              type="text"
              value={newAddr}
              onChange={e => setNewAddr(e.target.value)}
              placeholder="0x… paste wallet address"
              disabled={addresses.length >= 3}
              className="flex-1 max-w-md bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/40 font-mono disabled:opacity-40"
              aria-label="Wallet address to add"
            />
            <button
              type="submit"
              disabled={addresses.length >= 3 || !/^0x[a-fA-F0-9]{40}$/.test(newAddr.trim())}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-hub-yellow/15 text-hub-yellow hover:bg-hub-yellow/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </form>

          {availableBookmarks.length > 0 && addresses.length < 3 && (
            <div className="pt-2 border-t border-white/[0.04]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1.5">Or add from bookmarks</div>
              <div className="flex flex-wrap gap-1.5">
                {availableBookmarks.slice(0, 20).map(b => (
                  <button
                    key={b.address}
                    type="button"
                    onClick={() => addAddress(b.address)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] text-[10px] text-neutral-300 hover:text-white transition-colors"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    {b.displayName || `${b.address.slice(0, 6)}…${b.address.slice(-4)}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comparison table */}
        {traders.length === 0 ? (
          <div className="card-premium p-8 text-center">
            <GitCompareArrows className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
            <div className="text-sm text-neutral-400 mb-1">No traders to compare</div>
            <div className="text-xs text-neutral-600">
              Add up to 3 wallet addresses above, or pick from your bookmarks.
            </div>
          </div>
        ) : (
          <div className="card-premium p-0 overflow-hidden">
            {/* Trader header row */}
            <div className="grid grid-cols-[140px,1fr] sm:grid-cols-[180px,1fr] gap-2 p-3 bg-white/[0.02] border-b border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold self-end">Metric</div>
              <div className="flex items-stretch gap-2">
                {traders.map(t => (
                  <div key={t.address} className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-end gap-1.5 mb-1">
                      <span className="text-sm text-white font-semibold truncate">
                        {t.displayName || `${t.address.slice(0, 6)}…${t.address.slice(-4)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAddress(t.address)}
                        className="text-neutral-500 hover:text-red-400 transition-colors"
                        aria-label="Remove from comparison"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-[9px]">
                      {t.rolled.activeVenues.map(v => (
                        <span key={v} className="text-neutral-600 font-mono">{v}</span>
                      ))}
                      {t.rolled.activeVenues.length === 0 && t.loading && (
                        <span className="text-neutral-700 font-mono">loading…</span>
                      )}
                      {t.rolled.activeVenues.length === 0 && !t.loading && (
                        <span className="text-neutral-700 font-mono">no activity</span>
                      )}
                    </div>
                    <Link
                      href={`/trader/${t.address}`}
                      className="inline-flex items-center justify-end gap-0.5 text-[10px] text-hub-yellow/60 hover:text-hub-yellow mt-1"
                    >
                      Full profile <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Stat rows */}
            <div className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-hub-yellow/70 font-semibold mb-2">Rolled up across venues</div>
              <StatRow label="Total realized PnL" values={traders.map(t => t.rolled.totalRealizedPnl)} />
              <StatRow label="Total volume" values={traders.map(t => t.rolled.totalVolume)} />
              <StatRow label="Open positions" values={traders.map(t => t.rolled.combinedOpenPositions)} format="int" />
              <StatRow label="Live notional" values={traders.map(t => t.rolled.combinedNotional)} />
              <StatRow label="Live unrealized" values={traders.map(t => t.rolled.totalUnrealized)} />

              <div className="text-[10px] uppercase tracking-wider text-blue-400/70 font-semibold mt-4 mb-2">GMX V2 detail</div>
              <StatRow label="GMX closed trades" values={traders.map(t => t.rolled.totalTrades)} format="int" />
              <StatRow label="GMX win rate" values={traders.map(t => t.rolled.combinedWinRate)} format="pct" />
              <StatRow label="GMX Arb realized" values={traders.map(t => t.gmxArb?.summary.realizedPnl ?? null)} />
              <StatRow label="GMX Avax realized" values={traders.map(t => t.gmxAvax?.summary.realizedPnl ?? null)} />
              <StatRow label="GMX Arb open" values={traders.map(t => t.gmxArb?.openPositions?.length ?? null)} format="int" />

              <div className="text-[10px] uppercase tracking-wider text-purple-400/70 font-semibold mt-4 mb-2">Hyperliquid detail</div>
              <StatRow label="HL account value" values={traders.map(t => t.hlData?.summary?.accountValue ?? null)} />
              <StatRow label="HL all-time PnL" values={traders.map(t => t.hlData?.summary?.performance?.allTime?.pnl ?? null)} />
              <StatRow label="HL 30D PnL" values={traders.map(t => t.hlData?.summary?.performance?.month?.pnl ?? null)} />
              <StatRow label="HL 7D PnL" values={traders.map(t => t.hlData?.summary?.performance?.week?.pnl ?? null)} />
              <StatRow label="HL margin used" values={traders.map(t => t.hlData?.summary?.marginUsed ?? null)} />
              <StatRow label="HL open positions" values={traders.map(t => t.hlData?.openPositions?.length ?? null)} format="int" />
            </div>
          </div>
        )}

        <div className="mt-4 text-[10px] text-neutral-600 flex items-center gap-2">
          <Minus className="w-3 h-3" />
          Yellow values = highest in each row. Gray "—" means venue returned no data for that wallet.
        </div>
      </main>
      <Footer />
    </div>
  );
}
