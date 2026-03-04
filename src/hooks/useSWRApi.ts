'use client';

import useSWR, { SWRConfiguration } from 'swr';
import { useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Return shape — matches UseApiDataReturn from useApiData.ts for drop-in swap
// ---------------------------------------------------------------------------
interface UseApiReturn<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Generic useApi — drop-in replacement for useApiData
// ---------------------------------------------------------------------------
interface UseApiOptions<T> extends SWRConfiguration<T> {
  /** SWR cache key (string or array). null/undefined = paused. */
  key: string | readonly unknown[] | null;
  /** Async function that returns data */
  fetcher: () => Promise<T>;
  /** Auto-refresh interval in ms (maps to SWR refreshInterval) */
  refreshInterval?: number;
  /** Disable fetching */
  enabled?: boolean;
}

export function useApi<T>({
  key,
  fetcher,
  refreshInterval,
  enabled = true,
  ...swrConfig
}: UseApiOptions<T>): UseApiReturn<T> {
  const lastUpdateRef = useRef<Date | null>(null);

  const effectiveKey = enabled ? key : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    effectiveKey,
    fetcher,
    {
      refreshInterval,
      onSuccess: () => {
        lastUpdateRef.current = new Date();
      },
      ...swrConfig,
    },
  );

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    data: data ?? null,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    isLoading,
    isRefreshing: isValidating && !isLoading,
    lastUpdate: lastUpdateRef.current,
    refresh,
    retry: refresh,
  };
}

// ---------------------------------------------------------------------------
// Named hooks for common data — used by shared components (TopStatsBar, etc.)
// ---------------------------------------------------------------------------

export function useTickers() {
  return useApi({
    key: 'tickers',
    fetcher: async () => {
      const { fetchAllTickers } = await import('@/lib/api/aggregator');
      return fetchAllTickers();
    },
    refreshInterval: 60_000,
  });
}

export function useFundingRates(assetClass: string = 'crypto') {
  return useApi({
    key: `funding-${assetClass}`,
    fetcher: async () => {
      const { fetchAllFundingRates } = await import('@/lib/api/aggregator');
      return fetchAllFundingRates(assetClass as import('@/lib/api/aggregator').AssetClassFilter);
    },
    refreshInterval: 30_000,
  });
}

export function useOpenInterest() {
  return useApi({
    key: 'openInterest',
    fetcher: async () => {
      const { fetchAllOpenInterest } = await import('@/lib/api/aggregator');
      return fetchAllOpenInterest();
    },
    refreshInterval: 60_000,
  });
}

export function useMarketStats() {
  return useApi({
    key: 'marketStats',
    fetcher: async () => {
      const { fetchMarketStats } = await import('@/lib/api/aggregator');
      return fetchMarketStats();
    },
    refreshInterval: 30_000,
  });
}

export function useLongShort(symbol: string = 'BTCUSDT') {
  return useApi({
    key: `longShort-${symbol}`,
    fetcher: async () => {
      const { fetchLongShortRatio } = await import('@/lib/api/aggregator');
      return fetchLongShortRatio(symbol);
    },
    refreshInterval: 30_000,
  });
}

export function useOIChanges() {
  return useApi({
    key: 'oiChanges',
    fetcher: async () => {
      const { fetchOIChanges } = await import('@/lib/api/aggregator');
      return fetchOIChanges();
    },
    refreshInterval: 60_000,
  });
}

export function useExchangeHealth() {
  return useApi({
    key: 'exchangeHealth',
    fetcher: async () => {
      const { fetchExchangeHealth } = await import('@/lib/api/aggregator');
      return fetchExchangeHealth();
    },
    refreshInterval: 120_000,
  });
}

export function usePredictionMarkets() {
  return useApi({
    key: 'predictionMarkets',
    fetcher: async () => {
      const { fetchPredictionMarkets } = await import('@/lib/api/aggregator');
      return fetchPredictionMarkets();
    },
    refreshInterval: 60_000,
  });
}
