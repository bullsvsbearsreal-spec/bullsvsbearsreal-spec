'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import BookmarkStar from '@/components/BookmarkStar';
import { useTraderBookmarks } from '@/hooks/useTraderBookmarks';
import UsdDisplay from '@/components/UsdDisplay';
import Link from 'next/link';
import {
  Trophy, Activity, ArrowLeftRight,
  ExternalLink, Copy, ChevronRight, X, Flame, Target,
  Download, Search, Layers, Eye,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/copyToClipboard';

/* ─── Types ──────────────────────────────────────────────────────── */

interface GMXTrader {
  address: string;
  realizedPnl: number;
  volume: number;
  wins: number;
  losses: number;
  totalTrades: number;
  winRate: number;
  closedCount: number;
  netCapital: number;
  maxCapital: number;
  realizedFees: number;
  cumsumSize: number;
  avgTradeSize: number;
  roi: number;
  profitFactor: number;
}

interface TraderResponse {
  data: GMXTrader[];
  summary: {
    traderCount: number;
    displayedCount?: number;
    totalPnl: number;
    totalVolume: number;
    avgWinRate: number;
    winners: number;
    losers: number;
  };
  meta: { sort: string; limit: number; timestamp: number };
}

interface OpenPosition {
  positionKey: string;
  market: string;
  marketSymbol: string;
  marketName: string;
  marketPair: string;
  marketDeprecated: boolean;
  isLong: boolean;
  sizeUsd: number;
  entryPrice: number;
  livePrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  pnlPct: number;
  realizedFees: number;
  leverage: number | null;
  openedAt: number | null;
}

interface RecentTrade {
  positionKey: string;
  market: string;
  marketSymbol: string;
  isLong: boolean;
  sizeUsd: number;
  executionPrice: number;
  pnl: number;
  fees: number;
  netPnl: number;
  pnlPct: number;
  timestamp: number;
}

interface TraderDossier {
  address: string;
  summary: {
    realizedPnl: number;
    unrealizedPnl: number;
    volume: number;
    wins: number;
    losses: number;
    totalTrades: number;
    winRate: number;
    closedCount: number;
    maxCapital: number;
    realizedFees: number;
  };
  openPositions: OpenPosition[];
  recentTrades: RecentTrade[];
}

type SortKey = 'pnl' | 'volume' | 'winrate' | 'volume_weighted';
type Period = 'total' | '7d' | '30d';
type Chain = 'arbitrum' | 'avalanche';

interface MarketOption {
  address: string;
  symbol: string;
  fullName: string;
  pair: string;
}

const CHAIN_OPTIONS: { id: Chain; label: string; accent: string; explorer: string }[] = [
  { id: 'arbitrum',  label: 'Arbitrum',  accent: '#28a0f0', explorer: 'arbiscan.io' },
  { id: 'avalanche', label: 'Avalanche', accent: '#e84142', explorer: 'snowtrace.io' },
];

const SORT_OPTIONS: { id: SortKey; label: string; hint: string }[] = [
  { id: 'pnl',              label: 'Top PnL',        hint: 'Highest realized profit' },
  { id: 'volume_weighted',  label: 'Quality',        hint: 'PnL × log(volume) — edge and size' },
  { id: 'volume',           label: 'Top Volume',     hint: 'Most notional traded' },
  { id: 'winrate',          label: 'Win Rate',       hint: 'Highest hit rate' },
];

const PERIOD_OPTIONS: { id: Period; label: string; hint: string }[] = [
  { id: '7d',    label: '7D',        hint: 'Rolling last 7 days (press 1)' },
  { id: '30d',   label: '30D',       hint: 'Rolling last 30 days (press 2)' },
  { id: 'total', label: 'All Time',  hint: 'Cumulative lifetime stats (press 3)' },
];

/* ─── Format helpers ─────────────────────────────────────────────── */

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

/**
 * Tiny inline sparkline. Takes an array of cumulative-PnL values and draws
 * them as an SVG polyline. Positive trend = green, negative = red.
 * Filled area below the line for visual density at 16x48 px.
 */
function Sparkline({
  values,
  width = 56,
  height = 18,
}: { values: number[]; width?: number; height?: number }) {
  if (!values || values.length < 2) {
    return <div className="w-[56px] h-[18px]" aria-hidden />;
  }
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const y = (v: number) => height - ((v - min) / range) * height;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values[values.length - 1];
  const first = values[0];
  const isUp = last >= first;
  const stroke = isUp ? '#22c55e' : '#ef4444';
  const fill = isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  const area = `0,${height} ${pts} ${width},${height}`;
  const zeroY = y(0);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polygon points={area} fill={fill} />
      {/* Zero line if the series crosses it */}
      {min < 0 && max > 0 && (
        <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="rgba(148,163,184,0.2)" strokeDasharray="2,2" strokeWidth={0.5} />
      )}
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.25} />
    </svg>
  );
}

function exportCSV(traders: GMXTrader[], period: string, chain: string): void {
  const headers = [
    'rank', 'address', 'realized_pnl_usd', 'volume_usd', 'win_rate_pct',
    'wins', 'losses', 'total_trades', 'closed_count', 'avg_trade_size_usd',
    'max_capital_usd', 'fees_paid_usd', 'roi_pct',
  ];
  const escape = (v: string | number): string => {
    const s = String(v);
    // Only quote if contains comma/newline/quote — keeps file readable
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = traders.map((t, i) => [
    i + 1,
    t.address,
    t.realizedPnl.toFixed(2),
    t.volume.toFixed(2),
    t.winRate.toFixed(2),
    t.wins,
    t.losses,
    t.totalTrades,
    t.closedCount,
    t.avgTradeSize.toFixed(2),
    t.maxCapital.toFixed(2),
    t.realizedFees.toFixed(2),
    t.roi.toFixed(2),
  ].map(escape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `gmx-traders-${chain}-${period}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timeAgo(tsSec: number): string {
  if (!tsSec) return '—';
  const seconds = Math.floor(Date.now() / 1000) - tsSec;
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ─── Summary strip ──────────────────────────────────────────────── */

function SummaryStrip({ summary }: { summary: TraderResponse['summary'] }) {
  // winners/losers come from the full eligible pool (before slicing to top-N)
  // so the ratio actually reflects market breadth instead of always reading
  // "100 / 0" whenever the user sorts by Top PnL descending.
  const total = summary.winners + summary.losers;
  const winPct = total > 0 ? (summary.winners / total) * 100 : 0;
  const items: Array<{ label: string; value: React.ReactNode; positive?: boolean }> = [
    { label: 'Total PnL', value: <UsdDisplay amount={summary.totalPnl} />, positive: summary.totalPnl >= 0 },
    { label: 'Total Volume', value: <UsdDisplay amount={summary.totalVolume} /> },
    { label: 'Traders', value: summary.traderCount.toLocaleString() },
    { label: 'Avg Win Rate', value: `${summary.avgWinRate.toFixed(1)}%` },
    {
      label: `${winPct.toFixed(0)}% profitable`,
      value: `${summary.winners.toLocaleString()} / ${summary.losers.toLocaleString()}`,
    },
  ];
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
      aria-live="polite"
      aria-atomic="false"
      aria-label="GMX Traders summary statistics — updates every 60 seconds"
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

/* ─── Trader row ─────────────────────────────────────────────────── */

function TraderRow({
  t,
  rank,
  onClick,
  isSelected,
  spark,
  chain,
}: {
  t: GMXTrader;
  rank: number;
  onClick: () => void;
  isSelected: boolean;
  spark?: number[];
  chain: 'arbitrum' | 'avalanche';
}) {
  const pnlColor = t.realizedPnl > 0 ? 'text-green-400' : t.realizedPnl < 0 ? 'text-red-400' : 'text-neutral-400';
  const wrColor = t.winRate >= 60 ? 'text-green-400' : t.winRate >= 45 ? 'text-yellow-400' : 'text-red-400';
  const rankClass = rank <= 3 ? 'rank-number-top' : '';

  // ROI is misleading when capital base is tiny (GMX accounting has edge
  // cases with frequent deposits/withdrawals that make maxCapital too low).
  // Show "—" below $5k max capital or when |ROI| exceeds 1000%.
  const roiMeaningful = t.maxCapital >= 5_000 && Math.abs(t.roi) < 1000;
  const roiColor = t.roi > 0 ? 'text-green-400/80' : t.roi < 0 ? 'text-red-400/80' : 'text-neutral-500';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rank-row hover:bg-white/[0.04] transition-colors ${
        isSelected ? 'bg-hub-yellow/[0.06] border-l-2 border-hub-yellow' : ''
      }`}
      aria-label={`View positions for trader ${shortAddr(t.address)}`}
    >
      <span className={`rank-number ${rankClass}`}>{rank}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Inline bookmark — was tucked inside the dossier card so the
              user had to click into a trader to bookmark them. Snake's
              flow ("scan leaderboard, star the interesting ones, open
              /trader-watch") wants one click here, not two. The
              BookmarkStar already stopPropagation's so it doesn't also
              fire the row's onClick. */}
          <BookmarkStar
            address={t.address}
            venues={[`gmx-${chain}`]}
            size={13}
          />
          <span className="font-mono text-xs text-white font-medium">{shortAddr(t.address)}</span>
          {rank === 1 && <Trophy className="w-3 h-3 text-hub-yellow" />}
          {t.winRate >= 85 && t.totalTrades >= 50 && <Target className="w-3 h-3 text-green-400" aria-label="Sniper" />}
          {t.realizedPnl >= 1_000_000 && <Flame className="w-3 h-3 text-orange-400" aria-label=">$1M PnL" />}
        </div>
        <div className="text-[10px] text-neutral-600 mt-0.5">
          {t.totalTrades} trades · avg {fmtUSD(t.avgTradeSize)}
        </div>
      </div>

      {/* Sparkline — 30 day cumulative PnL trajectory */}
      <div className="hidden sm:flex items-center w-[60px] flex-shrink-0" aria-hidden>
        {spark && spark.length >= 2 ? <Sparkline values={spark} /> : <div className="w-[56px] h-[18px]" />}
      </div>

      {/* PnL */}
      <div className="text-right w-[100px] md:w-[120px]">
        <div className={`font-mono font-bold text-sm tabular-nums ${pnlColor}`}>
          {fmtUSD(t.realizedPnl)}
        </div>
        <div
          className={`text-[9px] font-mono tabular-nums ${roiMeaningful ? roiColor : 'text-neutral-700'}`}
          title={roiMeaningful ? `ROI vs $${t.maxCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })} max capital` : 'Max capital too small for meaningful ROI'}
        >
          ROI {roiMeaningful ? fmtPct(t.roi) : '—'}
        </div>
      </div>

      {/* Volume */}
      <div className="text-right w-[90px] hidden md:block">
        <div className="font-mono text-xs text-white tabular-nums">{fmtUSD(t.volume)}</div>
        <div className="text-[9px] text-neutral-600 font-mono tabular-nums">volume</div>
      </div>

      {/* Win Rate */}
      <div className="text-right w-[70px] hidden md:block">
        <div className={`font-mono text-xs tabular-nums font-semibold ${wrColor}`}>
          {t.winRate.toFixed(1)}%
        </div>
        <div className="text-[9px] text-neutral-600 font-mono tabular-nums">
          {t.wins}W · {t.losses}L
        </div>
      </div>

      <ChevronRight className="w-3 h-3 text-neutral-600 flex-shrink-0" />
    </button>
  );
}

/* ─── Position row (inside drawer) ───────────────────────────────── */

function RecentTradeRow({ t }: { t: RecentTrade }) {
  const pnlColor = t.netPnl >= 0 ? 'text-green-400' : 'text-red-400';
  const pctColor = t.pnlPct >= 0 ? 'text-green-400/70' : 'text-red-400/70';
  const symbol = t.marketSymbol !== '?' ? t.marketSymbol : t.market.slice(0, 6) + '…';
  const isWin = t.netPnl > 0;
  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/[0.04] last:border-0">
      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
        t.isLong ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
      }`}>
        {t.isLong ? 'L' : 'S'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white font-semibold">{symbol}</span>
          <span className={`text-[9px] uppercase tracking-wider ${isWin ? 'text-green-400/70' : 'text-red-400/70'}`}>
            {isWin ? 'WIN' : 'LOSS'}
          </span>
        </div>
        <div className="text-[10px] text-neutral-600 font-mono truncate">
          {fmtUSD(t.sizeUsd)} · {timeAgo(t.timestamp)}
          {t.executionPrice > 0 && (
            <> · @ ${t.executionPrice.toLocaleString('en-US', { maximumFractionDigits: t.executionPrice < 1 ? 4 : 2 })}</>
          )}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <div className={`text-xs font-mono font-semibold ${pnlColor} tabular-nums`}>
          {t.netPnl >= 0 ? '+' : ''}{fmtUSD(t.netPnl)}
        </div>
        <div className={`text-[9px] font-mono tabular-nums ${pctColor}`}>
          {fmtPct(t.pnlPct)}
        </div>
      </div>
    </div>
  );
}

/**
 * Position row in a GMX trader's drawer. Adds a "Copy →" deeplink to
 * /position-copy-form so a copy-trader can mirror the bet without
 * leaving the page. Symmetric with /hl-whales · PositionRow.
 */
function PositionRow({
  p,
  traderAddress,
  chain,
}: {
  p: OpenPosition;
  traderAddress: string;
  chain: Chain;
}) {
  const pnlColor = p.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400';
  const pctColor = p.pnlPct >= 0 ? 'text-green-400/70' : 'text-red-400/70';
  const symbol = p.marketSymbol !== '?' ? p.marketSymbol : p.market.slice(0, 6) + '…';

  // venue param for /position-copy-form so the "you saw" header reads
  // "GMX (Arbitrum)" / "GMX (Avalanche)" instead of the bare chain ID
  const venueParam = chain === 'arbitrum' ? 'gmx-arb' : 'gmx-avax';
  const copyHref = `/position-copy-form?symbol=${encodeURIComponent(symbol)}&side=${p.isLong ? 'long' : 'short'}&sizeUsd=${Math.round(p.sizeUsd)}&entryPrice=${p.entryPrice}&leverage=${p.leverage ?? 1}&venue=${venueParam}&wallet=${traderAddress}`;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
        p.isLong ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
      }`}>
        {p.isLong ? 'LONG' : 'SHORT'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-white font-semibold truncate">{symbol}</span>
          {p.leverage && (
            <span className="text-[10px] font-mono text-hub-yellow/80 bg-hub-yellow/[0.08] px-1 rounded">
              {p.leverage.toFixed(1)}×
            </span>
          )}
          {p.marketDeprecated && (
            <span className="text-[9px] text-orange-400/80 uppercase tracking-wider">depr.</span>
          )}
        </div>
        <div className="text-[10px] text-neutral-600 font-mono truncate">
          {fmtUSD(p.sizeUsd)} · entry ${p.entryPrice.toLocaleString('en-US', { maximumFractionDigits: p.entryPrice < 1 ? 4 : 2 })}
          {p.livePrice > 0 && p.entryPrice > 0 && (
            <> · now ${p.livePrice.toLocaleString('en-US', { maximumFractionDigits: p.livePrice < 1 ? 4 : 2 })}</>
          )}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <div className={`text-xs font-mono font-semibold ${pnlColor} tabular-nums`}>
          {p.unrealizedPnl >= 0 ? '+' : ''}{fmtUSD(p.unrealizedPnl)}
        </div>
        <div className={`text-[9px] font-mono tabular-nums ${pctColor}`}>
          {fmtPct(p.pnlPct)}
        </div>
      </div>
      <Link
        href={copyHref}
        title={`Mirror this ${symbol} ${p.isLong ? 'long' : 'short'} on your account`}
        className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
      >
        Copy →
      </Link>
    </div>
  );
}

/* ─── Trader detail drawer ───────────────────────────────────────── */

function TraderDrawer({ address, chain, onClose }: { address: string; chain: Chain; onClose: () => void }) {
  const chainOption = CHAIN_OPTIONS.find(c => c.id === chain) ?? CHAIN_OPTIONS[0];
  const explorerUrl = `https://${chainOption.explorer}/address/${address}`;
  const gmxUrl = `https://app.gmx.io/#/accounts/${address}?network=${chain}&v=2`;

  const { data, isLoading, error } = useApi<TraderDossier>({
    key: `gmx-trader-${chain}-${address}`,
    fetcher: async () => {
      const res = await fetch(`/api/gmx-traders/${address}?chain=${chain}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 30_000,
  });

  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'open' | 'trades'>('open');
  const copyAddr = async () => {
    if (await copyToClipboard(address)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const totalPnl = data ? data.summary.realizedPnl + data.summary.unrealizedPnl : 0;

  return (
    <div className="card-premium p-4 h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BookmarkStar address={address} venues={[`gmx-${chain}`]} size={14} />
            <span className="font-mono text-sm text-white font-bold truncate">{shortAddr(address)}</span>
            <button onClick={copyAddr} className="text-neutral-500 hover:text-hub-yellow transition-colors" aria-label="Copy address">
              <Copy className="w-3 h-3" />
            </button>
            {copied && <span className="text-[9px] text-green-400 font-mono">copied</span>}
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-hub-yellow transition-colors"
              aria-label={`View on ${chainOption.explorer}`}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <a
              href={gmxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-hub-yellow/70 hover:text-hub-yellow"
            >
              GMX <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <span className="text-neutral-700">·</span>
            <Link
              href={`/trader/${address}`}
              className="inline-flex items-center gap-1 text-[10px] text-hub-yellow/70 hover:text-hub-yellow font-semibold"
              title="See this trader's positions across GMX + Hyperliquid"
            >
              Cross-Platform <ChevronRight className="w-2.5 h-2.5" />
            </Link>
            <span className="text-neutral-700">·</span>
            {/* /wallet-tracker now 308-redirects to /watch and the query
                string drops on redirect. Skip the alias and link straight
                to /watch with ?add=. Same fix as /trader/[address]. */}
            <Link
              href={`/watch?add=${address}`}
              className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white"
            >
              Track wallet <ChevronRight className="w-2.5 h-2.5" />
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
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-neutral-500 text-xs">Loading dossier…</div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center text-xs text-red-400">Failed to load</div>
      )}

      {data && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-white/[0.02] rounded-lg p-2">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1">Total PnL</div>
              <div className={`font-mono font-bold text-sm tabular-nums ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtUSD(totalPnl)}
              </div>
              <div className="text-[9px] text-neutral-600 mt-0.5">
                <span className="font-mono">{fmtUSD(data.summary.realizedPnl)}</span> realized
                {data.summary.unrealizedPnl !== 0 && (
                  <> · <span className={`font-mono ${data.summary.unrealizedPnl >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    {data.summary.unrealizedPnl >= 0 ? '+' : ''}{fmtUSD(data.summary.unrealizedPnl)}
                  </span> open</>
                )}
              </div>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-2">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1">Win Rate</div>
              <div className="font-mono font-bold text-sm tabular-nums text-white">
                {data.summary.winRate.toFixed(1)}%
              </div>
              <div className="text-[9px] text-neutral-600 mt-0.5 font-mono">
                {data.summary.wins}W · {data.summary.losses}L
              </div>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-2">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1">Volume</div>
              <div className="font-mono text-xs tabular-nums text-white">{fmtUSD(data.summary.volume)}</div>
              <div className="text-[9px] text-neutral-600 mt-0.5 font-mono">
                {data.summary.totalTrades} trades
              </div>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-2">
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1">Max Capital</div>
              <div className="font-mono text-xs tabular-nums text-white">{fmtUSD(data.summary.maxCapital)}</div>
              <div className="text-[9px] text-neutral-600 mt-0.5 font-mono">
                Fees paid {fmtUSD(data.summary.realizedFees)}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-2 border-b border-white/[0.04] -mx-1 px-1">
            <button
              onClick={() => setTab('open')}
              className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold transition-colors border-b-2 ${
                tab === 'open'
                  ? 'text-hub-yellow border-hub-yellow'
                  : 'text-neutral-500 border-transparent hover:text-neutral-300'
              }`}
            >
              Open · {data.openPositions.length}
            </button>
            <button
              onClick={() => setTab('trades')}
              className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold transition-colors border-b-2 ${
                tab === 'trades'
                  ? 'text-hub-yellow border-hub-yellow'
                  : 'text-neutral-500 border-transparent hover:text-neutral-300'
              }`}
            >
              Recent Trades · {data.recentTrades?.length ?? 0}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'open' && (
              <>
                {data.openPositions.length === 0 ? (
                  <div className="text-neutral-500 text-xs text-center py-6">No open positions</div>
                ) : (
                  <div>
                    {data.openPositions.map(p => <PositionRow key={p.positionKey} p={p} traderAddress={address} chain={chain} />)}
                  </div>
                )}
              </>
            )}

            {tab === 'trades' && (
              <>
                {(data.recentTrades?.length ?? 0) === 0 ? (
                  <div className="text-neutral-500 text-xs text-center py-6">No recent trades</div>
                ) : (
                  <div>
                    {data.recentTrades.map(t => <RecentTradeRow key={`${t.positionKey}-${t.timestamp}`} t={t} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function GMXTradersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pull bookmark count so the "watching N traders" CTA can stay in
  // sync with the localStorage state — including changes from another
  // tab (useTraderBookmarks subscribes to the storage event).
  const { bookmarks } = useTraderBookmarks();

  // Read initial state from URL so leaderboard views are shareable.
  const initialSort = (searchParams.get('sort') as SortKey) || 'pnl';
  const initialPeriod = (searchParams.get('period') as Period) || '30d';
  const initialChain = (searchParams.get('chain') as Chain) || 'arbitrum';
  const initialMarket = searchParams.get('market') || '';

  const [sort, setSort] = useState<SortKey>(initialSort);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [chain, setChain] = useState<Chain>(initialChain);
  const [marketFilter, setMarketFilter] = useState<string>(initialMarket);
  const [marketList, setMarketList] = useState<MarketOption[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lookupAddr, setLookupAddr] = useState('');

  // Push leaderboard state into the URL so users can share exact views.
  // Uses replaceState to avoid polluting browser history on every toggle.
  useEffect(() => {
    const q = new URLSearchParams();
    if (chain !== 'arbitrum') q.set('chain', chain);
    if (period !== '30d') q.set('period', period);
    if (sort !== 'pnl') q.set('sort', sort);
    if (marketFilter) q.set('market', marketFilter);
    const qs = q.toString();
    const url = qs ? `/gmx-traders?${qs}` : '/gmx-traders';
    window.history.replaceState(null, '', url);
  }, [chain, period, sort, marketFilter]);

  const handleLookup = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lookupAddr.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      router.push(`/trader/${trimmed}`);
    }
  }, [lookupAddr, router]);

  // Keyboard shortcuts — 1/2/3 for period pills (skip 0 — no period 0),
  // ignore keypresses inside form inputs so the lookup box is usable.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map: Record<string, Period> = { '1': '7d', '2': '30d', '3': 'total' };
      if (map[e.key]) {
        e.preventDefault();
        setPeriod(map[e.key]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fetch market list for the filter dropdown (chain-scoped, 30min cache)
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/gmx-markets?chain=${chain}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { markets: [] })
      .then(json => setMarketList(json.markets || []))
      .catch(() => setMarketList([]));
    // reset market filter when chain changes (different market universe)
    setMarketFilter('');
    return () => ctrl.abort();
  }, [chain]);

  const isMarketView = !!marketFilter;
  const queryUrl = isMarketView
    ? `/api/gmx-traders?chain=${chain}&market=${marketFilter}&sort=${sort}&limit=100`
    : `/api/gmx-traders?chain=${chain}&sort=${sort}&period=${period}&limit=100`;

  const { data, isLoading, isRefreshing, error, refresh } = useApi<TraderResponse>({
    key: `gmx-traders:${chain}:${marketFilter || period}:${sort}`,
    fetcher: async () => {
      const res = await fetch(queryUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    if (!search.trim()) return data.data;
    const q = search.toLowerCase().trim();
    return data.data.filter(t => t.address.toLowerCase().includes(q));
  }, [data, search]);

  // Batch-fetch sparklines for the currently-visible traders. Fires after the
  // leaderboard settles. We keep this separate from the main /api/gmx-traders
  // call to avoid blowing up the subsquid query with a 30-day cross-join.
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  useEffect(() => {
    if (!filtered.length) return;
    const batch = filtered.slice(0, 50).map(t => t.address).join(',');
    if (!batch) return;
    const ctrl = new AbortController();
    fetch(`/api/gmx-traders/sparklines?addresses=${batch}&chain=${chain}&days=30`, {
      signal: ctrl.signal,
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => {
        if (json?.series) setSparklines(json.series);
      })
      .catch(() => { /* sparkline is cosmetic — fail silent */ });
    return () => ctrl.abort();
  }, [filtered, chain]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        {/* Hero — same vocabulary as /hl-traders so the two
            leaderboards read as a matched pair. */}
        <header className="mb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-hub-yellow/20 to-hub-yellow/[0.04] border border-hub-yellow/20 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-hub-yellow" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">Leaderboard · GMX V2</span>
              </div>
              <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white leading-[1.05]">
                GMX <span className="text-hub-yellow">traders</span>
              </h1>
              <p className="text-[13px] text-neutral-400 mt-2 max-w-xl leading-relaxed">
                On-chain perpetual traders ranked by realised PnL, volume, and hit rate.
                Star to add to your{' '}
                <Link href="/trader-watch" className="text-hub-yellow hover:underline font-medium">/trader-watch</Link>{' '}
                — see every bookmarked trader&apos;s open positions on one screen.
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap shrink-0 self-start lg:self-end">
              {bookmarks.length > 0 && (
                <Link
                  href="/trader-watch"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-hub-yellow/10 border border-hub-yellow/30 text-hub-yellow hover:bg-hub-yellow/20 hover:border-hub-yellow/50 transition-colors text-[12px] font-semibold shadow-[0_2px_8px_-2px_rgba(255,165,0,0.15)]"
                  title="View bookmarked traders' open positions"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Watchlist
                  <span className="font-mono opacity-80">· {bookmarks.length}</span>
                </Link>
              )}
              {/* Chain segmented control — modernized to match the
                  sort control on /funding-arb. */}
              <div className="inline-flex items-center gap-0.5 bg-white/[0.02] border border-white/[0.05] rounded-lg p-0.5" role="tablist" aria-label="Chain">
                {CHAIN_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    role="tab"
                    aria-selected={chain === opt.id}
                    onClick={() => { setChain(opt.id); setSelectedAddress(null); }}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                      chain === opt.id ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                    style={chain === opt.id ? { backgroundColor: opt.accent, color: '#fff' } : undefined}
                    aria-label={`Switch to ${opt.label}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <DataFreshness
                exchangeCount={1}
                lastUpdated={data?.meta?.timestamp ?? null}
                sources={[chain === 'arbitrum' ? 'Arbitrum' : 'Avalanche']}
              />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>

          {/* Address lookup — pastes any 0x address, routes to cross-platform view */}
          <form onSubmit={handleLookup} className="mt-4 flex items-center gap-2">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600 group-focus-within:text-hub-yellow transition-colors pointer-events-none" />
              <input
                type="text"
                value={lookupAddr}
                onChange={e => setLookupAddr(e.target.value)}
                placeholder="Paste any 0x… address for cross-platform view"
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/40 focus:bg-white/[0.04] font-mono transition-colors"
                aria-label="Lookup trader address"
              />
            </div>
            <button
              type="submit"
              disabled={!/^0x[a-fA-F0-9]{40}$/.test(lookupAddr.trim())}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-hub-yellow/15 text-hub-yellow hover:bg-hub-yellow/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5 border border-hub-yellow/20"
            >
              <Layers className="w-3 h-3" /> Lookup
            </button>
          </form>
        </header>

        {/* Summary */}
        {data?.summary && <SummaryStrip summary={data.summary} />}

        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          {/* Period pills — time window. Disabled when a specific market is
              selected because market view is "live positions only". */}
          <div className={`flex items-center gap-1 flex-wrap bg-white/[0.03] rounded-lg p-0.5 transition-opacity ${isMarketView ? 'opacity-40 pointer-events-none' : ''}`}>
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                title={isMarketView ? 'Clear market filter to change period' : opt.hint}
                disabled={isMarketView}
                className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${
                  period === opt.id
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {isMarketView && (
              <span className="px-2 text-[10px] uppercase tracking-wider text-hub-yellow font-semibold">
                LIVE · {marketList.find(m => m.address === marketFilter)?.symbol || 'MARKET'}
              </span>
            )}
          </div>

          {/* Sort pills */}
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

          {/* Market filter */}
          <div className="flex items-center">
            <select
              value={marketFilter}
              onChange={e => setMarketFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/[0.12]"
              aria-label="Filter by market"
              title="Show only traders with live positions on this market"
            >
              <option value="">All Markets</option>
              {marketList.map(m => (
                <option key={m.address} value={m.address}>
                  {m.symbol} {m.pair}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="md:ml-auto flex items-center gap-2">
            <input
              type="text"
              placeholder="Search address (0x…)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full md:w-64 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/[0.12] font-mono"
            />
            <button
              onClick={() => { if (data?.data) exportCSV(data.data, period, chain); }}
              disabled={!data?.data?.length}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap"
              aria-label="Export leaderboard as CSV"
              title="Download current leaderboard as CSV"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
        </div>

        {/* Leaderboard + detail drawer */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-4">
          <div className="card-premium p-3 min-h-[600px]">
            {/* Column header */}
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <span className="w-6">#</span>
              <span className="flex-1">Trader</span>
              <span className="w-[60px] hidden sm:block text-center">30D</span>
              <span className="text-right w-[100px] md:w-[120px]">PnL / ROI</span>
              <span className="text-right w-[90px] hidden md:block">Volume</span>
              <span className="text-right w-[70px] hidden md:block">Win Rate</span>
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
                  spark={sparklines[t.address.toLowerCase()]}
                  chain={chain}
                />
              ))}
            </div>
          </div>

          {/* Detail drawer — sticky on desktop */}
          <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
            {selectedAddress ? (
              <TraderDrawer address={selectedAddress} chain={chain} onClose={() => setSelectedAddress(null)} />
            ) : (
              <div className="card-premium p-6 h-full flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
                  <ArrowLeftRight className="w-4 h-4 text-neutral-500" />
                </div>
                <div className="text-sm text-neutral-400 font-medium mb-1">Select a trader</div>
                <div className="text-xs text-neutral-600">Click any row to inspect open positions, PnL breakdown and metadata.</div>
              </div>
            )}
          </aside>
        </div>

        {/* Footer meta */}
        <div className="mt-4 flex items-center gap-3 text-[10px] text-neutral-600 font-mono">
          <span className="inline-flex items-center gap-1">
            <Activity className="w-2.5 h-2.5" /> Data from GMX V2 {chain === 'avalanche' ? 'Avalanche' : 'Arbitrum'} subgraph
          </span>
          <span>·</span>
          <span>Cached 60s</span>
          <span>·</span>
          <a
            href={`https://app.gmx.io/#/accounts?network=${chain}&v=2`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-hub-yellow inline-flex items-center gap-1"
          >
            GMX official <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
