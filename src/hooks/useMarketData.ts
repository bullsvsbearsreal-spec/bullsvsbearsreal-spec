'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllTickers,
  fetchAllFundingRates,
  fetchAllOpenInterest,
  fetchAggregatedMarketData,
} from '@/lib/api/aggregator';
import { TickerData, FundingRateData, OpenInterestData } from '@/lib/api/types';

interface UseMarketDataOptions {
  refreshInterval?: number; // in milliseconds
  enabled?: boolean;
}

interface MarketDataState {
  tickers: TickerData[];
  fundingRates: FundingRateData[];
  openInterest: OpenInterestData[];
  totalVolume24h: number;
  totalOpenInterest: number;
  isLoading: boolean;
  error: Error | null;
  lastUpdate: number | null;
}

export function useMarketData(options: UseMarketDataOptions = {}) {
  const { refreshInterval = 30000, enabled = true } = options;

  const [state, setState] = useState<MarketDataState>({
    tickers: [],
    fundingRates: [],
    openInterest: [],
    totalVolume24h: 0,
    totalOpenInterest: 0,
    isLoading: true,
    error: null,
    lastUpdate: null,
  });

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      const data = await fetchAggregatedMarketData();

      setState({
        tickers: Array.from(data.tickers.values()),
        fundingRates: data.fundingRates,
        openInterest: data.openInterest,
        totalVolume24h: data.totalVolume24h,
        totalOpenInterest: data.totalOpenInterest,
        isLoading: false,
        error: null,
        lastUpdate: data.lastUpdate,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }, [enabled]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0 && enabled) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// Hook for tickers only
export function useTickers(options: UseMarketDataOptions = {}) {
  const { refreshInterval = 10000, enabled = true } = options;

  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      const data = await fetchAllTickers();
      setTickers(data);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0 && enabled) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  return { tickers, isLoading, error, refetch: fetchData };
}

// Hook for funding rates only
export function useFundingRates(options: UseMarketDataOptions = {}) {
  const { refreshInterval = 60000, enabled = true } = options;

  const [fundingRates, setFundingRates] = useState<FundingRateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      const data = await fetchAllFundingRates();
      setFundingRates(data);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0 && enabled) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  return { fundingRates, isLoading, error, refetch: fetchData };
}

// Hook for open interest only
export function useOpenInterest(options: UseMarketDataOptions = {}) {
  const { refreshInterval = 60000, enabled = true } = options;

  const [openInterest, setOpenInterest] = useState<OpenInterestData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      const data = await fetchAllOpenInterest();
      setOpenInterest(data);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0 && enabled) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  return { openInterest, isLoading, error, refetch: fetchData };
}