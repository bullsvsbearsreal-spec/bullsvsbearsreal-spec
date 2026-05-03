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
  ArrowLeftRight, Activity, ChevronDown, ChevronRight, Search, ExternalLink,
  TrendingUp, Layers,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */

type Sort = 'spread' | 'annualized' | 'venues';

interface VenueQuote {
  exchange: string;
  rate: number;
  rate8h: number;
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
  return (
    <div className="bg-white/[0.02] rounded-lg p-3 mt-1.5">
      <div className="grid grid-cols-[1fr,70px,70px,80px] gap-2 text-[9px] uppercase tracking-wider text-neutral-500 font-semibold mb-1.5 px-2">
        <div>Exchange</div>
        <div className="text-right">Rate</div>
        <div className="text-right">8h Norm</div>
        <div className="text-right">APR</div>
      </div>
      {venues.map(v => {
        const isMin = v === min;
        const isMax = v === max;
        const apr = v.rate8h * 3 * 365;
        return (
          <div key={v.exchange} className={`grid grid-cols-[1fr,70px,70px,80px] gap-2 text-[11px] py-1 px-2 rounded ${
            isMin ? 'bg-green-400/[0.06]' : isMax ? 'bg-red-400/[0.06]' : 'hover:bg-white/[0.03]'
          }`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded tracking-wider ${venueBadgeClass(v.type)}`}>
                {v.type}
              </span>
              <span className="text-white truncate">{v.exchange}</span>
              <span className="text-[9px] text-neutral-600 font-mono">{v.interval}</span>
              {isMin && <span className="text-[8px] text-green-400 uppercase tracking-wider font-semibold ml-1">LONG</span>}
              {isMax && <span className="text-[8px] text-red-400 uppercase tracking-wider font-semibold ml-1">SHORT</span>}
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
      <div className="mt-2 px-2 pt-2 border-t border-white/[0.05] text-[10px] text-neutral-500 leading-relaxed">
        <strong className="text-neutral-300">Carry trade:</strong>{' '}
        LONG {min.exchange} (receive {fmtPct(min.rate8h)} 8h ·
        {min.rate < 0 ? ' you GET paid funding' : ' you PAY funding'})
        {' · '}
        SHORT {max.exchange} (receive {fmtPct(max.rate8h)} 8h ·
        {max.rate > 0 ? ' you GET paid funding' : ' you PAY funding'}).
        Net edge: <span className="text-hub-yellow font-mono">{fmtPct(max.rate8h - min.rate8h)}</span> per 8h
        = <span className="text-hub-yellow font-mono">{fmtAPR((max.rate8h - min.rate8h) * 3 * 365)}</span> APR
        (theoretical, pre fees / borrow cost / slippage).
      </div>
    </div>
  );
}

/* ─── Row ───────────────────────────────────────────────────────── */

function ArbRowView({ row, expanded, onToggle }: { row: ArbRow; expanded: boolean; onToggle: () => void }) {
  const aprColor = row.annualized >= 100 ? 'text-green-400' : row.annualized >= 20 ? 'text-green-400/70' : 'text-neutral-300';
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full text-left rank-row hover:bg-white/[0.04] transition-colors"
        aria-expanded={expanded}
        aria-label={`Toggle details for ${row.symbol}`}
      >
        <TokenIconSimple symbol={row.symbol} size={20} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white">{row.symbol}</span>
            {row.dexOnOneSide && (
              <span className="text-[8px] text-purple-300 uppercase tracking-wider bg-purple-400/10 px-1 rounded">
                cex↔dex
              </span>
            )}
            <span className="text-[9px] text-neutral-600 font-mono">{row.venueCount} venues</span>
          </div>
          <div className="text-[10px] text-neutral-600 font-mono mt-0.5 truncate">
            LONG <span className="text-green-400/80">{row.min.exchange}</span> {fmtPct(row.min.rate8h, 3)}
            <span className="mx-1 text-neutral-700">·</span>
            SHORT <span className="text-red-400/80">{row.max.exchange}</span> {fmtPct(row.max.rate8h, 3)}
          </div>
        </div>
        <div className="text-right w-[90px]">
          <div className="font-mono font-bold text-sm tabular-nums text-hub-yellow">
            {fmtPct(row.spread8h, 3)}
          </div>
          <div className="text-[9px] text-neutral-600 font-mono">8h spread</div>
        </div>
        <div className="text-right w-[80px]">
          <div className={`font-mono font-bold text-sm tabular-nums ${aprColor}`}>
            {fmtAPR(row.annualized)}
          </div>
          <div className="text-[9px] text-neutral-600 font-mono">APR est.</div>
        </div>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-neutral-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-neutral-500 flex-shrink-0" />
        )}
      </button>
      {expanded && <VenueTable venues={row.venues} />}
    </div>
  );
}

/* ─── Summary strip ─────────────────────────────────────────────── */

function SummaryStrip({ summary }: { summary: ArbResponse['summary'] }) {
  const items = [
    { label: 'Opportunities', value: summary.totalSymbols.toLocaleString() },
    { label: 'Top APR', value: fmtAPR(summary.topAnnualized), accent: summary.topAnnualized > 100 },
    { label: 'Top Symbol', value: summary.topSymbol ?? '—' },
    { label: 'Median 8h Spread', value: fmtPct(summary.medianSpread, 3) },
    { label: 'CEX↔DEX Arbs', value: summary.dexCrossSymbols.toLocaleString() },
  ];
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Funding arbitrage summary — updates every 60 seconds"
    >
      {items.map(it => (
        <div key={it.label} className="card-premium p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">{it.label}</div>
          <div className={`font-mono tabular-nums text-sm font-semibold ${
            it.accent ? 'text-green-400' : 'text-white'
          }`}>{it.value}</div>
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
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-md bg-hub-yellow/10 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-hub-yellow" />
            </div>
            <h1 className="text-xl font-bold text-white">Funding Arb Scanner</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness
                exchangeCount={data?.summary?.totalSymbols ?? 0}
                lastUpdated={data?.meta?.timestamp ?? null}
                sources={['30+ exchanges']}
              />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Cross-exchange funding-rate divergences. Long the cheap side, short the expensive side, collect the spread per 8h cycle.
            Annualized APR is theoretical — subtract fees, borrow cost, and slippage.
          </p>
        </div>

        {data?.summary && <SummaryStrip summary={data.summary} />}

        {/* Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          {/* Sort */}
          <div className="flex items-center gap-1">
            {(['annualized', 'spread', 'venues'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sort === s ? 'bg-hub-yellow/15 text-hub-yellow' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                {s === 'annualized' ? 'Top APR' : s === 'spread' ? 'Widest Spread' : 'Most Venues'}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <span>Min venues</span>
              <select
                value={minVenues}
                onChange={e => setMinVenues(Number(e.target.value))}
                className="bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-white/[0.12]"
              >
                {[2, 3, 5, 8, 10, 15].map(n => <option key={n} value={n}>{n}+</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <span>Min 8h spread</span>
              <select
                value={minSpread}
                onChange={e => setMinSpread(Number(e.target.value))}
                className="bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-white/[0.12]"
              >
                <option value="0.01">1 bp</option>
                <option value="0.02">2 bp</option>
                <option value="0.05">5 bp</option>
                <option value="0.10">10 bp</option>
                <option value="0.25">25 bp</option>
                <option value="0.50">50 bp</option>
              </select>
            </label>
          </div>

          {/* Search */}
          <div className="lg:ml-auto relative flex-1 lg:flex-initial lg:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter symbol or venue"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/[0.12]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div className="w-[20px]" />
            <span className="flex-1">Symbol · best pair</span>
            <span className="w-[90px] text-right">8h Spread</span>
            <span className="w-[80px] text-right">APR est.</span>
            <span className="w-3" />
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">No opportunities match your filters.</div>
          )}

          <div className="ranked-list space-y-0.5">
            {filtered.map(row => (
              <ArbRowView
                key={row.symbol}
                row={row}
                expanded={expanded === row.symbol}
                onToggle={() => setExpanded(expanded === row.symbol ? null : row.symbol)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 text-[10px] text-neutral-600 font-mono flex items-center gap-3 flex-wrap">
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
