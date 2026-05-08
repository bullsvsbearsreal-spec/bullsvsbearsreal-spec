'use client';

/**
 * Dashboard v2 — editorial / opinionated layout, distinct from the
 * customizable widget grid at /dashboard.
 *
 * Differences vs. /dashboard:
 *  - Single scrollable canvas, no drag-drop, no widget picker
 *  - Larger numbers, more whitespace, gradient hero
 *  - Featured "Bounce stats" block (rekt leaderboard from bounce.tech)
 *  - Direct fetch (no widget context, no DashboardProvider)
 *
 * Sections (top → bottom):
 *  1. Hero strip — BTC + ETH + total mcap + 24h Δ
 *  2. Pulse cards — dominance / altseason / F&G / derivatives OI
 *  3. Top movers — 24h gainers + losers split
 *  4. Bounce stats — rekt leaderboard ecosystem totals + top 5
 *  5. Recent liquidations — 5 biggest in last 24h
 *  6. Headlines — top 5 news items
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import UsdDisplay from '@/components/UsdDisplay';
import {
  TrendingUp, TrendingDown, Skull, Newspaper,
  Flame, ArrowRight, Layers, Gauge, Sparkles, RefreshCw,
  ExternalLink, ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

interface GlobalStats {
  total_market_cap?: { usd?: number };
  total_volume?: { usd?: number };
  market_cap_percentage?: { btc?: number; eth?: number };
  market_cap_change_percentage_24h_usd?: number;
  total_derivatives_oi?: number;
  altcoin_season_index?: number;
}

interface FearGreed { value: number; classification: string; timestamp?: number }

interface MoverCoin {
  symbol: string;
  name?: string;
  slug?: string;
  price: number;
  change24h: number;
}

interface RektRow {
  rank: number;
  address: string;
  totalNotional: number;
  count: number;
  score: number;
}
interface RektResponse {
  data: RektRow[];
  summary: {
    totalRekt: number;
    totalWallets: number;
    totalLiquidations: number;
    biggestLoser: string | null;
    biggestLoserNotional: number;
    biggestScore: number;
  };
  meta: { timestamp: number };
}

interface LiqEvent {
  side: 'long' | 'short';
  size: number;
  price: number;
  value: number;
  timestamp: number;
}
interface LiqResponse {
  symbol: string;
  exchange: string;
  data: LiqEvent[];
}

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number; // ms epoch
}
interface NewsResponse {
  articles: NewsItem[];
}

interface Ticker {
  symbol: string;
  price?: number;
  lastPrice?: number;
  priceChangePercent24h?: number;
  change24h?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function shortAddr(a: string): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtPct(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtCompact(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPrice(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function relTime(ts?: number): string {
  if (!ts) return '';
  const ms = Date.now() - ts;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

function fearGreedColor(v: number): string {
  if (v <= 20) return 'text-rose-500';
  if (v <= 40) return 'text-orange-400';
  if (v <= 60) return 'text-amber-400';
  if (v <= 80) return 'text-lime-400';
  return 'text-emerald-400';
}

// ─── Hooks (lightweight, no SWR — keep component self-contained) ──────────

function useFetch<T>(url: string, intervalMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
    if (!intervalMs) return;
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { data, error, loading, reload: load };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function DashboardV2Page() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data: stats, loading: statsLoading, reload: reloadStats } =
    useFetch<GlobalStats>('/api/global-stats', 60_000);
  const { data: fg } = useFetch<FearGreed>('/api/fear-greed', 5 * 60_000);
  // Pull BTC + ETH from the multi-ticker endpoint in one call
  const { data: tickers } = useFetch<Ticker[] | { data: Ticker[] }>('/api/tickers?symbols=BTC,ETH', 30_000);
  const { data: movers, reload: reloadMovers } =
    useFetch<{ coins: MoverCoin[] }>('/api/top-movers?limit=200', 90_000);
  const { data: rekt, reload: reloadRekt } =
    useFetch<RektResponse>('/api/rekt-leaderboard?limit=10&sort=notional', 5 * 60_000);
  // Per-symbol — BTC's liq feed is the most representative cross-market signal
  const { data: liqs } =
    useFetch<LiqResponse>('/api/liquidations?symbol=BTC&limit=8', 60_000);
  const { data: news } = useFetch<NewsResponse>('/api/news?perPage=5', 5 * 60_000);

  // Resolve ticker rows with both legacy + canonical field names
  const tickerRows: Ticker[] = Array.isArray(tickers) ? tickers : (tickers?.data ?? []);
  const findTicker = (sym: string): Ticker | undefined =>
    tickerRows.find(t => t.symbol === sym || t.symbol === `${sym}USDT`);
  const btc = findTicker('BTC');
  const eth = findTicker('ETH');
  const btcPrice = btc?.price ?? btc?.lastPrice;
  const btcChange = btc?.priceChangePercent24h ?? btc?.change24h;
  const ethPrice = eth?.price ?? eth?.lastPrice;
  const ethChange = eth?.priceChangePercent24h ?? eth?.change24h;

  const reloadAll = useCallback(() => {
    reloadStats();
    reloadMovers();
    reloadRekt();
  }, [reloadStats, reloadMovers, reloadRekt]);

  // Compute movers — sort + split into gainers/losers
  const gainers = (movers?.coins ?? [])
    .filter(c => Number.isFinite(c.change24h) && c.change24h > 0)
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 6);
  const losers = (movers?.coins ?? [])
    .filter(c => Number.isFinite(c.change24h) && c.change24h < 0)
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="text-white">
        {/* Top toolbar — sticky, sets the editorial tone */}
        <div className="sticky top-14 z-30 bg-hub-black/80 backdrop-blur-md border-b border-white/[0.04]">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-neutral-300 font-mono uppercase tracking-wider">Live</span>
            </div>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-500 font-mono">Updated {relTime(now - 5_000)}</span>
            <div className="ml-auto flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-neutral-500 hover:text-white transition-colors flex items-center gap-1"
                title="Switch to widget mode"
              >
                <Layers className="w-3 h-3" />
                <span className="hidden sm:inline">Widget mode</span>
              </Link>
              <button
                onClick={reloadAll}
                className="text-neutral-500 hover:text-hub-yellow transition-colors flex items-center gap-1"
                title="Refresh all"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-8">
          {/* ─── 1. Hero strip ──────────────────────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between gap-3 mb-3 px-1">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-white via-white to-neutral-400 bg-clip-text text-transparent">
                  Market Pulse
                </h1>
                <p className="text-xs text-neutral-500 mt-0.5">
                  At-a-glance view of price, flow, and stress across crypto
                </p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-neutral-600 px-2 py-1 rounded border border-white/[0.06] bg-white/[0.02]">
                v2 · editorial
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <HeroCard
                label="Bitcoin"
                value={fmtPrice(btcPrice)}
                delta={btcChange}
                accent="from-amber-500/20 to-transparent"
              />
              <HeroCard
                label="Ethereum"
                value={fmtPrice(ethPrice)}
                delta={ethChange}
                accent="from-blue-500/20 to-transparent"
              />
              <HeroCard
                label="Total market cap"
                value={fmtCompact(stats?.total_market_cap?.usd)}
                delta={stats?.market_cap_change_percentage_24h_usd}
                accent="from-emerald-500/20 to-transparent"
              />
              <HeroCard
                label="24h volume"
                value={fmtCompact(stats?.total_volume?.usd)}
                accent="from-violet-500/20 to-transparent"
                loading={statsLoading}
              />
            </div>
          </section>

          {/* ─── 2. Pulse cards (the macro vibe) ────────────────────────── */}
          <section>
            <SectionHeader icon={<Gauge className="w-3.5 h-3.5" />} label="Macro vibe" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <PulseCard
                label="BTC dominance"
                value={stats?.market_cap_percentage?.btc != null ? `${stats.market_cap_percentage.btc.toFixed(1)}%` : '—'}
                hint="Share of total mcap"
                href="/dominance"
              />
              <PulseCard
                label="Altseason index"
                value={stats?.altcoin_season_index != null ? `${stats.altcoin_season_index}/100` : '—'}
                hint={
                  stats?.altcoin_season_index != null
                    ? stats.altcoin_season_index >= 75 ? 'Altcoin Season'
                    : stats.altcoin_season_index <= 25 ? 'Bitcoin Season'
                    : 'Neutral'
                    : '—'
                }
                href="/altseason"
              />
              <PulseCard
                label="Fear & Greed"
                value={fg?.value != null ? String(fg.value) : '—'}
                hint={fg?.classification || '—'}
                href="/sentiment"
                valueClass={fg?.value != null ? fearGreedColor(fg.value) : ''}
              />
              <PulseCard
                label="Derivatives OI"
                value={fmtCompact(stats?.total_derivatives_oi)}
                hint="Open interest, all venues"
                href="/open-interest"
              />
            </div>
          </section>

          {/* ─── 3. Top movers ─────────────────────────────────────────── */}
          <section>
            <SectionHeader
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label="Top movers · 24h"
              cta={{ href: '/movers', label: 'All movers' }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MoverList title="Gainers" items={gainers} positive />
              <MoverList title="Losers"  items={losers} positive={false} />
            </div>
          </section>

          {/* ─── 4. Bounce stats — featured ───────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between gap-3 mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-rose-400"><Skull className="w-4 h-4" /></span>
                <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white">Bounce stats</h2>
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400/70 border border-rose-400/30 bg-rose-400/[0.06] px-1.5 py-0.5 rounded">
                  bounce.tech
                </span>
              </div>
              <Link href="/bounce" className="text-[11px] text-rose-400 hover:text-rose-300 inline-flex items-center gap-1">
                Full leaderboard <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="rounded-xl border border-rose-400/20 bg-gradient-to-br from-rose-500/[0.04] via-transparent to-transparent p-4 sm:p-5">
              <p className="text-[11px] text-neutral-500 mb-4 max-w-2xl">
                Bounce.tech tracks the biggest losers from Hyperliquid liquidations and lets them claim
                BOUNCE for their pain. Stats below mirror their public leaderboard — the wallets that
                got rekt the hardest, ranked by total notional liquidated.
              </p>

              {/* Ecosystem totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <BounceMetric
                  label="Total tracked"
                  value={fmtCompact(rekt?.summary.totalRekt)}
                  hint={`Top ${rekt?.data.length ?? 0} wallets`}
                  accent="text-rose-400"
                />
                <BounceMetric
                  label="Liquidation events"
                  value={rekt?.summary.totalLiquidations.toLocaleString() ?? '—'}
                  hint="across leaderboard"
                  accent="text-white"
                />
                <BounceMetric
                  label="Biggest loser"
                  value={rekt?.summary.biggestLoser ? shortAddr(rekt.summary.biggestLoser) : '—'}
                  hint={rekt?.summary.biggestLoserNotional ? fmtCompact(rekt.summary.biggestLoserNotional) : '—'}
                  accent="text-hub-yellow"
                  href={rekt?.summary.biggestLoser ? `/bounce/${rekt.summary.biggestLoser}` : undefined}
                />
                <BounceMetric
                  label="Max score"
                  value={rekt?.summary.biggestScore ? `${rekt.summary.biggestScore}/1000` : '—'}
                  hint="Pain index"
                  accent="text-orange-400"
                />
              </div>

              {/* Top 5 leaderboard preview */}
              <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                <div className="hidden sm:grid grid-cols-[40px_1fr_140px_80px_80px] gap-3 px-3 py-2 bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-neutral-500 border-b border-white/[0.04]">
                  <span>#</span>
                  <span>Wallet</span>
                  <span className="text-right">Rekt</span>
                  <span className="text-right">Events</span>
                  <span className="text-right">Score</span>
                </div>
                <ul className="divide-y divide-white/[0.04]">
                  {(rekt?.data ?? []).slice(0, 5).map((r, i) => (
                    <li key={r.address} className="grid grid-cols-[40px_1fr_140px_80px_80px] sm:grid-cols-[40px_1fr_140px_80px_80px] gap-3 px-3 py-2.5 hover:bg-white/[0.02] transition-colors items-center text-sm">
                      <span className={`font-mono font-bold ${i === 0 ? 'text-rose-400' : i === 1 ? 'text-orange-400' : i === 2 ? 'text-amber-400' : 'text-neutral-500'}`}>
                        #{r.rank}
                      </span>
                      <Link
                        href={`/bounce/${r.address}`}
                        className="font-mono text-neutral-300 hover:text-white truncate inline-flex items-center gap-1"
                      >
                        {shortAddr(r.address)}
                        <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                      </Link>
                      <span className="text-right font-mono tabular-nums text-rose-400 font-semibold">
                        {fmtCompact(r.totalNotional)}
                      </span>
                      <span className="text-right font-mono tabular-nums text-neutral-400 text-xs">
                        {r.count.toLocaleString()}
                      </span>
                      <span className="text-right font-mono tabular-nums text-white text-xs">
                        {r.score}
                      </span>
                    </li>
                  ))}
                  {!rekt && (
                    Array.from({ length: 5 }, (_, i) => (
                      <li key={i} className="px-3 py-2.5">
                        <div className="h-4 bg-white/[0.03] rounded animate-pulse" />
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </section>

          {/* ─── 5. Recent liquidations + News (2-col) ─────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <SectionHeader
                icon={<Flame className="w-3.5 h-3.5 text-rose-400" />}
                label={`Recent BTC liquidations · ${liqs?.exchange ?? 'OKX'}`}
                cta={{ href: '/liquidations', label: 'All' }}
              />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                {(liqs?.data ?? []).slice(0, 8).map((l, i) => (
                  <div
                    key={`${l.timestamp}-${i}`}
                    className="px-3 py-2 border-b border-white/[0.03] last:border-b-0 flex items-center gap-3 text-xs hover:bg-white/[0.02] transition-colors"
                  >
                    <span className={`w-1 h-6 rounded-full ${l.side === 'long' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                    <span className="font-mono font-bold text-white w-12">{liqs?.symbol ?? 'BTC'}</span>
                    <span className={`text-[10px] font-mono uppercase ${l.side === 'long' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {l.side}
                    </span>
                    <span className="text-rose-400 font-mono tabular-nums font-semibold">
                      <UsdDisplay amount={l.value} />
                    </span>
                    <span className="text-neutral-500 font-mono ml-auto text-[10px]">@ {fmtPrice(l.price)}</span>
                    <span className="text-neutral-600 font-mono text-[10px]">{relTime(l.timestamp)}</span>
                  </div>
                ))}
                {(!liqs || liqs.data?.length === 0) && (
                  <div className="px-3 py-8 text-center text-[11px] text-neutral-600">
                    {liqs ? 'No recent BTC liquidations' : 'Loading…'}
                  </div>
                )}
              </div>
            </div>

            <div>
              <SectionHeader
                icon={<Newspaper className="w-3.5 h-3.5" />}
                label="Top headlines"
                cta={{ href: '/news', label: 'More news' }}
              />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                {(news?.articles ?? []).slice(0, 5).map((n) => (
                  <a
                    key={n.id}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2.5 border-b border-white/[0.03] last:border-b-0 block hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="text-sm text-neutral-200 group-hover:text-white line-clamp-2 leading-snug">
                      {n.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-neutral-600">
                      {n.source && <span>{n.source}</span>}
                      {n.publishedAt && <span>· {relTime(n.publishedAt)}</span>}
                      <ExternalLink className="w-2.5 h-2.5 ml-auto opacity-40 group-hover:opacity-100" />
                    </div>
                  </a>
                ))}
                {(!news || news.articles?.length === 0) && (
                  <div className="px-3 py-8 text-center text-[11px] text-neutral-600">
                    {news ? 'No headlines' : 'Loading…'}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ─── 6. Footer CTA ─────────────────────────────────────────── */}
          <div className="text-center pt-4">
            <Link
              href="/dashboard"
              className="text-[11px] text-neutral-500 hover:text-white inline-flex items-center gap-1.5"
            >
              <Layers className="w-3 h-3" />
              Prefer the customizable widget grid? Switch back.
            </Link>
          </div>
        </div>
      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function HeroCard({
  label, value, delta, accent, loading,
}: { label: string; value: string; delta?: number; accent: string; loading?: boolean }) {
  const isPositive = delta != null && delta >= 0;
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br ${accent} p-4 hover:border-white/[0.12] transition-colors`}>
      <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 font-medium mb-1">
        {label}
      </div>
      <div className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${loading ? 'text-neutral-600' : 'text-white'}`}>
        {loading ? '…' : value}
      </div>
      {delta != null && Number.isFinite(delta) && (
        <div className={`text-xs font-mono tabular-nums mt-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3 inline -mt-0.5 mr-1" /> : <TrendingDown className="w-3 h-3 inline -mt-0.5 mr-1" />}
          {fmtPct(delta)}
        </div>
      )}
    </div>
  );
}

function PulseCard({
  label, value, hint, href, valueClass = 'text-white',
}: { label: string; value: string; hint: string; href: string; valueClass?: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all"
    >
      <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 font-medium mb-1 flex items-center justify-between">
        <span>{label}</span>
        <ArrowRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className={`text-xl font-bold font-mono tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-neutral-600 mt-0.5">{hint}</div>
    </Link>
  );
}

function SectionHeader({
  icon, label, cta,
}: { icon: React.ReactNode; label: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3 px-1">
      <div className="flex items-center gap-2">
        <span className="text-neutral-500">{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white">{label}</h2>
      </div>
      {cta && (
        <Link
          href={cta.href}
          className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1"
        >
          {cta.label} <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function MoverList({ title, items, positive }: { title: string; items: MoverCoin[]; positive: boolean }) {
  const dotClass = positive ? 'bg-emerald-400' : 'bg-rose-400';
  const pctClass = positive ? 'text-emerald-400' : 'text-rose-400';
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <span className="text-neutral-300">{title}</span>
      </div>
      <ul className="divide-y divide-white/[0.03]">
        {items.length === 0 && (
          <li className="px-3 py-6 text-center text-[11px] text-neutral-600">Loading…</li>
        )}
        {items.map((c) => (
          <li
            key={c.symbol}
            className="px-3 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
          >
            <span className="font-mono font-bold text-white w-14 text-sm truncate">{c.symbol}</span>
            <span className="font-mono tabular-nums text-xs text-neutral-300 flex-1">
              {fmtPrice(c.price)}
            </span>
            <span className={`font-mono tabular-nums text-sm font-semibold ${pctClass}`}>
              {fmtPct(c.change24h)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BounceMetric({
  label, value, hint, accent, href,
}: { label: string; value: string; hint: string; accent: string; href?: string }) {
  const inner = (
    <>
      <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-500 font-medium mb-1">
        {label}
      </div>
      <div className={`text-xl font-bold font-mono tabular-nums ${accent}`}>{value}</div>
      <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{hint}</div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-white/[0.06] bg-black/30 p-3 hover:border-rose-400/30 hover:bg-black/50 transition-all"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
      {inner}
    </div>
  );
}
