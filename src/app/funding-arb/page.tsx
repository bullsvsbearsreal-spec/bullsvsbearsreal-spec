'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import { TokenIconSimple } from '@/components/TokenIcon';
import Link from 'next/link';
import {
  ArrowLeftRight, Activity, ChevronRight, Search, ExternalLink,
  TrendingUp, Layers,
} from 'lucide-react';
import { EXCHANGE_FEES, FEE_MODEL_VERSION } from '@/lib/constants/exchanges';

/* ─── Types ─────────────────────────────────────────────────────── */

type Sort = 'spread' | 'annualized' | 'net' | 'venues';

interface VenueQuote {
  exchange: string;
  rate: number;
  rate8h: number;
  // 8h-normalised pool-borrow %, 0 for CEXes (no symmetric borrow on
  // a typical perp account). Populated by /api/funding-arb from the
  // upstream GMX + gTrade fetchers which already track borrow as a
  // separate signal. Optional in the type because older API revs
  // didn't include it — UI defaults to 0 on a missing field.
  borrow8h?: number;
  interval: '1h' | '4h' | '8h';
  markPrice: number | null;
  type: 'cex' | 'dex';
}

interface ArbRow {
  symbol: string;
  venueCount: number;
  min: VenueQuote;
  max: VenueQuote;
  spread8h: number;
  annualized: number;
  // Net-of-borrow fields — see /api/funding-arb route docstring for
  // semantics. Optional because the field shape was added May 2026
  // and SWR can serve a cached payload without them on first paint.
  netSpread8h?: number;
  netAnnualized?: number;
  totalBorrow8h?: number;
  venues: VenueQuote[];
  direction: string;
  dexOnOneSide: boolean;
}

interface ArbResponse {
  data: ArbRow[];
  summary: {
    totalSymbols: number;
    displayed: number;
    topAnnualized: number;
    topSymbol: string | null;
    medianSpread: number;
    dexCrossSymbols: number;
    exchangesScanned?: number;
  };
  meta: { minVenues: number; minSpread: number; sort: string; timestamp: number };
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function fmtPct(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function fmtAPR(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 1000) return `${n >= 0 ? '+' : ''}${(n / 1000).toFixed(1)}K%`;
  return `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`;
}

function venueBadgeClass(type: 'cex' | 'dex'): string {
  return type === 'cex' ? 'bg-blue-400/10 text-blue-300' : 'bg-purple-400/10 text-purple-300';
}

/* ─── Expanded venue table (inside a row) ───────────────────────── */

function VenueTable({ venues }: { venues: VenueQuote[] }) {
  const min = venues[0];
  const max = venues[venues.length - 1];

  // Estimated round-trip fees on the carry pair using canonical EXCHANGE_FEES
  // (same table /api/v1/arbitrage uses). 4 fills total: open+close on each leg.
  // Calculated here client-side because this page is a pure scanner — for the
  // FULL net analysis (with OI sanity + grades), point partners at /arbitrage.
  const minTaker = EXCHANGE_FEES[min.exchange]?.taker ?? 0.05;
  const maxTaker = EXCHANGE_FEES[max.exchange]?.taker ?? 0.05;
  const roundTripFee = (minTaker + maxTaker) * 2;   // open + close on each side
  const grossSpread8h = max.rate8h - min.rate8h;
  const netSpread8h = grossSpread8h - roundTripFee;
  const netApr = netSpread8h * 3 * 365;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 mt-1.5">
      {/* Carry-trade summary up top — was buried at the bottom of the
          panel. This is the actionable bit, so it gets the headline
          treatment: two leg pills side-by-side, then a single-line
          net-edge readout. */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-stretch mb-3">
        <div className="rounded-lg border border-green-400/20 bg-green-500/[0.04] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-green-400">Long</span>
            <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded tracking-wider ${venueBadgeClass(min.type)}`}>
              {min.type}
            </span>
            <span className="text-[9px] text-neutral-600 font-mono tabular-nums ml-auto">{min.interval}</span>
          </div>
          <div className="text-sm font-bold text-white">{min.exchange}</div>
          <div className="text-[10px] text-neutral-500 font-mono tabular-nums mt-0.5">
            {min.rate < 0 ? 'receives ' : 'pays '}
            <span className={min.rate < 0 ? 'text-green-400' : 'text-red-400'}>{fmtPct(Math.abs(min.rate8h), 3)}</span>
            {' / 8h'}
          </div>
        </div>
        <div className="hidden sm:flex items-center justify-center text-neutral-600 font-mono tabular-nums text-lg">→</div>
        <div className="rounded-lg border border-red-400/20 bg-red-500/[0.04] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-red-400">Short</span>
            <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded tracking-wider ${venueBadgeClass(max.type)}`}>
              {max.type}
            </span>
            <span className="text-[9px] text-neutral-600 font-mono tabular-nums ml-auto">{max.interval}</span>
          </div>
          <div className="text-sm font-bold text-white">{max.exchange}</div>
          <div className="text-[10px] text-neutral-500 font-mono tabular-nums mt-0.5">
            {max.rate > 0 ? 'receives ' : 'pays '}
            <span className={max.rate > 0 ? 'text-green-400' : 'text-red-400'}>{fmtPct(Math.abs(max.rate8h), 3)}</span>
            {' / 8h'}
          </div>
        </div>
      </div>

      {/* Net edge breakdown — three numbers visually grouped so the
          user can see at a glance: gross → minus fee → net. */}
      <div className="flex items-center gap-2 flex-wrap mb-3 px-1">
        <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500 font-semibold">Net edge</div>
        <div className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums">
          <span className="text-hub-yellow font-bold">{fmtPct(grossSpread8h)}</span>
          <span className="text-neutral-600">gross</span>
        </div>
        <span className="text-neutral-700">−</span>
        <div className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums">
          <span className="text-amber-400/80">{fmtPct(roundTripFee)}</span>
          <span className="text-neutral-600">round-trip fee</span>
        </div>
        <span className="text-neutral-700">=</span>
        <div className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums">
          <span className={`font-bold ${netSpread8h > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(netSpread8h)}</span>
          <span className="text-neutral-600">/ 8h</span>
        </div>
        <span className="text-neutral-700">·</span>
        <div className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums">
          <span className={`font-bold ${netApr > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtAPR(netApr)}</span>
          <span className="text-neutral-600">APR</span>
        </div>
      </div>

      {/* All-venues table */}
      <div className="grid grid-cols-[1fr,70px,70px,80px] gap-2 text-[9px] uppercase tracking-[0.14em] text-neutral-600 font-bold mb-1.5 px-2">
        <div>Exchange</div>
        <div className="text-right">Rate</div>
        <div className="text-right">8h norm</div>
        <div className="text-right">APR</div>
      </div>
      {venues.map(v => {
        const isMin = v === min;
        const isMax = v === max;
        const apr = v.rate8h * 3 * 365;
        return (
          <div key={v.exchange} className={`grid grid-cols-[1fr,70px,70px,80px] gap-2 text-[11px] py-1.5 px-2 rounded-md ${
            isMin ? 'bg-green-400/[0.06] border-l-2 border-green-400/40' : isMax ? 'bg-red-400/[0.06] border-l-2 border-red-400/40' : 'hover:bg-white/[0.03] border-l-2 border-transparent'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded tracking-wider ${venueBadgeClass(v.type)}`}>
                {v.type}
              </span>
              <span className="text-white truncate font-medium">{v.exchange}</span>
              <span className="text-[9px] text-neutral-600 font-mono tabular-nums">{v.interval}</span>
              {(v.borrow8h ?? 0) > 0 && (
                <span
                  className="text-[8px] font-bold uppercase tracking-wider px-1 rounded bg-amber-500/[0.08] text-amber-300/90"
                  title={`Pool borrow: ${fmtPct(v.borrow8h ?? 0, 3)} per 8h`}
                >
                  brw
                </span>
              )}
              {isMin && <span className="text-[8px] text-green-400 uppercase tracking-wider font-bold ml-auto">long</span>}
              {isMax && <span className="text-[8px] text-red-400 uppercase tracking-wider font-bold ml-auto">short</span>}
            </div>
            <div className={`text-right font-mono tabular-nums ${v.rate >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
              {fmtPct(v.rate)}
            </div>
            <div className={`text-right font-mono tabular-nums text-neutral-400`}>
              {fmtPct(v.rate8h)}
            </div>
            <div className={`text-right font-mono tabular-nums ${apr >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
              {fmtAPR(apr)}
            </div>
          </div>
        );
      })}

      <div className="mt-2 pt-2 px-2 border-t border-white/[0.05] text-[9px] text-neutral-600 font-mono tabular-nums leading-relaxed">
        Fees from canonical schedule ({FEE_MODEL_VERSION}, taker × 4 fills).
        Borrow cost on DEX legs is excluded from the "net" math above —
        see the symbol&apos;s borrow chip in the row header above for the
        magnitude. Slippage NOT modelled; <Link href="/arbitrage" className="text-hub-yellow/80 hover:text-hub-yellow hover:underline">/arbitrage</Link>{' '}
        has the full fee-graded view.
      </div>
    </div>
  );
}

/* ─── Row ───────────────────────────────────────────────────────── */

function ArbRowView({ row, rank, expanded, onToggle }: { row: ArbRow; rank: number; expanded: boolean; onToggle: () => void }) {
  const aprColor = row.annualized >= 100 ? 'text-green-400' : row.annualized >= 20 ? 'text-green-400/70' : 'text-neutral-300';
  // Net-after-borrow APR is the number Christian + snake actually act
  // on for funding-farm pairs. The gross can be 150% while net is
  // -20% on a high-utilisation gTrade pool. Show both columns
  // explicitly so the user can't miss which one is real.
  const hasBorrowData = (row.totalBorrow8h ?? 0) > 0;
  const netApr = row.netAnnualized ?? row.annualized;
  const netAprColor = netApr >= 50 ? 'text-green-400'
                    : netApr >= 10 ? 'text-green-400/70'
                    : netApr >= 0 ? 'text-neutral-300'
                    : 'text-red-400';
  // Visual rank: gold/silver/bronze for top 3, then a fade for top 10.
  // Cheap visual cue that gives the user a sense of where they are in
  // the list at a glance without having to read the rank number.
  const rankTint = rank === 1 ? 'bg-gradient-to-r from-hub-yellow/[0.08] via-transparent to-transparent border-l-2 border-hub-yellow/60'
                 : rank === 2 ? 'bg-gradient-to-r from-hub-yellow/[0.05] via-transparent to-transparent border-l-2 border-hub-yellow/40'
                 : rank === 3 ? 'bg-gradient-to-r from-hub-yellow/[0.03] via-transparent to-transparent border-l-2 border-hub-yellow/25'
                 : 'border-l-2 border-transparent';
  return (
    <div id={row.symbol} className="scroll-mt-24">
      <button
        onClick={onToggle}
        className={`group w-full text-left rank-row hover:bg-white/[0.04] transition-all ${rankTint} ${expanded ? 'bg-white/[0.03]' : ''}`}
        aria-expanded={expanded}
        aria-label={`Toggle details for ${row.symbol}`}
      >
        {/* Rank chip — small but readable, masks behind the gradient
            tint on top 3 for visual reinforcement. */}
        <span className={`shrink-0 w-6 text-center text-[10px] font-mono tabular-nums font-bold tabular-nums ${
          rank <= 3 ? 'text-hub-yellow' : 'text-neutral-600'
        }`}>
          {rank}
        </span>
        <TokenIconSimple symbol={row.symbol} size={22} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14px] font-bold text-white tracking-tight">{row.symbol}</span>
            {row.dexOnOneSide && (
              <span className="inline-flex items-center text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-purple-400/30 bg-purple-500/[0.08] text-purple-300">
                cex × dex
              </span>
            )}
            <span className="text-[9px] text-neutral-600 font-mono tabular-nums">
              {row.venueCount}v
            </span>
            {hasBorrowData && (
              <span
                className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/[0.08] text-amber-300"
                title={`Pool borrow rate paid on both DEX legs: ${fmtPct(row.totalBorrow8h ?? 0, 3)} per 8h`}
              >
                borrow {fmtPct(row.totalBorrow8h ?? 0, 3)}
              </span>
            )}
          </div>
          <div className="text-[10px] text-neutral-500 font-mono tabular-nums mt-0.5 truncate">
            <span className="text-green-400/90 font-semibold">LONG</span> <span className="text-neutral-300">{row.min.exchange}</span> <span className="text-neutral-600">{fmtPct(row.min.rate8h, 3)}</span>
            <span className="mx-1.5 text-neutral-700">→</span>
            <span className="text-red-400/90 font-semibold">SHORT</span> <span className="text-neutral-300">{row.max.exchange}</span> <span className="text-neutral-600">{fmtPct(row.max.rate8h, 3)}</span>
          </div>
        </div>
        <div className="text-right w-[90px]">
          <div className="font-mono tabular-nums font-bold text-sm tabular-nums text-hub-yellow">
            {fmtPct(row.spread8h, 3)}
          </div>
          <div className="text-[9px] text-neutral-600 font-mono tabular-nums uppercase tracking-wider">8h spread</div>
        </div>
        <div className="text-right w-[80px]">
          <div className={`font-mono tabular-nums font-bold text-sm tabular-nums ${aprColor}`}>
            {fmtAPR(row.annualized)}
          </div>
          <div className="text-[9px] text-neutral-600 font-mono tabular-nums uppercase tracking-wider">APR gross</div>
        </div>
        {/* Net APR column — only renders when borrow data is present
            so symbols where both legs are CEXes don't get a redundant
            "same number twice" column. */}
        {hasBorrowData && (
          <div className="text-right w-[80px]">
            <div className={`font-mono tabular-nums font-bold text-sm tabular-nums ${netAprColor}`} title="Annualized after pool borrow on both DEX legs (excludes trading fees + slippage)">
              {fmtAPR(netApr)}
            </div>
            <div className="text-[9px] text-neutral-600 font-mono tabular-nums uppercase tracking-wider">APR net</div>
          </div>
        )}
        <div className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-hub-yellow transition-colors" />
        </div>
      </button>
      {expanded && <VenueTable venues={row.venues} />}
    </div>
  );
}

/* ─── Summary strip ─────────────────────────────────────────────── */

function SummaryStrip({ summary }: { summary: ArbResponse['summary'] }) {
  // Each stat carries its own accent so the strip isn't five identical
  // grey cards. The "tone" controls the left-edge accent bar — a
  // common pattern in modern terminal UIs (Bloomberg, dydx) that
  // signals each card's category at a glance.
  const items: Array<{
    label: string;
    value: string;
    sub?: string;
    tone: 'neutral' | 'pump' | 'rekt' | 'accent';
  }> = [
    { label: 'Opportunities', value: summary.totalSymbols.toLocaleString(), tone: 'neutral', sub: 'symbols scanned' },
    {
      label: 'Top APR',
      value: fmtAPR(summary.topAnnualized),
      sub: summary.topSymbol ?? '—',
      tone: summary.topAnnualized > 100 ? 'pump' : 'accent',
    },
    { label: 'Median 8h Spread', value: fmtPct(summary.medianSpread, 3), tone: 'neutral', sub: 'across all symbols' },
    { label: 'CEX ↔ DEX', value: summary.dexCrossSymbols.toLocaleString(), tone: 'accent', sub: 'cross-venue pairs' },
    {
      label: 'Venues',
      value: (summary.exchangesScanned ?? 0).toString(),
      tone: 'neutral',
      sub: 'contributing quotes',
    },
  ];
  const accentClass = (tone: typeof items[number]['tone']) =>
    tone === 'pump' ? 'before:bg-green-400'
    : tone === 'rekt' ? 'before:bg-red-400'
    : tone === 'accent' ? 'before:bg-hub-yellow'
    : 'before:bg-white/10';
  const valueClass = (tone: typeof items[number]['tone']) =>
    tone === 'pump' ? 'text-green-400'
    : tone === 'rekt' ? 'text-red-400'
    : tone === 'accent' ? 'text-hub-yellow'
    : 'text-white';
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Funding arbitrage summary — updates every 60 seconds"
    >
      {items.map(it => (
        <div
          key={it.label}
          className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-3 before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] ${accentClass(it.tone)}`}
        >
          <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500 mb-1 font-semibold">{it.label}</div>
          <div className={`font-mono tabular-nums text-base font-bold leading-tight ${valueClass(it.tone)}`}>{it.value}</div>
          {it.sub && (
            <div className="text-[9px] text-neutral-600 mt-0.5 truncate">{it.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function FundingArbPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSort = (searchParams.get('sort') as Sort) || 'annualized';
  const initialMinVenues = parseInt(searchParams.get('min_venues') || '3', 10) || 3;
  const initialMinSpread = parseFloat(searchParams.get('min_spread') || '0.02') || 0.02;

  const [sort, setSort] = useState<Sort>(initialSort);
  const [minVenues, setMinVenues] = useState<number>(initialMinVenues);
  const [minSpread, setMinSpread] = useState<number>(initialMinSpread);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // URL sync
  useEffect(() => {
    const q = new URLSearchParams();
    if (sort !== 'annualized') q.set('sort', sort);
    if (minVenues !== 3) q.set('min_venues', String(minVenues));
    if (minSpread !== 0.02) q.set('min_spread', String(minSpread));
    const qs = q.toString();
    window.history.replaceState(null, '', qs ? `/funding-arb?${qs}` : '/funding-arb');
  }, [sort, minVenues, minSpread]);

  const { data, isLoading, isRefreshing, error, refresh } = useApi<ArbResponse>({
    key: `funding-arb:${sort}:${minVenues}:${minSpread}`,
    fetcher: async () => {
      const res = await fetch(
        `/api/funding-arb?sort=${sort}&min_venues=${minVenues}&min_spread=${minSpread}&limit=150`,
        { signal: AbortSignal.timeout(15_000) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.data;
    return data.data.filter(r =>
      r.symbol.toLowerCase().includes(q) ||
      r.min.exchange.toLowerCase().includes(q) ||
      r.max.exchange.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        {/* Hero — title block on left, live top-opportunity card on
            right. Was: tiny icon + small title with no signal until
            the user looked at the stats strip below. Now the most
            actionable single piece of info on the page sits next to
            the H1 where the eye lands first. */}
        <section className="mb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            {/* Left: title */}
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-hub-yellow/20 to-hub-yellow/[0.04] border border-hub-yellow/20 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4 text-hub-yellow" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">Scanner</span>
              </div>
              <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white leading-[1.05]">
                Funding-rate <span className="text-hub-yellow">arb</span>
              </h1>
              <p className="text-[13px] text-neutral-400 mt-2 max-w-xl leading-relaxed">
                Long the cheap side, short the expensive side, collect the spread per 8h cycle.
                When a leg is a DEX (gTrade / GMX) we subtract pool borrow rates and surface an
                <span className="text-hub-yellow font-medium"> APR net</span> column —
                gross APR can be 100%+ while net is negative on a high-utilisation pool.
                Trading fees + slippage aren&apos;t modelled here; use{' '}
                <Link href="/arbitrage" className="text-hub-yellow hover:underline font-medium">/arbitrage</Link>
                {' '}for the fee-graded view.
              </p>
            </div>

            {/* Right: live top-opportunity callout */}
            {data?.summary?.topSymbol && data.summary.topAnnualized > 0 && (
              <Link
                href={`#${data.summary.topSymbol}`}
                onClick={() => setExpanded(data.summary.topSymbol)}
                className="group relative shrink-0 overflow-hidden rounded-2xl border border-hub-yellow/20 bg-gradient-to-br from-hub-yellow/[0.08] to-hub-yellow/[0.02] px-5 py-3 hover:border-hub-yellow/40 transition-colors lg:min-w-[280px]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-hub-yellow font-bold">Top opportunity now</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <TokenIconSimple symbol={data.summary.topSymbol} size={22} />
                  <span className="text-xl font-bold text-white">{data.summary.topSymbol}</span>
                  <span className="ml-auto font-mono tabular-nums font-bold text-xl tabular-nums text-green-400">
                    {fmtAPR(data.summary.topAnnualized)}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-500 mt-1.5 font-mono tabular-nums">
                  click to inspect ↓
                </div>
              </Link>
            )}

            {/* Refresh control sits a tier lower than the hero block */}
            <div className="flex items-center gap-1 self-start lg:self-end">
              <DataFreshness
                exchangeCount={data?.summary?.totalSymbols ?? 0}
                lastUpdated={data?.meta?.timestamp ?? null}
                sources={data?.summary?.exchangesScanned
                  ? [`${data.summary.exchangesScanned} exchanges`]
                  : undefined}
              />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
        </section>

        {data?.summary && <SummaryStrip summary={data.summary} />}

        {/* Controls — three groups, clear visual separation. Sort is
            a segmented control (single rounded container with chip-
            shaped active state), filters are pill-styled dropdowns,
            and search owns the right edge with a tinted focus state. */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          {/* Segmented sort control */}
          <div
            className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            role="tablist"
            aria-label="Sort order"
          >
            {(['annualized', 'net', 'spread', 'venues'] as const).map(s => {
              const active = sort === s;
              const label = s === 'annualized' ? 'APR gross'
                : s === 'net' ? 'APR net'
                : s === 'spread' ? 'Spread'
                : 'Venues';
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSort(s)}
                  className={`relative px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all ${
                    active
                      ? 'bg-hub-yellow text-black shadow-[0_2px_8px_-2px_rgba(255,165,0,0.4)]'
                      : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
              <span>Min venues</span>
              <select
                value={minVenues}
                onChange={e => setMinVenues(Number(e.target.value))}
                className="bg-transparent text-xs text-white font-mono tabular-nums focus:outline-none cursor-pointer"
                aria-label="Minimum venues per opportunity"
              >
                {[2, 3, 5, 8, 10, 15].map(n => <option key={n} value={n} className="bg-hub-darker">{n}+</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
              <span>Min spread</span>
              <select
                value={minSpread}
                onChange={e => setMinSpread(Number(e.target.value))}
                className="bg-transparent text-xs text-white font-mono tabular-nums focus:outline-none cursor-pointer"
                aria-label="Minimum 8h spread in basis points"
              >
                <option value="0.01" className="bg-hub-darker">1 bp</option>
                <option value="0.02" className="bg-hub-darker">2 bp</option>
                <option value="0.05" className="bg-hub-darker">5 bp</option>
                <option value="0.10" className="bg-hub-darker">10 bp</option>
                <option value="0.25" className="bg-hub-darker">25 bp</option>
                <option value="0.50" className="bg-hub-darker">50 bp</option>
              </select>
            </label>
          </div>

          {/* Search — wider focus ring, accent border on focus */}
          <div className="lg:ml-auto relative flex-1 lg:flex-initial lg:w-72 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600 group-focus-within:text-hub-yellow transition-colors pointer-events-none" />
            <input
              type="text"
              placeholder="Filter symbol or venue…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/[0.05] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-hub-yellow/40 focus:bg-white/[0.04] transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent p-3 min-h-[500px]">
          <div className="hidden md:flex items-center gap-3 px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-neutral-600 font-bold border-b border-white/[0.05] mb-1">
            <div className="w-6" />
            <div className="w-[22px]" />
            <span className="flex-1">Symbol · best pair</span>
            <span className="w-[90px] text-right">8h spread</span>
            <span className="w-[80px] text-right">APR gross</span>
            <span className="w-[80px] text-right">APR net</span>
            <span className="w-3.5" />
          </div>

          {isLoading && (
            <div className="space-y-1 p-1">
              {/* Skeleton matches the new row shape — rank chip, icon,
                  symbol+meta, three numeric columns. Subtle shimmer
                  delay-staggered so it doesn't strobe in lockstep. */}
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] animate-pulse"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="w-6 h-3 rounded bg-white/[0.05]" />
                  <div className="w-[22px] h-[22px] rounded-full bg-white/[0.05]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-white/[0.06]" />
                    <div className="h-2 w-56 rounded bg-white/[0.03]" />
                  </div>
                  <div className="w-[90px] h-4 rounded bg-white/[0.05]" />
                  <div className="w-[80px] h-4 rounded bg-white/[0.05]" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-16">
              <div className="inline-flex flex-col items-center gap-2 text-red-400">
                <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-400/30 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Failed to load</span>
                <span className="text-[11px] text-neutral-500 font-mono tabular-nums">{String(error)}</span>
              </div>
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex flex-col items-center gap-2 text-neutral-500">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <Search className="w-4 h-4" />
                </div>
                <span className="text-sm">No opportunities match your filters.</span>
                <span className="text-[11px] text-neutral-600">
                  Try lowering the min-venues or min-spread thresholds above.
                </span>
              </div>
            </div>
          )}

          <div className="ranked-list space-y-0.5">
            {filtered.map((row, i) => (
              <ArbRowView
                key={row.symbol}
                row={row}
                rank={i + 1}
                expanded={expanded === row.symbol}
                onToggle={() => setExpanded(expanded === row.symbol ? null : row.symbol)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 text-[10px] text-neutral-600 font-mono tabular-nums flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Activity className="w-2.5 h-2.5" /> Data refreshes every 60s
          </span>
          <span>·</span>
          <span className="max-w-full">
            <strong className="text-neutral-400">Reality check:</strong> to capture the spread you need to open both legs simultaneously,
            hold through funding settlements, and survive volatility. APR is pre-fees. Many "arbs" evaporate once
            you factor in taker fees (~0.05%), collateral borrow rates, and slippage on thin venues.
          </span>
        </div>
      </main>
      <Footer />
    </div>
  );
}
