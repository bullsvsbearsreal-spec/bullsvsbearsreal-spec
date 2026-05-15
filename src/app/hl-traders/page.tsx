'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import BookmarkStar from '@/components/BookmarkStar';
import UsdDisplay from '@/components/UsdDisplay';
import Link from 'next/link';
import {
  Trophy, Activity, ArrowLeftRight, ExternalLink, Copy, ChevronRight, X,
  Flame, Target, Zap, Download, Search, Layers, Eye,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/copyToClipboard';
import { useTraderBookmarks } from '@/hooks/useTraderBookmarks';

/* ─── Types ──────────────────────────────────────────────────────── */

type Period = 'day' | 'week' | 'month' | 'allTime';
type SortKey = 'pnl' | 'volume' | 'roi';

interface HLTrader {
  address: string;
  displayName: string | null;
  accountValue: number;
  pnl: number;
  volume: number;
  roi: number;
  prize: number;
}

interface HLResponse {
  data: HLTrader[];
  summary: {
    traderCount: number;
    displayedCount?: number;
    totalPnl: number;
    totalVolume: number;
    winners: number;
    losers: number;
    eligibleCount: number;
  };
  meta: { period: string; sort: string; totalRaw: number; timestamp: number };
}

interface HLPosition {
  coin: string;
  isLong: boolean;
  size: number;
  sizeUsd: number;
  entryPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  roePct: number;
  leverage: number | null;
  leverageType: 'cross' | 'isolated' | null;
  marginUsed: number;
  maxLeverage: number | null;
}

interface HLHistoryPoint { t: number; v: number }
interface HLHistory {
  window: string;
  pnl: HLHistoryPoint[];
  accountValue: HLHistoryPoint[];
  vlm: number;
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
  history: HLHistory | null;
}

const PERIOD_OPTIONS: { id: Period; label: string; hint: string }[] = [
  { id: 'day',     label: '1D',  hint: 'Last 24 hours (press 1)' },
  { id: 'week',    label: '7D',  hint: 'Last 7 days (press 2)' },
  { id: 'month',   label: '30D', hint: 'Last 30 days (press 3)' },
  { id: 'allTime', label: 'All', hint: 'Lifetime PnL (press 4)' },
];

const SORT_OPTIONS: { id: SortKey; label: string; hint: string }[] = [
  { id: 'pnl',    label: 'Top PnL',    hint: 'Highest PnL in window' },
  { id: 'volume', label: 'Top Volume', hint: 'Most traded notional' },
  { id: 'roi',    label: 'Top ROI',    hint: 'Highest % return' },
];

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

function exportCSV(traders: HLTrader[], period: string): void {
  const headers = ['rank', 'address', 'display_name', 'account_value_usd', 'window_pnl_usd', 'window_volume_usd', 'window_roi_pct', 'prize'];
  const escape = (v: string | number | null): string => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = traders.map((t, i) => [
    i + 1, t.address, t.displayName ?? '',
    t.accountValue.toFixed(2), t.pnl.toFixed(2), t.volume.toFixed(2), t.roi.toFixed(2), t.prize,
  ].map(escape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hl-traders-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─── PnL area chart for drawer ────────────────────────────────── */

/**
 * Full-width area chart for a single trader's cumulative PnL series.
 * Pure SVG, no deps. Shows latest value, start→end delta, and a dashed
 * zero-line when the series crosses breakeven.
 */
function PnLChart({
  points,
  window,
  height = 90,
}: {
  points: HLHistoryPoint[];
  window: string;
  height?: number;
}) {
  if (!points || points.length < 2) {
    return <div className="h-[90px] flex items-center justify-center text-[10px] text-neutral-600 font-mono">No history in this window</div>;
  }
  const values = points.map(p => p.v);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const first = values[0];
  const last = values[values.length - 1];
  const netChange = last - first;
  const isUp = netChange >= 0;
  const stroke = isUp ? '#22c55e' : '#ef4444';
  const fill = isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';

  // Use viewBox-based rendering — ResponsiveSVG-style. Dense points.
  const W = 300;
  const H = height - 18; // reserve top 18px for label
  const step = values.length > 1 ? W / (values.length - 1) : 0;
  const y = (v: number) => H - ((v - min) / range) * H;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `0,${H} ${pts} ${W},${H}`;
  const zeroY = y(0);

  const windowLabel = window === 'allTime' ? 'All time' :
    window === 'month' ? 'Last 30 days' :
    window === 'week' ? 'Last 7 days' :
    window === 'day' ? 'Last 24 hours' : window;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
          PnL · {windowLabel}
        </span>
        <span className={`text-[11px] font-mono font-bold tabular-nums ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {netChange >= 0 ? '+' : ''}{fmtUSD(netChange)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden>
        <polygon points={area} fill={fill} />
        {min < 0 && max > 0 && (
          <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="rgba(148,163,184,0.25)" strokeDasharray="3,3" strokeWidth={0.6} />
        )}
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.4} />
      </svg>
    </div>
  );
}

/* ─── Summary strip ────────────────────────────────────────────── */

function SummaryStrip({ summary }: { summary: HLResponse['summary'] }) {
  // Winners/losers computed across the entire eligible pool (pre-slice) so
  // the ratio reflects true market breadth — not just the sort order of the
  // displayed top-N.
  const total = summary.winners + summary.losers;
  const winPct = total > 0 ? (summary.winners / total) * 100 : 0;
  const items: Array<{ label: string; value: React.ReactNode; positive?: boolean }> = [
    { label: 'Total PnL', value: <UsdDisplay amount={summary.totalPnl} />, positive: summary.totalPnl >= 0 },
    { label: 'Total Volume', value: <UsdDisplay amount={summary.totalVolume} /> },
    { label: 'In Window', value: summary.eligibleCount.toLocaleString() },
    {
      label: `${winPct.toFixed(0)}% profitable`,
      value: `${summary.winners.toLocaleString()} / ${summary.losers.toLocaleString()}`,
    },
    { label: 'Avg PnL', value: <UsdDisplay amount={summary.traderCount ? summary.totalPnl / summary.traderCount : 0} /> },
  ];
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Hyperliquid Traders summary statistics — updates every 60 seconds"
    >
      {items.map(it => (
        <div key={it.label} className="card-premium p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">{it.label}</div>
          <div className={`font-mono tabular-nums text-sm font-semibold ${
            it.positive === true ? 'text-green-400' : it.positive === false ? 'text-red-400' : 'text-white'
          }`}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Rows ─────────────────────────────────────────────────────── */

function TraderRow({
  t,
  rank,
  onClick,
  isSelected,
}: {
  t: HLTrader;
  rank: number;
  onClick: () => void;
  isSelected: boolean;
}) {
  const pnlColor = t.pnl > 0 ? 'text-green-400' : t.pnl < 0 ? 'text-red-400' : 'text-neutral-400';
  const roiColor = t.roi > 0 ? 'text-green-400/80' : t.roi < 0 ? 'text-red-400/80' : 'text-neutral-500';
  const rankClass = rank <= 3 ? 'rank-number-top' : '';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rank-row hover:bg-white/[0.04] transition-colors ${
        isSelected ? 'bg-hub-yellow/[0.06] border-l-2 border-hub-yellow' : ''
      }`}
      aria-label={`View HL positions for ${t.displayName ?? shortAddr(t.address)}`}
    >
      <span className={`rank-number ${rankClass}`}>{rank}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Inline bookmark — matches the /gmx-traders leaderboard so
              users can star a trader without clicking through to the
              dossier card. Snake's flow lives across both venues. */}
          <BookmarkStar
            address={t.address}
            displayName={t.displayName}
            venues={['hyperliquid']}
            size={13}
          />
          {t.displayName ? (
            <span className="text-white text-xs font-semibold truncate">{t.displayName}</span>
          ) : (
            <span className="font-mono text-xs text-white font-medium">{shortAddr(t.address)}</span>
          )}
          {rank === 1 && <Trophy className="w-3 h-3 text-hub-yellow flex-shrink-0" />}
          {t.pnl >= 1_000_000 && <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" aria-label=">$1M PnL window" />}
          {t.prize > 0 && <Target className="w-3 h-3 text-green-400 flex-shrink-0" aria-label={`Prize: $${t.prize}`} />}
        </div>
        <div className="text-[10px] text-neutral-600 font-mono truncate">
          {t.displayName ? shortAddr(t.address) + ' · ' : ''}acct {fmtUSD(t.accountValue)}
        </div>
      </div>

      <div className="text-right w-[100px] md:w-[120px]">
        <div className={`font-mono font-bold text-sm tabular-nums ${pnlColor}`}>
          {fmtUSD(t.pnl)}
        </div>
        <div className={`text-[9px] font-mono tabular-nums ${roiColor}`}>
          {fmtPct(t.roi)}
        </div>
      </div>

      <div className="text-right w-[90px] hidden md:block">
        <div className="font-mono text-xs text-white tabular-nums">{fmtUSD(t.volume)}</div>
        <div className="text-[9px] text-neutral-600 font-mono tabular-nums">volume</div>
      </div>

      <ChevronRight className="w-3 h-3 text-neutral-600 flex-shrink-0" />
    </button>
  );
}

function PositionRow({ p }: { p: HLPosition }) {
  const pnlColor = p.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400';
  const roeColor = p.roePct >= 0 ? 'text-green-400/70' : 'text-red-400/70';
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
        p.isLong ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
      }`}>
        {p.isLong ? 'LONG' : 'SHORT'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white font-semibold truncate">{p.coin}</span>
          {p.leverage !== null && (
            <span className="text-[10px] font-mono text-hub-yellow/80 bg-hub-yellow/[0.08] px-1 rounded">
              {p.leverage}×
            </span>
          )}
          {p.leverageType && (
            <span className="text-[9px] text-neutral-500 uppercase tracking-wider">{p.leverageType}</span>
          )}
        </div>
        <div className="text-[10px] text-neutral-600 font-mono truncate">
          {fmtUSD(p.sizeUsd)} · entry ${p.entryPrice.toLocaleString('en-US', { maximumFractionDigits: p.entryPrice < 1 ? 4 : 2 })}
          {p.liquidationPrice > 0 && (
            <> · liq ${p.liquidationPrice.toLocaleString('en-US', { maximumFractionDigits: p.liquidationPrice < 1 ? 4 : 2 })}</>
          )}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <div className={`text-xs font-mono font-semibold ${pnlColor} tabular-nums`}>
          {p.unrealizedPnl >= 0 ? '+' : ''}{fmtUSD(p.unrealizedPnl)}
        </div>
        <div className={`text-[9px] font-mono tabular-nums ${roeColor}`}>
          {fmtPct(p.roePct)}
        </div>
      </div>
    </div>
  );
}

/* ─── Drawer ───────────────────────────────────────────────────── */

function TraderDrawer({ address, onClose }: { address: string; onClose: () => void }) {
  const { data, isLoading, error } = useApi<HLDossier>({
    key: `hl-trader-${address}`,
    fetcher: async () => {
      const res = await fetch(`/api/hl-traders/${address}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 30_000,
  });

  const [copied, setCopied] = useState(false);
  const copyAddr = async () => {
    if (await copyToClipboard(address)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="card-premium p-4 h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BookmarkStar address={address} displayName={data?.displayName} venues={['hyperliquid']} size={14} />
            <span className="font-mono text-sm text-white font-bold truncate">
              {data?.displayName || shortAddr(address)}
            </span>
            <button onClick={copyAddr} className="text-neutral-500 hover:text-hub-yellow transition-colors" aria-label="Copy address">
              <Copy className="w-3 h-3" />
            </button>
            {copied && <span className="text-[9px] text-green-400 font-mono">copied</span>}
          </div>
          {data?.displayName && (
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{shortAddr(address)}</div>
          )}
          <div className="flex items-center gap-3 mt-1">
            <a
              href={`https://app.hyperliquid.xyz/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-hub-yellow/70 hover:text-hub-yellow"
            >
              Hyperliquid <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <span className="text-neutral-700">·</span>
            <Link
              href={`/trader/${address}`}
              className="inline-flex items-center gap-1 text-[10px] text-hub-yellow/70 hover:text-hub-yellow font-semibold"
              title="Cross-platform view including GMX positions"
            >
              Cross-Platform <ChevronRight className="w-2.5 h-2.5" />
            </Link>
            <span className="text-neutral-700">·</span>
            <a
              href={`https://debank.com/profile/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white"
            >
              DeBank <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
        <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors p-1" aria-label="Close drawer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-neutral-500 text-xs">Loading dossier…</div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center text-xs text-red-400">Failed to load</div>
      )}

      {data && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white/[0.02] rounded-lg p-2">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1">Account Value</div>
              <div className="font-mono font-bold text-sm tabular-nums text-white">{fmtUSD(data.summary.accountValue)}</div>
              <div className="text-[9px] text-neutral-600 mt-0.5 font-mono">
                {fmtUSD(data.summary.withdrawable)} withdrawable
              </div>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-2">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1">Unrealized</div>
              <div className={`font-mono font-bold text-sm tabular-nums ${
                data.summary.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {data.summary.unrealizedPnl >= 0 ? '+' : ''}{fmtUSD(data.summary.unrealizedPnl)}
              </div>
              <div className="text-[9px] text-neutral-600 mt-0.5 font-mono">
                margin {fmtUSD(data.summary.marginUsed)}
              </div>
            </div>
          </div>

          {/* PnL area chart — shows actual trajectory, not just window totals */}
          {data.history && data.history.pnl.length >= 2 && (
            <div className="bg-white/[0.02] rounded-lg p-2.5 mb-3">
              <PnLChart points={data.history.pnl} window={data.history.window} />
            </div>
          )}

          {/* Window performance strip */}
          {data.summary.performance && Object.keys(data.summary.performance).length > 0 && (
            <div className="bg-white/[0.02] rounded-lg p-2 mb-3">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1.5 font-semibold">Window PnL</div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['day', 'week', 'month', 'allTime'] as const).map(win => {
                  const p = data.summary.performance[win];
                  if (!p) return null;
                  const color = p.pnl > 0 ? 'text-green-400' : p.pnl < 0 ? 'text-red-400' : 'text-neutral-500';
                  return (
                    <div key={win} className="text-center">
                      <div className="text-[8px] text-neutral-600 uppercase tracking-wider">
                        {win === 'allTime' ? 'All' : win === 'day' ? '1D' : win === 'week' ? '7D' : '30D'}
                      </div>
                      <div className={`text-[10px] font-mono font-bold tabular-nums ${color}`}>
                        {p.pnl >= 0 ? '+' : ''}{fmtUSD(p.pnl)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Open positions */}
          <div className="flex-1 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
              Open Positions ({data.openPositions.length})
            </div>
            {data.openPositions.length === 0 ? (
              <div className="text-neutral-500 text-xs text-center py-6">No open positions — trader is flat</div>
            ) : (
              <div>
                {data.openPositions.map((p, i) => <PositionRow key={`${p.coin}-${i}`} p={p} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function HLTradersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { bookmarks } = useTraderBookmarks();
  const initialSort = (searchParams.get('sort') as SortKey) || 'pnl';
  const initialPeriod = (searchParams.get('period') as Period) || 'week';

  const [sort, setSort] = useState<SortKey>(initialSort);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lookupAddr, setLookupAddr] = useState('');

  // URL state sync — makes leaderboard views shareable
  useEffect(() => {
    const q = new URLSearchParams();
    if (period !== 'week') q.set('period', period);
    if (sort !== 'pnl') q.set('sort', sort);
    const qs = q.toString();
    window.history.replaceState(null, '', qs ? `/hl-traders?${qs}` : '/hl-traders');
  }, [period, sort]);

  const handleLookup = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lookupAddr.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      router.push(`/trader/${trimmed}`);
    }
  }, [lookupAddr, router]);

  // Keyboard shortcuts — 1..4 for period pills
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map: Record<string, Period> = { '1': 'day', '2': 'week', '3': 'month', '4': 'allTime' };
      if (map[e.key]) {
        e.preventDefault();
        setPeriod(map[e.key]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { data, isLoading, isRefreshing, error, refresh } = useApi<HLResponse>({
    key: `hl-traders:${period}:${sort}`,
    fetcher: async () => {
      const res = await fetch(`/api/hl-traders?period=${period}&sort=${sort}&limit=100`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.data;
    return data.data.filter(t =>
      t.address.toLowerCase().includes(q) ||
      (t.displayName ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Hyperliquid Traders</h1>
            <span className="text-xs text-neutral-500 font-mono">Hyperliquid Mainnet</span>
            <div className="ml-auto flex items-center gap-1.5">
              {/* Watchlist quick-jump — mirrors /gmx-traders. Bookmarks
                  are venue-agnostic so the same chip appears here. */}
              {bookmarks.length > 0 && (
                <Link
                  href="/trader-watch"
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-hub-yellow/10 border border-hub-yellow/30 text-hub-yellow hover:bg-hub-yellow/20 transition-colors text-[11px] font-semibold"
                  title="View bookmarked traders' open positions"
                >
                  <Eye className="w-3 h-3" />
                  Watchlist
                  <span className="font-mono opacity-80">{bookmarks.length}</span>
                </Link>
              )}
              <DataFreshness
                exchangeCount={1}
                lastUpdated={data?.meta?.timestamp ?? null}
                sources={['Hyperliquid']}
              />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Top Hyperliquid perp traders by window PnL. Click any row to inspect their live positions, leverage, and liquidation prices.
          </p>

          {/* Address lookup — cross-platform view */}
          <form onSubmit={handleLookup} className="mt-3 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600 pointer-events-none" />
              <input
                type="text"
                value={lookupAddr}
                onChange={e => setLookupAddr(e.target.value)}
                placeholder="Paste any 0x… address for cross-platform view"
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/40 font-mono"
                aria-label="Lookup trader address"
              />
            </div>
            <button
              type="submit"
              disabled={!/^0x[a-fA-F0-9]{40}$/.test(lookupAddr.trim())}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-hub-yellow/15 text-hub-yellow hover:bg-hub-yellow/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <Layers className="w-3 h-3" /> Lookup
            </button>
          </form>
        </div>

        {data?.summary && <SummaryStrip summary={data.summary} />}

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <div className="flex items-center gap-1 flex-wrap bg-white/[0.03] rounded-lg p-0.5">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                title={opt.hint}
                className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${
                  period === opt.id
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                title={opt.hint}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sort === opt.id
                    ? 'bg-hub-yellow/15 text-hub-yellow'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="md:ml-auto flex items-center gap-2">
            <input
              type="text"
              placeholder="Search address or name"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full md:w-64 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/[0.12]"
            />
            <button
              onClick={() => { if (data?.data) exportCSV(data.data, period); }}
              disabled={!data?.data?.length}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap"
              aria-label="Export leaderboard as CSV"
              title="Download current leaderboard as CSV"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-4">
          <div className="card-premium p-3 min-h-[600px]">
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <span className="w-6">#</span>
              <span className="flex-1">Trader</span>
              <span className="text-right w-[100px] md:w-[120px]">PnL / ROI</span>
              <span className="text-right w-[90px] hidden md:block">Volume</span>
              <span className="w-3" />
            </div>

            {isLoading && (
              <div className="space-y-1.5 p-1">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />
                ))}
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <p className="text-red-400 text-sm mb-2">Failed to load leaderboard</p>
                <p className="text-xs text-neutral-500">{String(error)}</p>
              </div>
            )}

            {!isLoading && filtered.length === 0 && !error && (
              <div className="text-center py-12 text-neutral-500 text-sm">No traders match your search.</div>
            )}

            <div className="ranked-list">
              {filtered.map((t, i) => (
                <TraderRow
                  key={t.address}
                  t={t}
                  rank={i + 1}
                  onClick={() => setSelectedAddress(t.address)}
                  isSelected={selectedAddress === t.address}
                />
              ))}
            </div>
          </div>

          <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
            {selectedAddress ? (
              <TraderDrawer address={selectedAddress} onClose={() => setSelectedAddress(null)} />
            ) : (
              <div className="card-premium p-6 h-full flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
                  <ArrowLeftRight className="w-4 h-4 text-neutral-500" />
                </div>
                <div className="text-sm text-neutral-400 font-medium mb-1">Select a trader</div>
                <div className="text-xs text-neutral-600">Click any row to inspect live positions, leverage, and margin.</div>
              </div>
            )}
          </aside>
        </div>

        <div className="mt-4 flex items-center gap-3 text-[10px] text-neutral-600 font-mono">
          <span className="inline-flex items-center gap-1">
            <Activity className="w-2.5 h-2.5" /> Data from Hyperliquid public stats feed
          </span>
          <span>·</span>
          <span>{data?.meta?.totalRaw?.toLocaleString() ?? '—'} accounts scanned</span>
          <span>·</span>
          <a
            href="https://app.hyperliquid.xyz/leaderboard"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-hub-yellow inline-flex items-center gap-1"
          >
            HL official <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
