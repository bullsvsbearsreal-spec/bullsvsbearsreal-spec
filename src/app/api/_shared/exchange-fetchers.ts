import { fetchWithTimeout } from './fetch';

// A generic type for exchange data fetchers
export type ExchangeFetcher<T> = (
  fetchFn: typeof fetchWithTimeout
) => Promise<T[]>;

export interface ExchangeFetcherConfig<T> {
  name: string;
  fetcher: ExchangeFetcher<T>;
}

// Run all exchange fetchers in parallel with error isolation
export async function fetchAllExchanges<T>(
  configs: ExchangeFetcherConfig<T>[],
  fetchFn: typeof fetchWithTimeout
): Promise<T[]> {
  const promises = configs.map(async ({ name, fetcher }) => {
    try {
      return await fetcher(fetchFn);
    } catch (error) {
      console.error(`${name} error:`, error);
      return [] as T[];
    }
  });
  const results = await Promise.all(promises);
  return results.flat();
}
