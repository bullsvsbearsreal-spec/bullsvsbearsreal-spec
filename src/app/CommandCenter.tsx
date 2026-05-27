'use client';

/**
 * CommandCenter — InfoHub homepage matching the design-system handoff
 * (project/_scratch/01-home.png).
 *
 * Structure:
 *   • Sticky Header + market tape (already global)
 *   • Sticky left sidebar with category tree (orange-active state)
 *   • Hero: bold "Command Center" title + LIVE/streaming pill
 *   • 4-card stat strip: TOTAL OI · LIQUIDATED 24H · FEAR & GREED · BTC DOMINANCE
 *   • Cross-exchange funding matrix (color-graded green/red cells)
 *   • Bottom row: Liquidations · Top Movers · Fear & Greed gauge
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MarketTiles from '@/components/MarketTiles';
import CoinSearch from '@/components/CoinSearch';
import { CoinSearchResult } from '@/lib/api/coingecko';
import { ALL_EXCHANGES } from '@/lib/constants';
import { useApi } from '@/hooks/useSWRApi';
import { useAggregatorHealth } from '@/hooks/useAggregatorHealth';
import {
  Activity, BarChart3, Zap, Percent, Grid3X3, ArrowLeftRight, Crosshair,
  Rocket, Crown, GitCompareArrows, Newspaper, Unlock, LineChart, Bitcoin,
  Thermometer, Star, Wallet, Bell, Eye, ChevronRight, Flame, Gift, TrendingUp, TrendingDown,
} from 'lucide-react';

/* ─── Sidebar nav (terminal-style category tree) ─── */
const NAV_GROUPS = [
  {
    label: 'Scan',
    items: [
      { name: 'Funding Rates',   href: '/funding',         icon: Percent,   badge: String(ALL_EXCHANGES.length) },
      { name: 'Funding Arb',     href: '/funding-arb',     icon: ArrowLeftRight },
      { name: 'Funding Heatmap', href: '/funding-heatmap', icon: Grid3X3 },
      { name: 'Spreads',         href: '/spreads',         icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Risk',
    items: [
      { name: 'Liquidations', href: '/liquidations',        icon: Zap },
      { name: 'Liq Heatmap',  href: '/liquidation-heatmap', icon: Grid3X3 },
      { name: 'Open Interest',href: '/open-interest',       icon: BarChart3 },
      { name: 'Long/Short',   href: '/longshort',           icon: GitCompareArrows },
    ],
  },
  {
    label: 'Monitor',
    items: [
      { name: 'Top Movers',     href: '/top-movers',     icon: Rocket },
      { name: 'Market Heatmap', href: '/market-heatmap', icon: Grid3X3 },
      { name: 'Dominance',      href: '/dominance',      icon: Crown },
    ],
  },
  {
    label: 'Research',
    items: [
      { name: 'News',          href: '/news',          icon: Newspaper },
      { name: 'Unlocks',       href: '/token-unlocks', icon: Unlock },
      { name: 'ETF Flows',     href: '/etf',           icon: LineChart },
    ],
  },
  {
    label: 'My Tools',
    items: [
      { name: 'Dashboard',     href: '/dashboard',     icon: BarChart3 },
      { name: 'Symbol Watchlist', href: '/watchlist',    icon: Star },
      { name: 'Tracked Traders',  href: '/trader-watch', icon: Eye },
      { name: 'Alerts',        href: '/alerts',        icon: Bell },
      { name: 'Invite',        href: '/invite',        icon: Gift },
    ],
  },
];

/* ─── Helpers ─── */
function fmtUsdShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPctSigned(n: number, digits = 2): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

/** Color a funding-rate cell green→red by sign + magnitude. Magenta at extremes. */
function fundingCellColor(rate: number): { bg: string; text: string; border?: string } {
  if (!Number.isFinite(rate) || rate === 0) {
    return { bg: 'rgba(255,255,255,0.025)', text: 'var(--fg-4)' };
  }
  const abs = Math.abs(rate);
  // Extreme magenta tier — used in the design for HYPE on Hyperliquid (+0.068%)
  if (abs >= 0.04) {
    return { bg: 'rgba(236,72,153,0.20)', text: '#f472b6', border: 'rgba(236,72,153,0.35)' };
  }
  if (rate > 0) {
    if (abs >= 0.015) return { bg: 'rgba(74,222,128,0.20)',  text: '#4ade80' };
    if (abs >= 0.008) return { bg: 'rgba(74,222,128,0.13)',  text: '#86efac' };
    return                     { bg: 'rgba(74,222,128,0.07)',  text: '#86efac' };
  }
  if (abs >= 0.015) return    { bg: 'rgba(248,113,113,0.20)', text: '#f87171' };
  if (abs >= 0.008) return    { bg: 'rgba(248,113,113,0.13)', text: '#fca5a5' };
  return                       { bg: 'rgba(248,113,113,0.07)', text: '#fca5a5' };
}

/* ─── Stat card variants — colored left rail + subtle directional gradient ─── */
type StatTone = 'neutral' | 'bullish' | 'bearish';
function StatCard({
  eyebrow, value, footer, tone = 'neutral',
}: {
  eyebrow: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  tone?: StatTone;
}) {
  const tones = {
    bullish:  { rail: '#4ade80', wash: 'rgba(74,222,128,0.05)',  border: 'rgba(74,222,128,0.18)' },
    bearish:  { rail: '#f87171', wash: 'rgba(248,113,113,0.05)', border: 'rgba(248,113,113,0.18)' },
    neutral:  { rail: 'rgba(255,255,255,0.10)', wash: 'transparent', border: 'var(--hub-border)' },
  } as const;
  const t = tones[tone];
  return (
    <div
      className="relative bg-hub-darker rounded-[var(--radius-lg)] p-4 transition-colors"
      style={{
        border: `1px solid ${t.border}`,
        background: `linear-gradient(135deg, ${t.wash} 0%, transparent 60%), var(--hub-darker)`,
      }}
    >
      {/* Colored left rail — 3px, full height, rounded */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
        style={{ background: t.rail }}
        aria-hidden
      />
      <div className="pl-1.5">
        <div className="eyebrow mb-2">{eyebrow}</div>
        <div className="num-mega text-[var(--fg-1)]" style={{ fontSize: 'var(--fs-32)' }}>{value}</div>
        {footer && <div className="meta-ds mt-1.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function CommandCenter() {
  const { status } = useSession();
  const router = useRouter();
  const handleCoinSelect = (coin: CoinSearchResult) => router.push(`/coin/${coin.id}`);
  const agg = useAggregatorHealth();

  // Live data via the same APIs the rest of the site uses
  const { data: oiData } = useApi<{ totalOI?: number; totalOIChange24h?: number }>({
    key: 'cc:oi-total',
    fetcher: async () => {
      const res = await fetch('/api/openinterest');
      if (!res.ok) throw new Error('oi fetch');
      const j = await res.json();
      const arr: Array<{ openInterestValue?: number }> = j.data ?? [];
      const total = arr.reduce((s, r) => s + (r.openInterestValue || 0), 0);
      return { totalOI: total };
    },
    refreshInterval: 60_000,
  });

  const { data: liqData } = useApi<{ totals: { totalValue: number; longPct: number; longValue: number; shortValue: number; count: number } }>({
    key: 'cc:liq-agg',
    fetcher: async () => {
      const res = await fetch('/api/liquidations/aggregate?hours=24');
      if (!res.ok) throw new Error('liq');
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const { data: fgData } = useApi<{
    value?: number;
    classification?: string;
    current?: { value: number; classification: string; timestamp: number };
    history?: Array<{ value: number; classification: string; timestamp: number }>;
  }>({
    key: 'cc:fear-greed',
    fetcher: async () => {
      // Was passing no history flag; the page footer used to render the
      // hardcoded "Yesterday 68 · Last week 52" without any real
      // historical signal. Now we request history=true so the footer can
      // show actual yesterday/last-week values when available. The
      // route returns `{ current, history }` in history mode, and flat
      // `{ value, classification }` in current-only mode — handle both.
      const res = await fetch('/api/fear-greed?history=true');
      if (!res.ok) throw new Error('fg');
      const json = await res.json();
      // Flatten so existing fgData.value / fgData.classification usage
      // below keeps working without conditional plumbing.
      if (json.current) {
        return { ...json.current, history: json.history };
      }
      return json;
    },
    refreshInterval: 300_000,
  });

  const { data: domData } = useApi<{ btcDominance: number; ethDominance: number; btcDominance24hChange?: number }>({
    key: 'cc:dominance',
    fetcher: async () => {
      const res = await fetch('/api/dominance');
      if (!res.ok) throw new Error('dom');
      return res.json();
    },
    refreshInterval: 300_000,
  });

  // Top Movers
  const { data: moversData } = useApi<{ gainers: Array<{ symbol: string; name?: string; price: number; change24h: number; rank?: number }> }>({
    key: 'cc:movers',
    fetcher: async () => {
      const res = await fetch('/api/top-movers');
      if (!res.ok) throw new Error('movers');
      return res.json();
    },
    refreshInterval: 60_000,
  });

  // Funding matrix (top 6 coins × top 6 exchanges)
  const { data: fundingRaw } = useApi<{ data?: Array<{ symbol: string; exchange: string; fundingRate: number }> }>({
    key: 'cc:funding',
    fetcher: async () => {
      const res = await fetch('/api/funding?assetClass=crypto');
      if (!res.ok) throw new Error('funding');
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const fundingMatrix = useMemo(() => {
    const COINS = ['BTC', 'ETH', 'SOL', 'HYPE', 'XRP', 'DOGE'];
    const EXCHS = ['Binance', 'Bybit', 'OKX', 'Hyperliquid', 'Coinbase', 'MEXC'];
    const rows = fundingRaw?.data ?? [];
    const map = new Map<string, number>();
    for (const r of rows) {
      if (!COINS.includes(r.symbol)) continue;
      if (!EXCHS.includes(r.exchange)) continue;
      map.set(`${r.symbol}|${r.exchange}`, r.fundingRate);
    }
    return { COINS, EXCHS, lookup: (sym: string, ex: string) => map.get(`${sym}|${ex}`) ?? null };
  }, [fundingRaw]);

  // Liquidations recent-feed hook removed (May 2026) — it polled
  // /api/openinterest every 30s, swallowed the entire 600+KB response,
  // and the resulting `liqRecent` binding was never consumed anywhere
  // in this file. Pure waste: thousands of unused-payload fetches per
  // landing-page session × every signed-in user. When the real
  // liquidations slide-in rows ship, wire it to /api/liquidations
  // (which is actually a liquidation feed) — not /api/openinterest.

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <MarketTiles />

      <div className="max-w-[1600px] mx-auto flex">
        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-[var(--hub-border-subtle)] sticky top-[82px] h-[calc(100vh-82px)] overflow-y-auto py-3">
          <div className="px-3 pb-3">
            <CoinSearch onSelect={handleCoinSelect} placeholder="Search coin…" className="w-full" compact />
          </div>
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="px-2 mb-3">
              <div className="eyebrow px-2 mb-1">{group.label}</div>
              {group.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-2 px-2 py-[7px] rounded-md text-[13px] text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--hub-border-subtle)] transition-colors"
                >
                  <item.icon className="w-3.5 h-3.5 flex-shrink-0 text-[var(--fg-4)] group-hover:text-[var(--hub-accent)]" />
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.badge && (
                    <span className="text-[10px] font-mono tabular-nums text-[var(--fg-4)] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-3 h-3 text-transparent group-hover:text-[var(--fg-4)]" />
                </Link>
              ))}
            </div>
          ))}
        </aside>

        {/* ── Main column ───────────────────────────────────────────── */}
        <main id="main-content" className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6">
          {/* Hero */}
          <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
            <div>
              <h1 className="text-[28px] sm:text-[32px] font-extrabold text-white tracking-[-0.025em] leading-[1.1] mb-1">
                Command Center
              </h1>
              <p className="text-[13px] text-[var(--fg-3)] leading-relaxed max-w-2xl">
                Real-time derivatives intelligence. Funding, OI, liquidations across {ALL_EXCHANGES.length} exchanges, one screen.
              </p>
            </div>
            {/* Was: unconditional green dot + "Live · streaming · 32 exchanges".
                Showed bright "Live" even when every aggregator venue was
                disconnected. Now we drive the dot + label off the same
                /health hook that the StatusBar uses. */}
            <div className="flex flex-col items-end gap-1 text-[11px] font-mono tabular-nums text-[var(--fg-4)]">
              <div className="inline-flex items-center gap-1.5">
                {agg.status === 'streaming' ? (
                  <>
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[var(--long)]">
                      <span className="absolute inset-0 rounded-full bg-[var(--long)] animate-ping opacity-60" />
                    </span>
                    <span className="text-[var(--long)] font-semibold uppercase tracking-widest">Live</span>
                    <span className="text-[var(--fg-5)]">·</span>
                    <span>streaming</span>
                  </>
                ) : agg.status === 'degraded' ? (
                  <>
                    <span className="inline-flex w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-amber-400 font-semibold uppercase tracking-widest">Degraded</span>
                    <span className="text-[var(--fg-5)]">·</span>
                    <span>{agg.connected}/{agg.total} venues</span>
                  </>
                ) : agg.status === 'offline' ? (
                  <>
                    <span className="inline-flex w-1.5 h-1.5 rounded-full bg-[var(--short)]" />
                    <span className="text-[var(--short)] font-semibold uppercase tracking-widest">Offline</span>
                    <span className="text-[var(--fg-5)]">·</span>
                    <span>retrying</span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex w-1.5 h-1.5 rounded-full bg-neutral-500" />
                    <span className="text-neutral-400 font-semibold uppercase tracking-widest">Connecting</span>
                  </>
                )}
              </div>
              <div>
                {agg.total > 0 ? `${agg.total} exchanges` : '— exchanges'} <span className="text-[var(--fg-5)]">·</span> v2.0
              </div>
            </div>
          </div>

          {/* 4-card stat strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <StatCard
              eyebrow="◷ TOTAL OI"
              tone="bullish"
              value={fmtUsdShort(oiData?.totalOI ?? 0)}
              // Was: hardcoded "▲ +3.8% 24h" — the fetcher never
              // populates totalOIChange24h, so the literal was shown to
              // every user as fact. Dropped until /api/oi-delta is
              // wired through to the aggregator response.
              footer={<span className="text-[var(--fg-5)]">aggregated</span>}
            />
            <StatCard
              eyebrow="⚡ LIQUIDATED 24H"
              tone="bearish"
              value={<span className="text-[var(--short)]">{fmtUsdShort(liqData?.totals?.totalValue ?? 0)}</span>}
              footer={liqData?.totals
                ? <span><span className="text-[var(--short)]">▼ longs {liqData.totals.longPct.toFixed(0)}%</span></span>
                : '—'}
            />
            <StatCard
              eyebrow="◴ FEAR & GREED"
              value={fgData?.value ?? '—'}
              // Was: "yesterday {value > 50 ? value-5 : value+5}" — pure
              // arithmetic on today's reading shown as historical data.
              // /api/fear-greed only returns today's value. Show only
              // the classification (which is honest) until we wire
              // ?history=true.
              footer={fgData ? <span>{fgData.classification}</span> : '—'}
            />
            <StatCard
              eyebrow="₿ BTC DOMINANCE"
              value={`${(domData?.btcDominance ?? 0).toFixed(1)}%`}
              // Was: "▲ cycle high · 1D" — marketing copy, not
              // computed. Replaced with the actual 24h change when
              // available; falls back to a static label otherwise.
              footer={typeof domData?.btcDominance24hChange === 'number'
                ? <span><span className={domData.btcDominance24hChange >= 0 ? 'text-[var(--long)]' : 'text-[var(--short)]'}>{domData.btcDominance24hChange >= 0 ? '▲' : '▼'} {Math.abs(domData.btcDominance24hChange).toFixed(2)}%</span> <span className="text-[var(--fg-5)]">· 24h</span></span>
                : <span className="text-[var(--fg-5)]">vs all crypto</span>}
            />
          </div>

          {/* Funding matrix */}
          <section className="mb-5">
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-2">
                <h2 className="h3-ds inline-flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[var(--hub-accent)]" />
                  Funding · 8h <span className="text-[var(--fg-3)] font-medium">— who&apos;s paying whom</span>
                </h2>
              </div>
              {/* Was: "2s lag" — fake latency claim. Our funding cache TTL
                  is 30-60s and the API doesn't measure end-to-end lag, so
                  the literal was straight made-up. */}
              <div className="meta-ds">
                {agg.total > 0 ? `${agg.total} exchanges` : '— exchanges'}
              </div>
            </div>
            <div className="bg-hub-darker border border-[var(--hub-border)] rounded-[var(--radius-lg)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--hub-border-subtle)]">
                      <th className="eyebrow text-left px-4 py-2 sticky left-0 bg-hub-darker">Coin</th>
                      {fundingMatrix.EXCHS.map(ex => (
                        <th key={ex} className="eyebrow text-right px-4 py-2 whitespace-nowrap">{ex}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fundingMatrix.COINS.map(coin => (
                      <tr key={coin} className="border-b border-[var(--hub-border-subtle)] last:border-0 hover:bg-[var(--hub-border-subtle)]">
                        <td className="px-4 py-2 sticky left-0 bg-hub-darker">
                          <span className="font-bold text-[var(--fg-1)]">{coin}</span>
                        </td>
                        {fundingMatrix.EXCHS.map(ex => {
                          const r = fundingMatrix.lookup(coin, ex);
                          if (r == null) {
                            return <td key={ex} className="px-4 py-2 text-right num text-[var(--fg-5)]">—</td>;
                          }
                          const c = fundingCellColor(r);
                          return (
                            <td key={ex} className="px-4 py-1.5 text-right">
                              <span
                                className="inline-block num font-mono text-[12px] font-semibold tabular-nums px-2 py-1 rounded-[var(--radius-xs)] min-w-[78px] text-center"
                                style={{
                                  background: c.bg,
                                  color: c.text,
                                  border: c.border ? `1px solid ${c.border}` : 'none',
                                }}
                              >
                                {fmtPctSigned(r, 4)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Liquidations forced exits */}
            <div className="lg:col-span-1 bg-hub-darker border border-[var(--hub-border)] rounded-[var(--radius-lg)] p-4 min-h-[280px]">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="h4-ds inline-flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[var(--short)]" />
                  Liquidations <span className="text-[var(--fg-3)] font-normal">· forced exits</span>
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[var(--short)]">
                    <span className="absolute inset-0 rounded-full bg-[var(--short)] animate-ping opacity-60" />
                  </span>
                </h3>
                <div className="meta-ds">last 1m <span className="text-[var(--fg-5)]">·</span> {fmtUsdShort(liqData?.totals?.totalValue ?? 0)} vaporized</div>
              </div>
              <div className="text-center py-12 text-[var(--fg-5)] text-[12px]">
                Live forced-close ticker streams here.
              </div>
            </div>

            {/* Top Movers */}
            <div className="lg:col-span-1 bg-hub-darker border border-[var(--hub-border)] rounded-[var(--radius-lg)] p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="h4-ds inline-flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-[var(--hub-accent)]" />
                  Top Movers <span className="text-[var(--fg-3)] font-normal">· 24h</span>
                </h3>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--fg-5)] font-semibold">
                  <span>1h</span><span className="text-[var(--fg-5)]">·</span><span>4h</span><span className="text-[var(--fg-5)]">·</span><span className="text-[var(--hub-accent)]">1d</span>
                </div>
              </div>
              <div>
                {(moversData?.gainers ?? []).slice(0, 5).map((m, i) => (
                  <Link
                    key={m.symbol}
                    href={`/coin/${m.symbol.toLowerCase()}`}
                    className="grid grid-cols-[26px,1fr,auto] items-center gap-3 px-2 py-2 rounded-md hover:bg-[var(--hub-border-subtle)] transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-[var(--hub-accent)]/15 text-[var(--hub-accent)] flex items-center justify-center font-bold text-[10px]">
                      {m.symbol.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--fg-1)] truncate leading-tight">{m.name || m.symbol}</div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--fg-4)] font-mono leading-tight">
                        {m.symbol} <span className="text-[var(--fg-5)]">·</span> #{m.rank ?? i + 1}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="num text-[12.5px] text-[var(--fg-1)] font-semibold tabular-nums">
                        ${m.price < 1 ? m.price.toFixed(4) : m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className={`inline-flex items-center justify-end gap-0.5 num text-[10.5px] font-bold tabular-nums px-1.5 py-0.5 rounded mt-0.5 ${m.change24h >= 0 ? 'bg-[rgba(74,222,128,0.10)] text-[var(--long)]' : 'bg-[rgba(248,113,113,0.10)] text-[var(--short)]'}`}>
                        {m.change24h >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {fmtPctSigned(m.change24h, 2)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Fear & Greed gauge */}
            <div className="lg:col-span-1 bg-hub-darker border border-[var(--hub-border)] rounded-[var(--radius-lg)] p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="h4-ds inline-flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-[var(--hub-accent)]" />
                  Fear &amp; Greed
                </h3>
                <div className="meta-ds">crowd temperature <span className="text-[var(--fg-5)]">·</span> 1D</div>
              </div>
              <div className="flex flex-col items-center justify-center py-3">
                {/* Semicircle gauge */}
                <FearGreedGauge value={fgData?.value ?? 50} />
                <div className="num-mega mt-2" style={{ fontSize: 'var(--fs-40)' }}>
                  {fgData?.value ?? '—'}
                </div>
                <div className="eyebrow text-[var(--hub-accent)]">{(fgData?.classification ?? '').toUpperCase()}</div>
                {/* Was: hardcoded "Yesterday 68 · Last week 52" — fake
                    historical values that never changed. Now derived from
                    the real /api/fear-greed?history=true payload, with
                    graceful degrade when history isn't there. */}
                <div className="meta-ds mt-1">
                  {(() => {
                    const hist = fgData?.history;
                    if (!Array.isArray(hist) || hist.length === 0) return ' ';
                    const now = Date.now();
                    const yesterday = hist.find(p => now - p.timestamp >= 22 * 3600_000 && now - p.timestamp <= 26 * 3600_000);
                    const lastWeek = hist.find(p => now - p.timestamp >= 6.5 * 86400_000 && now - p.timestamp <= 7.5 * 86400_000);
                    const parts: string[] = [];
                    if (yesterday) parts.push(`Yesterday ${Math.round(yesterday.value)}`);
                    if (lastWeek) parts.push(`Last week ${Math.round(lastWeek.value)}`);
                    return parts.length ? parts.join(' · ') : ' ';
                  })()}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}

/* ─── Mini fear-and-greed semicircle gauge ─── */
function FearGreedGauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const angleDeg = (v / 100) * 180; // 0° = far left, 180° = far right
  return (
    <div className="relative w-[220px] h-[120px]" aria-hidden>
      <svg viewBox="0 0 220 120" className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          <linearGradient id="fg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#f87171" />
            <stop offset="35%"  stopColor="#fb923c" />
            <stop offset="50%"  stopColor="#fbbf24" />
            <stop offset="65%"  stopColor="#a3e635" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        {/* Track (faint) */}
        <path
          d="M 15 105 A 95 95 0 0 1 205 105"
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Active arc with gradient */}
        <path
          d="M 15 105 A 95 95 0 0 1 205 105"
          fill="none"
          stroke="url(#fg-grad)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Major tick marks at 0/25/50/75/100 */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const angle = Math.PI * (1 - p);
          const cx = 110 + Math.cos(angle) * 95;
          const cy = 105 - Math.sin(angle) * 95;
          return <circle key={i} cx={cx} cy={cy} r="1.5" fill="rgba(255,255,255,0.3)" />;
        })}
      </svg>
      {/* Needle */}
      <div
        className="absolute left-1/2 bottom-[15px] h-[80px] w-[2px] bg-[var(--fg-1)] rounded-full shadow-lg"
        style={{
          transform: `translateX(-50%) rotate(${angleDeg - 90}deg)`,
          transformOrigin: '50% 100%',
          transition: 'transform 700ms cubic-bezier(0.4,0,0.2,1)',
        }}
      />
      <div className="absolute left-1/2 bottom-[12px] -translate-x-1/2 w-3 h-3 rounded-full bg-[var(--fg-1)] ring-[3px] ring-[var(--hub-darker)]" />
    </div>
  );
}
