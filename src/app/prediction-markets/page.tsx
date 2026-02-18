'use client';

import { useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButton from '@/components/ShareButton';
import { useApiData } from '@/hooks/useApiData';
import { fetchPredictionMarkets } from '@/lib/api/aggregator';
import { RefreshCw, AlertTriangle, Crosshair, Search, Info } from 'lucide-react';
import StatsCards from './components/StatsCards';
import ArbitrageView from './components/ArbitrageView';
import BrowseView from './components/BrowseView';
import type { PredictionPlatform } from '@/lib/api/prediction-markets/types';

type ViewMode = 'arbitrage' | 'browse';

const PLATFORM_LABELS: Record<PredictionPlatform, string> = {
  polymarket: 'Polymarket',
  kalshi: 'Kalshi',
  manifold: 'Manifold',
  metaculus: 'Metaculus',
};

export default function PredictionMarketsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('arbitrage');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetcher = useCallback(() => fetchPredictionMarkets(), []);

  const { data, error, isLoading, lastUpdate, refresh } = useApiData({
    fetcher,
    refreshInterval: 60000,
  });

  const arbitrage = Array.isArray(data?.arbitrage) ? data.arbitrage : [];
  const markets = data?.markets ?? { polymarket: [], kalshi: [], manifold: [], metaculus: [] };
  const meta = data?.meta;

  const totalMarkets = meta
    ? Object.values(meta.counts).reduce((s, n) => s + n, 0)
    : 0;

  const activePlatforms = meta
    ? (Object.entries(meta.counts) as [PredictionPlatform, number][])
        .filter(([, c]) => c > 0)
        .map(([p]) => PLATFORM_LABELS[p])
    : [];

  // Extract unique categories from all platforms
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

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Crosshair className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Prediction Markets</h1>
              <div className="flex items-center gap-1.5">
                {data && (
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                )}
                <p className="text-neutral-500 text-sm">
                  Cross-platform arbitrage across {activePlatforms.length} platforms
                  {meta ? ` \u00b7 ${meta.matchedCount} matched \u00b7 ${totalMarkets} markets` : ''}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-neutral-600 font-mono">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
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

        {/* Stats */}
        <StatsCards arbitrage={arbitrage} meta={meta} />

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-3 mb-4">
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

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
              {([
                { key: 'arbitrage' as const, label: 'Arbitrage' },
                { key: 'browse' as const, label: 'Browse' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === key
                      ? 'bg-hub-yellow text-black'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search markets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-40 pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-hub-yellow/40"
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

        {/* Content */}
        {isLoading && !data ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-12 text-center">
            <RefreshCw className="w-5 h-5 text-hub-yellow animate-spin mx-auto mb-2" />
            <span className="text-neutral-500 text-sm">Loading prediction markets...</span>
          </div>
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
          </>
        )}

        {/* Disclaimer */}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-hub-yellow flex-shrink-0 mt-0.5" />
          <p className="text-neutral-500 text-xs leading-relaxed">
            Prices represent implied probabilities (0-100%). A spread indicates the same event is priced differently across platforms.
            Polymarket and Manifold use play money / crypto. Kalshi uses real USD. Metaculus uses crowd forecasting (no trading).
            Not financial advice.
          </p>
        </div>

        {/* API errors */}
        {meta?.errors && meta.errors.length > 0 && (
          <div className="mt-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <p className="text-neutral-600 text-[10px]">
              API warnings: {meta.errors.join(' | ')}
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
