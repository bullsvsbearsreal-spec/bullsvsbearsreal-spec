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
// Includes one automatic retry on failure/empty to handle intermittent API blocks
export async function fetchAllExchangesWithHealth<T>(
  configs: ExchangeFetcherConfig<T>[],
  fetchFn: typeof fetchWithTimeout
): Promise<FetchAllResult<T>> {
  const health: ExchangeHealth[] = [];

  const promises = configs.map(async ({ name, fetcher }) => {
    const start = Date.now();
    let lastError = '';

    // Try up to 2 attempts (initial + 1 retry)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 500)); // Brief delay before retry
        const result = await fetcher(fetchFn);
        if (result.length > 0) {
          health.push({
            name,
            status: 'ok',
            count: result.length,
            latencyMs: Date.now() - start,
          });
          return result;
        }
        // Empty result — retry once in case of transient issue
        if (attempt === 0) continue;
        health.push({ name, status: 'empty', count: 0, latencyMs: Date.now() - start });
        return [] as T[];
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        if (attempt === 0) continue; // Retry on first failure
        console.error(`${name} error (after retry):`, lastError);
        health.push({
          name,
          status: 'error',
          count: 0,
          latencyMs: Date.now() - start,
          error: lastError,
        });
        return [] as T[];
      }
    }
    return [] as T[];
  });

  const results = await Promise.all(promises);
  return { data: results.flat(), health };
}
