'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BookmarkStar from '@/components/BookmarkStar';
import TraderHistoryChart, { type PnlSeries } from '@/components/TraderHistoryChart';
import { useRecordTraderVisit } from '@/hooks/useRecentTraders';
import { copyToClipboard } from '@/lib/copyToClipboard';
import Link from 'next/link';
import {
  Activity, ExternalLink, Copy, ChevronLeft, Layers,
} from 'lucide-react';

/* ─── Types shared across three platforms ────────────────────────── */

interface GMXPosition {
  marketSymbol: string;
  isLong: boolean;
  sizeUsd: number;
  entryPrice: number;
  livePrice: number;
  unrealizedPnl: number;
  pnlPct: number;
  leverage: number | null;
}

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
  openPositions: GMXPosition[];
  meta: { chain: string };
}

interface HLPosition {
  coin: string;
  isLong: boolean;
  sizeUsd: number;
  entryPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  roePct: number;
  leverage: number | null;
  leverageType: 'cross' | 'isolated' | null;
}

interface HLDossier {
  address: string;
  displayName: string | null;
  summary: {
    accountValue: number;
    totalNotional: number;
    marginUsed: number;
    withdrawable: number;
    unrealizedPnl: number;
    performance: Record<string, { pnl: number; volume: number; roi: number }>;
  };
  openPositions: HLPosition[];
  history: { window: string; pnl: Array<{ t: number; v: number }> } | null;
}

interface GMXSparklines {
  series: Record<string, number[]>;
  days: number;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function fmtUSD(n: number, compact = true): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (!compact) return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/* ─── Venue section ───────────────────────────────────────────────── */

interface VenueProps {
  label: string;
  accent: string;
  href?: string | null;
  explorerUrl?: string | null;
  isLoading: boolean;
  error: unknown;
  hasActivity: boolean;
  children: React.ReactNode;
  stats?: { label: string; value: string; positive?: boolean }[];
  /** When true, render a compact "no activity" row instead of a full card */
  compactWhenEmpty?: boolean;
}

function VenueSection({
  label, accent, href, explorerUrl, isLoading, error,
  hasActivity, children, stats, compactWhenEmpty,
}: VenueProps) {
  const shouldCompact = compactWhenEmpty && !isLoading && !hasActivity;

  // Compact no-activity row — takes minimal vertical space, only shows the
  // venue label + "no activity" + the view-on link. Prevents empty venues
  // from eating equal visual weight when a trader is, say, HL-only.
  if (shouldCompact) {
    return (
      <div className="card-premium p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <span className="text-xs font-medium text-neutral-400 truncate">{label}</span>
          <span className="text-[10px] text-neutral-600 font-mono">no activity</span>
        </div>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-hub-yellow flex-shrink-0"
          >
            View <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="card-premium p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <h2 className="text-sm font-semibold text-white">{label}</h2>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-hub-yellow/70 hover:text-hub-yellow inline-flex items-center gap-1">
              View <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white inline-flex items-center gap-1">
              Explorer <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {stats.map(s => (
            <div key={s.label} className="bg-white/[0.02] rounded-lg p-2">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-0.5">{s.label}</div>
              <div className={`font-mono text-xs tabular-nums font-semibold ${
                s.positive === true ? 'text-green-400' : s.positive === false ? 'text-red-400' : 'text-white'
              }`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="text-[11px] text-neutral-500 font-mono py-4 text-center">Loading {label}…</div>
      )}

      {!isLoading && !!error && (
        <div className="text-[11px] text-neutral-600 font-mono py-4 text-center">No {label} activity</div>
      )}

      {!isLoading && !error && children}
    </div>
  );
}

/* ─── Position rows (one per venue, compact) ──────────────────────── */

function GMXPositionList({ positions, chain }: { positions: GMXPosition[]; chain: string }) {
  if (positions.length === 0) {
    return <div className="text-[11px] text-neutral-600 text-center py-3">No open positions on GMX {chain}</div>;
  }
  return (
    <div>
      {positions.map((p, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            p.isLong ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
          }`}>
            {p.isLong ? 'L' : 'S'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white font-semibold">{p.marketSymbol}</span>
              {p.leverage !== null && (
                <span className="text-[10px] font-mono text-hub-yellow/80 bg-hub-yellow/[0.08] px-1 rounded">{p.leverage.toFixed(1)}×</span>
              )}
            </div>
            <div className="text-[10px] text-neutral-600 font-mono">
              {fmtUSD(p.sizeUsd)} · entry ${p.entryPrice.toLocaleString('en-US', { maximumFractionDigits: p.entryPrice < 1 ? 4 : 2 })}
              {p.livePrice > 0 && <> · now ${p.livePrice.toLocaleString('en-US', { maximumFractionDigits: p.livePrice < 1 ? 4 : 2 })}</>}
            </div>
          </div>
          <div className="text-right whitespace-nowrap">
            <div className={`text-xs font-mono font-semibold tabular-nums ${p.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {p.unrealizedPnl >= 0 ? '+' : ''}{fmtUSD(p.unrealizedPnl)}
            </div>
            <div className={`text-[9px] font-mono tabular-nums ${p.pnlPct >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
              {fmtPct(p.pnlPct)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HLPositionList({ positions }: { positions: HLPosition[] }) {
  if (positions.length === 0) {
    return <div className="text-[11px] text-neutral-600 text-center py-3">No open positions on Hyperliquid</div>;
  }
  return (
    <div>
      {positions.map((p, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            p.isLong ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
          }`}>
            {p.isLong ? 'L' : 'S'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white font-semibold">{p.coin}</span>
              {p.leverage !== null && (
                <span className="text-[10px] font-mono text-hub-yellow/80 bg-hub-yellow/[0.08] px-1 rounded">{p.leverage}×</span>
              )}
              {p.leverageType && <span className="text-[9px] text-neutral-500 uppercase tracking-wider">{p.leverageType}</span>}
            </div>
            <div className="text-[10px] text-neutral-600 font-mono">
              {fmtUSD(p.sizeUsd)} · entry ${p.entryPrice.toLocaleString('en-US', { maximumFractionDigits: p.entryPrice < 1 ? 4 : 2 })}
              {p.liquidationPrice > 0 && <> · liq ${p.liquidationPrice.toLocaleString('en-US', { maximumFractionDigits: p.liquidationPrice < 1 ? 4 : 2 })}</>}
            </div>
          </div>
          <div className="text-right whitespace-nowrap">
            <div className={`text-xs font-mono font-semibold tabular-nums ${p.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {p.unrealizedPnl >= 0 ? '+' : ''}{fmtUSD(p.unrealizedPnl)}
            </div>
            <div className={`text-[9px] font-mono tabular-nums ${p.roePct >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
              {fmtPct(p.roePct)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function TraderUnifiedPage() {
  const params = useParams<{ address: string }>();
  const rawAddress = params?.address || '';
  const address = /^0x[a-fA-F0-9]{40}$/.test(rawAddress) ? rawAddress.toLowerCase() : null;

  const [copied, setCopied] = useState(false);
  const copyAddr = async () => {
    if (!address) return;
    if (await copyToClipboard(address)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Three parallel fetches — GMX Arbitrum, GMX Avalanche, HL. All share
  // the same address. useApi deduplicates via the `enabled` gate.
  const gmxArb = useApi<GMXDossier>({
    key: address ? `trader-gmx-arbitrum-${address}` : null,
    fetcher: async () => {
      const res = await fetch(`/api/gmx-traders/${address}?chain=arbitrum`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!address,
  });

  const gmxAvax = useApi<GMXDossier>({
    key: address ? `trader-gmx-avalanche-${address}` : null,
    fetcher: async () => {
      const res = await fetch(`/api/gmx-traders/${address}?chain=avalanche`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!address,
  });

  const hl = useApi<HLDossier>({
    key: address ? `trader-hl-${address}` : null,
    fetcher: async () => {
      const res = await fetch(`/api/hl-traders/${address}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!address,
  });

  // Auto-log the visit once we know the trader exists. Displayed name from HL
  // (if available) gets stored so the recents strip can show a friendly label.
  useRecordTraderVisit(address, hl.data?.displayName);

  // Batched 30-day daily-PnL sparkline data for GMX Arb + Avax. We hit the
  // batch endpoint once per chain instead of per-trader — it's built to
  // accept a comma-separated address list.
  const gmxArbSpark = useApi<GMXSparklines>({
    key: address ? `spark-arb-${address}` : null,
    fetcher: async () => {
      const res = await fetch(`/api/gmx-traders/sparklines?addresses=${address}&chain=arbitrum&days=30`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!address,
  });

  const gmxAvaxSpark = useApi<GMXSparklines>({
    key: address ? `spark-avax-${address}` : null,
    fetcher: async () => {
      const res = await fetch(`/api/gmx-traders/sparklines?addresses=${address}&chain=avalanche&days=30`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!address,
  });

  // Build the multi-series chart payload — only include venues with real data
  const chartSeries: PnlSeries[] = useMemo(() => {
    if (!address) return [];
    const out: PnlSeries[] = [];
    const hlPnl = hl.data?.history?.pnl;
    if (Array.isArray(hlPnl) && hlPnl.length >= 2) {
      out.push({ label: 'Hyperliquid', color: '#a855f7', points: hlPnl.map(p => p.v) });
    }
    const arbSeries = gmxArbSpark.data?.series?.[address.toLowerCase()];
    if (Array.isArray(arbSeries) && arbSeries.length >= 2 && arbSeries.some(v => v !== 0)) {
      out.push({ label: 'GMX Arbitrum', color: '#28a0f0', points: arbSeries });
    }
    const avaxSeries = gmxAvaxSpark.data?.series?.[address.toLowerCase()];
    if (Array.isArray(avaxSeries) && avaxSeries.length >= 2 && avaxSeries.some(v => v !== 0)) {
      out.push({ label: 'GMX Avalanche', color: '#e84142', points: avaxSeries });
    }
    return out;
  }, [address, hl.data, gmxArbSpark.data, gmxAvaxSpark.data]);

  // Aggregate rollup across all venues
  const rollup = useMemo(() => {
    const openUnrealized =
      (gmxArb.data?.openPositions ?? []).reduce((s, p) => s + p.unrealizedPnl, 0) +
      (gmxAvax.data?.openPositions ?? []).reduce((s, p) => s + p.unrealizedPnl, 0) +
      (hl.data?.openPositions ?? []).reduce((s, p) => s + p.unrealizedPnl, 0);

    const openNotional =
      (gmxArb.data?.openPositions ?? []).reduce((s, p) => s + p.sizeUsd, 0) +
      (gmxAvax.data?.openPositions ?? []).reduce((s, p) => s + p.sizeUsd, 0) +
      (hl.data?.openPositions ?? []).reduce((s, p) => s + p.sizeUsd, 0);

    const lifetimeRealized =
      (gmxArb.data?.summary?.realizedPnl ?? 0) +
      (gmxAvax.data?.summary?.realizedPnl ?? 0) +
      // HL doesn't report a lifetime realized — use allTime window as proxy
      (hl.data?.summary?.performance?.allTime?.pnl ?? 0);

    const accountValue = (hl.data?.summary?.accountValue ?? 0);

    const openPositionCount =
      (gmxArb.data?.openPositions?.length ?? 0) +
      (gmxAvax.data?.openPositions?.length ?? 0) +
      (hl.data?.openPositions?.length ?? 0);

    const venuesActive = [
      (gmxArb.data?.openPositions?.length ?? 0) > 0,
      (gmxAvax.data?.openPositions?.length ?? 0) > 0,
      (hl.data?.openPositions?.length ?? 0) > 0,
    ].filter(Boolean).length;

    return { openUnrealized, openNotional, lifetimeRealized, accountValue, openPositionCount, venuesActive };
  }, [gmxArb.data, gmxAvax.data, hl.data]);

  if (!address) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main className="max-w-[900px] mx-auto w-full px-4 py-10">
          <div className="card-premium p-6 text-center">
            <div className="text-white font-semibold mb-2">Invalid address</div>
            <p className="text-sm text-neutral-500 mb-4">
              This page expects a valid 0x-prefixed 40-character address.
            </p>
            <Link href="/gmx-traders" className="text-hub-yellow text-xs hover:underline">
              ← Back to GMX Traders
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        {/* Back nav */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/gmx-traders"
            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-white"
          >
            <ChevronLeft className="w-3 h-3" /> GMX Traders
          </Link>
          <span className="text-neutral-700">·</span>
          <Link
            href="/hl-traders"
            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-white"
          >
            HL Traders
          </Link>
        </div>

        {/* Header */}
        <div className="card-premium p-4 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-hub-yellow" />
                <h1 className="text-lg font-bold text-white">Cross-Platform Trader</h1>
                {hl.data?.displayName && (
                  <span className="text-sm text-hub-yellow/70 font-semibold">· {hl.data.displayName}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <BookmarkStar
                  address={address}
                  displayName={hl.data?.displayName}
                  venues={[
                    ...(gmxArb.data?.openPositions?.length || gmxArb.data?.summary?.totalTrades ? ['gmx-arbitrum'] : []),
                    ...(gmxAvax.data?.openPositions?.length || gmxAvax.data?.summary?.totalTrades ? ['gmx-avalanche'] : []),
                    ...(hl.data?.openPositions?.length || Object.keys(hl.data?.summary?.performance ?? {}).length ? ['hyperliquid'] : []),
                  ]}
                  size={14}
                />
                <span className="font-mono text-xs text-neutral-300">{address}</span>
                <button onClick={copyAddr} className="text-neutral-500 hover:text-hub-yellow transition-colors" aria-label="Copy address">
                  <Copy className="w-3 h-3" />
                </button>
                {copied && <span className="text-[10px] text-green-400 font-mono">copied</span>}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
                <a href={`https://debank.com/profile/${address}`} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white inline-flex items-center gap-1">
                  DeBank <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span className="text-neutral-700">·</span>
                <a href={`https://arbiscan.io/address/${address}`} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white inline-flex items-center gap-1">
                  Arbiscan <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span className="text-neutral-700">·</span>
                <a href={`https://snowtrace.io/address/${address}`} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white inline-flex items-center gap-1">
                  Snowtrace <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span className="text-neutral-700">·</span>
                {/* "Track wallet" → /wallet-tracker?address=X was dead:
                    /wallet-tracker now 308-redirects to /watch and the
                    query string drops in transit. "Watch positions"
                    below already routes correctly with ?add= which the
                    /watch page consumes. Single CTA, no broken alias. */}
                <Link href={`/watch?add=${address}`} className="text-hub-yellow hover:text-hub-yellow/80 inline-flex items-center gap-1 font-medium">
                  Watch positions (HL + gTrade)
                </Link>
              </div>
            </div>

            {/* Rollup strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
              <div className="bg-white/[0.02] rounded-lg p-2 min-w-[110px]">
                <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Account Value</div>
                <div className="font-mono text-sm tabular-nums text-white font-semibold">{fmtUSD(rollup.accountValue)}</div>
                <div className="text-[9px] text-neutral-600 mt-0.5">HL only</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-2 min-w-[110px]">
                <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Open Notional</div>
                <div className="font-mono text-sm tabular-nums text-white font-semibold">{fmtUSD(rollup.openNotional)}</div>
                <div className="text-[9px] text-neutral-600 mt-0.5">{rollup.openPositionCount} positions</div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-2 min-w-[110px]">
                <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Unrealized</div>
                <div className={`font-mono text-sm tabular-nums font-semibold ${rollup.openUnrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {rollup.openUnrealized >= 0 ? '+' : ''}{fmtUSD(rollup.openUnrealized)}
                </div>
                <div className="text-[9px] text-neutral-600 mt-0.5">
                  {rollup.venuesActive} {rollup.venuesActive === 1 ? 'venue' : 'venues'} active
                </div>
              </div>
              <div className="bg-white/[0.02] rounded-lg p-2 min-w-[110px]">
                <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Lifetime Realized</div>
                <div className={`font-mono text-sm tabular-nums font-semibold ${rollup.lifetimeRealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {rollup.lifetimeRealized >= 0 ? '+' : ''}{fmtUSD(rollup.lifetimeRealized)}
                </div>
                <div className="text-[9px] text-neutral-600 mt-0.5">3-venue sum</div>
              </div>
            </div>
          </div>
        </div>

        {/* Historical PnL chart — only shown when we have ≥1 venue with data */}
        {chartSeries.length > 0 && (
          <div className="card-premium p-4 mb-4">
            <TraderHistoryChart series={chartSeries} height={200} days={30} />
          </div>
        )}

        {/* Three venue sections — active venues render full-size, empty venues
            collapse to compact rows stacked below so they don't waste half the
            viewport when a wallet is single-venue. */}
        {(() => {
          const arbActive = !!gmxArb.data && (gmxArb.data.openPositions.length > 0 || gmxArb.data.summary.totalTrades > 0);
          const avaxActive = !!gmxAvax.data && (gmxAvax.data.openPositions.length > 0 || gmxAvax.data.summary.totalTrades > 0);
          const hlActive = !!hl.data && (hl.data.openPositions.length > 0 || Object.keys(hl.data.summary.performance ?? {}).length > 0);

          const renderArb = (compact = false) => (
            <VenueSection
              label="GMX V2 · Arbitrum"
              accent="#28a0f0"
              href={`https://app.gmx.io/#/accounts/${address}?network=arbitrum&v=2`}
              explorerUrl={`https://arbiscan.io/address/${address}`}
              isLoading={gmxArb.isLoading}
              error={gmxArb.error}
              hasActivity={arbActive}
              compactWhenEmpty={compact}
              stats={gmxArb.data && arbActive ? [
                { label: 'Realized PnL', value: fmtUSD(gmxArb.data.summary.realizedPnl), positive: gmxArb.data.summary.realizedPnl >= 0 },
                { label: 'Volume', value: fmtUSD(gmxArb.data.summary.volume) },
                { label: 'Win Rate', value: `${gmxArb.data.summary.winRate.toFixed(1)}%` },
                { label: 'Trades', value: `${gmxArb.data.summary.totalTrades}` },
              ] : undefined}
            >
              <GMXPositionList positions={gmxArb.data?.openPositions ?? []} chain="Arbitrum" />
            </VenueSection>
          );

          const renderAvax = (compact = false) => (
            <VenueSection
              label="GMX V2 · Avalanche"
              accent="#e84142"
              href={`https://app.gmx.io/#/accounts/${address}?network=avalanche&v=2`}
              explorerUrl={`https://snowtrace.io/address/${address}`}
              isLoading={gmxAvax.isLoading}
              error={gmxAvax.error}
              hasActivity={avaxActive}
              compactWhenEmpty={compact}
              stats={gmxAvax.data && avaxActive ? [
                { label: 'Realized PnL', value: fmtUSD(gmxAvax.data.summary.realizedPnl), positive: gmxAvax.data.summary.realizedPnl >= 0 },
                { label: 'Volume', value: fmtUSD(gmxAvax.data.summary.volume) },
                { label: 'Win Rate', value: `${gmxAvax.data.summary.winRate.toFixed(1)}%` },
                { label: 'Trades', value: `${gmxAvax.data.summary.totalTrades}` },
              ] : undefined}
            >
              <GMXPositionList positions={gmxAvax.data?.openPositions ?? []} chain="Avalanche" />
            </VenueSection>
          );

          const renderHL = (compact = false) => (
            <VenueSection
              label="Hyperliquid"
              accent="#a855f7"
              href={`https://app.hyperliquid.xyz/address/${address}`}
              explorerUrl={null}
              isLoading={hl.isLoading}
              error={hl.error}
              hasActivity={hlActive}
              compactWhenEmpty={compact}
              stats={hl.data && hlActive ? [
                { label: 'Account Value', value: fmtUSD(hl.data.summary.accountValue) },
                { label: 'All-Time PnL', value: fmtUSD(hl.data.summary.performance.allTime?.pnl ?? 0), positive: (hl.data.summary.performance.allTime?.pnl ?? 0) >= 0 },
                { label: '30D PnL', value: fmtUSD(hl.data.summary.performance.month?.pnl ?? 0), positive: (hl.data.summary.performance.month?.pnl ?? 0) >= 0 },
                { label: 'Margin Used', value: fmtUSD(hl.data.summary.marginUsed) },
              ] : undefined}
            >
              <HLPositionList positions={hl.data?.openPositions ?? []} />
            </VenueSection>
          );

          const activeRenderers: React.ReactNode[] = [];
          const emptyRenderers: React.ReactNode[] = [];
          if (arbActive || gmxArb.isLoading) activeRenderers.push(<div key="arb">{renderArb(false)}</div>);
          else emptyRenderers.push(<div key="arb-empty">{renderArb(true)}</div>);
          if (avaxActive || gmxAvax.isLoading) activeRenderers.push(<div key="avax">{renderAvax(false)}</div>);
          else emptyRenderers.push(<div key="avax-empty">{renderAvax(true)}</div>);
          if (hlActive || hl.isLoading) activeRenderers.push(<div key="hl">{renderHL(false)}</div>);
          else emptyRenderers.push(<div key="hl-empty">{renderHL(true)}</div>);

          // Grid columns adapt to how many venues are actually active.
          // 1 active → single column full-width, 2 → two columns, 3 → three.
          const activeCount = activeRenderers.length;
          const gridCls = activeCount >= 3
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'
            : activeCount === 2
              ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
              : 'grid grid-cols-1 gap-3';

          return (
            <>
              <div className={gridCls}>
                {activeRenderers}
              </div>
              {emptyRenderers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                  {emptyRenderers}
                </div>
              )}
            </>
          );
        })()}

        {/* Footer meta */}
        <div className="mt-4 flex items-center gap-3 text-[10px] text-neutral-600 font-mono flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Activity className="w-2.5 h-2.5" /> Pulled in parallel from GMX V2 subgraphs + Hyperliquid mainnet
          </span>
          <span>·</span>
          <span>Auto-refreshes every 60s</span>
        </div>
      </main>

      <Footer />
    </div>
  );
}
