/**
 * Server-side in-flight request deduplication.
 * When cache expires and multiple requests arrive simultaneously,
 * only the first one triggers the expensive fetch — the rest share the same Promise.
 */
const inflightMap = new Map<string, Promise<any>>();

export function dedupedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflightMap.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher().finally(() => inflightMap.delete(key));
  inflightMap.set(key, promise);
  return promise;
}
