'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReferralBanner from '@/components/ReferralBanner';
import ShareButton from '@/components/ShareButton';
import { useApi } from '@/hooks/useSWRApi';
import { fetchPredictionMarkets } from '@/lib/api/aggregator';
import {
  RefreshCw, AlertTriangle, Crosshair, Search, Info,
  ArrowRightLeft, Zap, Eye, TrendingUp, Shield,
  ChevronDown, BarChart3, DollarSign, Clock, Target,
  Layers, Globe, ArrowRight,
} from 'lucide-react';
import DataFreshness from '@/components/DataFreshness';
import SoftAuthGate, { useAuthLimit } from '@/components/SoftAuthGate';
import StatsCards from './components/StatsCards';
import ArbitrageView from './components/ArbitrageView';
import BrowseView from './components/BrowseView';
import type { PredictionPlatform } from '@/lib/api/prediction-markets/types';

type ViewMode = 'arbitrage' | 'browse';

const PLATFORM_LABELS: Record<PredictionPlatform, string> = {
  polymarket: 'Polymarket',
  kalshi: 'Kalshi',
  manifold: 'Manifold',
};

const PLATFORM_META: Record<PredictionPlatform, { color: string; type: string }> = {
  polymarket: { color: 'text-purple-400', type: 'Crypto (USDC)' },
  kalshi: { color: 'text-blue-400', type: 'USD (Regulated)' },
  manifold: { color: 'text-green-400', type: 'Play Money' },
};

export default function PredictionMarketsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('arbitrage');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const authLimit = useAuthLimit(5);
  const tableRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: / to focus search, Escape to clear
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && searchRef.current === document.activeElement) {
        setSearchTerm('');
        searchRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const fetcher = useCallback(() => fetchPredictionMarkets(), []);

  const { data, error, isLoading, lastUpdate, refresh } = useApi({
    key: 'prediction-markets',
    fetcher,
    refreshInterval: 60000,
  });

  const allArbitrage = Array.isArray(data?.arbitrage) ? data.arbitrage : [];
  const arbitrage = authLimit ? allArbitrage.slice(0, authLimit) : allArbitrage;
  const allMarkets = data?.markets ?? { polymarket: [], kalshi: [], manifold: [] };
  const markets = authLimit ? {
    polymarket: allMarkets.polymarket.slice(0, 10),
    kalshi: allMarkets.kalshi.slice(0, 10),
    manifold: allMarkets.manifold.slice(0, 10),
  } : allMarkets;
  const meta = data?.meta;

  const totalMarkets = meta
    ? Object.values(meta.counts).reduce((s, n) => s + n, 0)
    : 0;

  const activePlatforms = meta
    ? (Object.entries(meta.counts) as [PredictionPlatform, number][])
        .filter(([, c]) => c > 0)
        .map(([p]) => PLATFORM_LABELS[p])
    : [];

  const categories = useMemo(() => {
    const cats = new Set<string>();
    arbitrage.forEach(a => cats.add(a.category));
    for (const list of Object.values(markets)) {
      if (!Array.isArray(list)) continue;
      for (const m of list) {
        if (m.category) cats.add(m.category);
      }
    }
    return ['all', ...Array.from(cats).sort()];
  }, [arbitrage, markets]);

  const scrollToTable = () => {
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">

        {/* ── Hero Section ────────────────────────────────────────────── */}
        <section className="relative mb-8">
          {/* Subtle gradient bg */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/[0.04] via-transparent to-hub-yellow/[0.03] pointer-events-none" />

          <div className="relative px-6 py-8 sm:py-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0 ring-1 ring-purple-500/20">
                    <Crosshair className="w-4.5 h-4.5 text-purple-400" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">
                    Cross-Platform Scanner
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight mb-3" style={{ textWrap: 'balance' as any }}>
                  Find Mispriced Bets Across{' '}
                  <span className="text-purple-400">Polymarket</span>,{' '}
                  <span className="text-blue-400">Kalshi</span> &{' '}
                  <span className="text-green-400">Manifold</span>
                </h1>

                <p className="text-neutral-400 text-sm sm:text-base leading-relaxed max-w-xl">
                  Same event. Different platforms. Different prices. InfoHub scans thousands of prediction markets in real-time, surfaces matched pairs with pricing gaps, and shows you exactly where the spread is.
                </p>

                <div className="flex flex-wrap items-center gap-3 mt-5">
                  <button
                    onClick={scrollToTable}
                    className="px-5 py-2.5 rounded-xl bg-hub-yellow text-black text-sm font-semibold hover:bg-hub-yellow/90 transition-colors flex items-center gap-2"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    View Opportunities
                  </button>
                  <div className="flex items-center gap-2">
                    <DataFreshness exchangeCount={activePlatforms.length} lastUpdated={lastUpdate} />
                    <ShareButton text="Prediction market arbitrage on InfoHub" />
                    <button
                      onClick={refresh}
                      disabled={isLoading}
                      aria-label="Refresh"
                      className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Platform badges */}
              <div className="flex lg:flex-col gap-2">
                {(Object.entries(PLATFORM_META) as [PredictionPlatform, typeof PLATFORM_META[PredictionPlatform]][]).map(([key, p]) => {
                  const count = meta?.counts[key] ?? 0;
                  return (
                    <div key={key} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${key === 'polymarket' ? 'bg-purple-400' : key === 'kalshi' ? 'bg-blue-400' : 'bg-green-400'}`} />
                      <div className="min-w-0">
                        <div className={`text-xs font-semibold ${p.color}`}>{PLATFORM_LABELS[key]}</div>
                        <div className="text-[10px] text-neutral-600">{p.type} · {count} markets</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ───────────────────────────────────────────────────── */}
        <StatsCards arbitrage={arbitrage} meta={meta} />

        {/* ── Why Spreads Exist (collapsed by default) ────────────────── */}
        <HowItWorks />

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div ref={tableRef} className="flex flex-col lg:flex-row gap-3 mb-4 scroll-mt-4">
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-500 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06] flex-shrink-0">
              {([
                { key: 'arbitrage' as const, label: 'Arbitrage', icon: ArrowRightLeft },
                { key: 'browse' as const, label: 'Browse', icon: Layers },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    viewMode === key
                      ? 'bg-hub-yellow text-black'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search markets... (press /)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/40"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────── */}
        {isLoading && !data ? (
          <LoadingSkeleton />
        ) : (
          <>
            {viewMode === 'arbitrage' && (
              <ArbitrageView
                arbitrage={arbitrage}
                searchTerm={searchTerm}
                categoryFilter={categoryFilter}
              />
            )}
            {viewMode === 'browse' && (
              <BrowseView
                markets={markets}
                searchTerm={searchTerm}
                categoryFilter={categoryFilter}
              />
            )}

            {authLimit && (
              <SoftAuthGate
                freeLimit={viewMode === 'arbitrage' ? 5 : 10}
                totalCount={viewMode === 'arbitrage' ? allArbitrage.length : (allMarkets.polymarket.length + allMarkets.kalshi.length + allMarkets.manifold.length)}
                dataLabel={viewMode === 'arbitrage' ? 'arb opportunities' : 'markets'}
              />
            )}
          </>
        )}

        {/* ── Disclaimer ──────────────────────────────────────────────── */}
        <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-neutral-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-neutral-500 text-xs leading-relaxed">
                Prediction market prices represent implied probabilities (0-100%). A spread indicates the same event is priced differently across platforms — it does not guarantee profit.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-neutral-600">
                <span><span className="text-purple-400/70">Polymarket</span> — Crypto (USDC on Polygon)</span>
                <span><span className="text-blue-400/70">Kalshi</span> — USD, US-regulated</span>
                <span><span className="text-green-400/70">Manifold</span> — Play money (Mana)</span>
              </div>
              <p className="text-neutral-600 text-[10px]">
                Execution risk, fees, withdrawal limits, and market liquidity all affect real-world returns. This tool surfaces pricing data — not financial advice.
              </p>
            </div>
          </div>
        </div>

        {/* API errors */}
        {meta?.errors && meta.errors.length > 0 && (
          <div className="mt-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <p className="text-neutral-600 text-[10px]">
              API warnings: {meta.errors.join(' | ')}
            </p>
          </div>
        )}

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <section className="mt-8 mb-4 text-center">
          <div className="inline-flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-gradient-to-br from-purple-500/[0.06] via-transparent to-hub-yellow/[0.04] border border-white/[0.06]">
            <p className="text-neutral-400 text-sm max-w-md">
              Stop checking three platforms manually. InfoHub scans every matched market, calculates the spread, and ranks the best opportunities.
            </p>
            <button
              onClick={() => { setViewMode('arbitrage'); scrollToTable(); }}
              className="px-5 py-2 rounded-xl bg-hub-yellow text-black text-sm font-semibold hover:bg-hub-yellow/90 transition-colors flex items-center gap-2"
            >
              View Arbitrage Opportunities
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>
      <ReferralBanner />
      <Footer />
    </div>
  );
}


/* ─── How It Works (collapsible educational section) ─────────────────────── */

function HowItWorks() {
  const [open, setOpen] = useState(false);

  const steps = [
    {
      icon: Target,
      title: 'Match',
      desc: 'We scan Polymarket, Kalshi, and Manifold for events that reference the same real-world outcome. Curated matches are hand-verified. Auto-matches use fuzzy question similarity.',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      icon: Eye,
      title: 'Compare',
      desc: 'For each matched pair, we pull the YES and NO price from both platforms. The spread is the difference in implied probability.',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      icon: Zap,
      title: 'Signal',
      desc: 'Every pair is ranked by spread size with the optimal direction, profit per $1K deployed, and vig on each side.',
      color: 'text-hub-yellow',
      bg: 'bg-hub-yellow/10',
    },
    {
      icon: ArrowRight,
      title: 'Act',
      desc: 'Direct links to both platforms. Volume, liquidity, and open interest displayed so you can assess execution depth.',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
  ];

  const reasons = [
    { icon: Globe, text: 'Different user bases price risk independently — Polymarket (global crypto), Kalshi (US regulated), Manifold (play money).' },
    { icon: BarChart3, text: 'Spreads appear on every major event — elections, Fed decisions, crypto milestones, sports. Prices almost never match.' },
    { icon: Clock, text: 'Manual scanning doesn\'t scale. InfoHub checks every active market across all platforms every 60 seconds.' },
    { icon: DollarSign, text: 'Each platform takes a cut via overround (YES + NO > 100%). We calculate and display the vig so you see the real edge.' },
  ];

  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.10] transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-sm text-neutral-400 font-medium">How prediction market arbitrage works</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-5 animate-fade-in">
          {/* Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative px-4 py-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                    </div>
                    <span className="text-[10px] font-mono text-neutral-600">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`text-sm font-semibold ${s.color}`}>{s.title}</span>
                  </div>
                  <p className="text-neutral-500 text-xs leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Why spreads exist */}
          <div className="px-4 py-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Why cross-platform spreads exist</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reasons.map((r, i) => {
                const Icon = r.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <Icon className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0 mt-0.5" />
                    <p className="text-neutral-500 text-xs leading-relaxed">{r.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Loading skeleton ───────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-white/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-white/[0.06]" />
              <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
            </div>
            <div className="w-16 h-8 rounded-lg bg-white/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}
