import { fetchWithTimeout } from './fetch';

// A generic type for exchange data fetchers
export type ExchangeFetcher<T> = (
  fetchFn: typeof fetchWithTimeout
) => Promise<T[]>;

export interface ExchangeFetcherConfig<T> {
  name: string;
  fetcher: ExchangeFetcher<T>;
}

export interface ExchangeHealth {
  name: string;
  status: 'ok' | 'error' | 'empty';
  count: number;
  latencyMs: number;
  error?: string;
}

export interface FetchAllResult<T> {
  data: T[];
  health: ExchangeHealth[];
}

// Run all exchange fetchers in parallel with error isolation and health tracking
export async function fetchAllExchanges<T>(
  configs: ExchangeFetcherConfig<T>[],
  fetchFn: typeof fetchWithTimeout
): Promise<T[]> {
  const { data } = await fetchAllExchangesWithHealth(configs, fetchFn);
  return data;
}

// Run all exchange fetchers with health tracking
export async function fetchAllExchangesWithHealth<T>(
  configs: ExchangeFetcherConfig<T>[],
  fetchFn: typeof fetchWithTimeout
): Promise<FetchAllResult<T>> {
  const health: ExchangeHealth[] = [];

  const promises = configs.map(async ({ name, fetcher }) => {
    const start = Date.now();
    try {
      const result = await fetcher(fetchFn);
      const latencyMs = Date.now() - start;
      health.push({
        name,
        status: result.length > 0 ? 'ok' : 'empty',
        count: result.length,
        latencyMs,
      });
      return result;
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${name} error:`, errMsg);
      health.push({
        name,
        status: 'error',
        count: 0,
        latencyMs,
        error: errMsg,
      });
      return [] as T[];
    }
  });

  const results = await Promise.all(promises);
  return { data: results.flat(), health };
}
