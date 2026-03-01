'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@/hooks/useSWRApi';
import { fetchExecutionCosts } from '@/lib/api/aggregator';
import { Direction, ExecutionCostResponse } from '@/lib/execution-costs/types';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import AssetSelector from './components/AssetSelector';
import SizeSelector from './components/SizeSelector';
import DirectionToggle from './components/DirectionToggle';
import VenueCard from './components/VenueCard';
import CostBreakdownTable from './components/CostBreakdownTable';
import DepthChart from './components/DepthChart';
import { RefreshCw, AlertTriangle, Share2, Check, Info } from 'lucide-react';
import { DEFAULT_ASSETS } from '@/lib/execution-costs/symbol-map';

const STORAGE_KEY = 'execCost_prefs';

function loadPrefs(): { asset: string; size: number; direction: Direction } {
  if (typeof window === 'undefined') return { asset: 'BTC', size: 100_000, direction: 'long' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { asset: 'BTC', size: 100_000, direction: 'long' };
    const parsed = JSON.parse(raw);
    return {
      asset: DEFAULT_ASSETS.includes(parsed.asset) ? parsed.asset : 'BTC',
      size: typeof parsed.size === 'number' && parsed.size >= 1000 ? parsed.size : 100_000,
      direction: parsed.direction === 'short' ? 'short' : 'long',
    };
  } catch { return { asset: 'BTC', size: 100_000, direction: 'long' }; }
}

export default function ExecutionCostsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ExecutionCostsInner />
    </Suspense>
  );
}

function ExecutionCostsInner() {
  const searchParams = useSearchParams();

  // Initialize from URL params > localStorage > defaults
  const [asset, setAsset] = useState(() => {
    const urlAsset = searchParams.get('asset')?.toUpperCase();
    if (urlAsset && DEFAULT_ASSETS.includes(urlAsset as any)) return urlAsset;
    return loadPrefs().asset;
  });
  const [size, setSize] = useState(() => {
    const urlSize = Number(searchParams.get('size'));
    if (urlSize >= 1000 && urlSize <= 10_000_000) return urlSize;
    return loadPrefs().size;
  });
  const [direction, setDirection] = useState<Direction>(() => {
    const urlDir = searchParams.get('direction');
    if (urlDir === 'long' || urlDir === 'short') return urlDir;
    return loadPrefs().direction;
  });
  const [copied, setCopied] = useState(false);

  // Persist to localStorage on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ asset, size, direction })); } catch {}
  }, [asset, size, direction]);

  const fetcher = useCallback(
    () => fetchExecutionCosts(asset, size, direction),
    [asset, size, direction],
  );

  const { data, error, isLoading, isRefreshing, lastUpdate, refresh } =
    useApi<ExecutionCostResponse>({
      key: 'execution-costs',
      fetcher,
      refreshInterval: 15_000,
    });

  // Detect stale data: response doesn't match current parameters
  const isStale = data ? (data.asset !== asset || data.size !== size || data.direction !== direction) : false;
  const activeData = isStale ? null : data;

  const availableVenues = activeData?.venues.filter(v => v.available) ?? [];
  const unavailableVenues = activeData?.venues.filter(v => !v.available) ?? [];
  const topVenues = availableVenues.slice(0, 3);
  const restVenues = availableVenues.slice(3);

  const handleShare = async () => {
    const url = `${window.location.origin}/execution-costs?asset=${asset}&size=${size}&direction=${direction}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Execution <span className="text-gradient">Costs</span></h1>
            <p className="text-neutral-500 text-sm mt-1">
              Compare real-time execution costs across DEX perpetual exchanges
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UpdatedAgo date={lastUpdate} />
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors text-xs font-medium"
              title="Copy shareable link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Share'}
            </button>
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors text-xs font-medium disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-medium">Asset</span>
            <AssetSelector value={asset} onChange={setAsset} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-medium">Direction</span>
            <DirectionToggle value={direction} onChange={setDirection} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-medium">Size</span>
            <SizeSelector value={size} onChange={setSize} />
          </div>
        </div>

        {/* Info box */}
        <div className="mb-6 p-3 rounded-xl text-xs leading-relaxed text-neutral-500" style={{ background: 'linear-gradient(135deg, rgba(255,165,0,0.04) 0%, rgba(255,165,0,0.01) 100%)', border: '1px solid rgba(255,165,0,0.08)' }}>
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-hub-yellow mt-0.5 flex-shrink-0" />
            <p>
              <span className="text-white font-medium">Total cost</span> = <span className="text-neutral-300">Fee</span> + <span className="text-neutral-300">Spread</span> + <span className="text-neutral-300">Impact</span>.{' '}
              <span className="text-neutral-300">Fee</span> is the exchange taker fee.{' '}
              <span className="text-neutral-300">Spread</span> is the bid-ask gap cost (present even for tiny orders).{' '}
              <span className="text-neutral-300">Impact</span> is the additional cost from consuming orderbook depth at your order size.
              AMM venues (gTrade, GMX) use formula-based pricing with no spread.
            </p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {(isLoading || isStale) && !activeData && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 animate-pulse">
                  <div className="h-4 bg-white/[0.06] rounded w-24 mb-3" />
                  <div className="h-8 bg-white/[0.06] rounded w-20 mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-white/[0.04] rounded w-full" />
                    <div className="h-3 bg-white/[0.04] rounded w-full" />
                    <div className="h-3 bg-white/[0.04] rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-[300px] rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
          </div>
        )}

        {/* Results */}
        {activeData && (
          <div className="space-y-6">
            {/* Not enough data warning */}
            {availableVenues.length < 2 && availableVenues.length > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Limited data — only {availableVenues.length} venue{availableVenues.length !== 1 ? 's' : ''} returned results for {asset}
              </div>
            )}

            {availableVenues.length === 0 && (
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                <AlertTriangle className="w-6 h-6 text-neutral-600 mx-auto mb-2" />
                <p className="text-neutral-400 text-sm">No venues returned data for {asset}. This pair may not be listed on any DEX.</p>
              </div>
            )}

            {/* Top 3 venue cards */}
            {topVenues.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Execution Landscape</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {topVenues.map((v, i) => (
                    <VenueCard key={v.exchange} venue={v} rank={i + 1} asset={asset} />
                  ))}
                </div>
              </div>
            )}

            {/* Remaining venue cards (smaller) */}
            {restVenues.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {restVenues.map((v, i) => (
                  <VenueCard key={v.exchange} venue={v} rank={i + 4} asset={asset} />
                ))}
              </div>
            )}

            {/* Unavailable venues (collapsed) */}
            {unavailableVenues.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {unavailableVenues.map(v => (
                  <VenueCard key={v.exchange} venue={v} rank={99} asset={asset} />
                ))}
              </div>
            )}

            {/* Cost breakdown table */}
            {availableVenues.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Cost Breakdown</h2>
                <CostBreakdownTable venues={activeData.venues} asset={asset} />
              </div>
            )}

            {/* Depth chart */}
            {availableVenues.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Depth Visualization</h2>
                <DepthChart venues={activeData.venues} orderSizeUsd={size} />
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
