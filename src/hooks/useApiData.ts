'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiDataOptions<T> {
  fetcher: () => Promise<T>;
  refreshInterval?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
  retryCount?: number;
  retryDelay?: number;
}

interface UseApiDataReturn<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useApiData<T>({
  fetcher,
  refreshInterval,
  enabled = true,
  onError,
  onSuccess,
  retryCount = 3,
  retryDelay = 1000,
}: UseApiDataOptions<T>): UseApiDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!enabled) return;

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
        setLastUpdate(new Date());
        retriesRef.current = 0;
        onSuccess?.(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';

        // Retry logic
        if (retriesRef.current < retryCount) {
          retriesRef.current++;
          setTimeout(() => fetchData(isRefresh), retryDelay * retriesRef.current);
          return;
        }

        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [fetcher, enabled, onSuccess, onError, retryCount, retryDelay]);

  const refresh = useCallback(async () => {
    retriesRef.current = 0;
    await fetchData(true);
  }, [fetchData]);

  const retry = useCallback(async () => {
    retriesRef.current = 0;
    await fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  useEffect(() => {
    if (!refreshInterval || !enabled) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, enabled, fetchData]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    lastUpdate,
    refresh,
    retry,
  };
}

// Specialized hooks for common data types
export function useTickers() {
  return useApiData({
    fetcher: async () => {
      const { fetchAllTickers } = await import('@/lib/api/aggregator');
      return fetchAllTickers();
    },
    refreshInterval: 30000,
  });
}

export function useFundingRates() {
  return useApiData({
    fetcher: async () => {
      const { fetchAllFundingRates } = await import('@/lib/api/aggregator');
      return fetchAllFundingRates();
    },
    refreshInterval: 5 * 60 * 1000,
  });
}

export function useOpenInterest() {
  return useApiData({
    fetcher: async () => {
      const { fetchAllOpenInterest } = await import('@/lib/api/aggregator');
      return fetchAllOpenInterest();
    },
    refreshInterval: 2 * 60 * 1000,
  });
}
