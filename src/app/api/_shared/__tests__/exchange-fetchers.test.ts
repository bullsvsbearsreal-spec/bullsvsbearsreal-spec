import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchAllExchanges,
  fetchAllExchangesWithHealth,
  type ExchangeFetcherConfig,
  type ExchangeHealth,
} from '../exchange-fetchers';

// Mock fetchWithTimeout — we only need the type signature, not the real function
const mockFetchFn = vi.fn() as any;

// Helper: create a simple fetcher config
function makeConfig<T>(
  name: string,
  fn: () => Promise<T[]>
): ExchangeFetcherConfig<T> {
  return { name, fetcher: () => fn() };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── fetchAllExchangesWithHealth ────────────────────────────────────────────

describe('fetchAllExchangesWithHealth', () => {
  it('returns combined data from all successful exchanges', async () => {
    const configs: ExchangeFetcherConfig<{ symbol: string; price: number }>[] = [
      makeConfig('Binance', async () => [
        { symbol: 'BTC', price: 60000 },
        { symbol: 'ETH', price: 3000 },
      ]),
      makeConfig('Bybit', async () => [
        { symbol: 'SOL', price: 150 },
      ]),
    ];

    const { data, health } = await fetchAllExchangesWithHealth(configs, mockFetchFn);

    expect(data).toHaveLength(3);
    expect(data).toEqual(expect.arrayContaining([
      { symbol: 'BTC', price: 60000 },
      { symbol: 'ETH', price: 3000 },
      { symbol: 'SOL', price: 150 },
    ]));

    expect(health).toHaveLength(2);
    expect(health[0].status).toBe('ok');
    expect(health[1].status).toBe('ok');
  });

  it('isolates exchange errors — one failure does not affect others', async () => {
    const configs: ExchangeFetcherConfig<{ symbol: string }>[] = [
      makeConfig('Binance', async () => [{ symbol: 'BTC' }]),
      makeConfig('Broken', async () => { throw new Error('Connection refused'); }),
      makeConfig('OKX', async () => [{ symbol: 'ETH' }]),
    ];

    const { data, health } = await fetchAllExchangesWithHealth(configs, mockFetchFn);

    // Successful exchanges still return data
    expect(data).toHaveLength(2);
    expect(data).toEqual(expect.arrayContaining([
      { symbol: 'BTC' },
      { symbol: 'ETH' },
    ]));

    // Health shows the failure
    const broken = health.find(h => h.name === 'Broken');
    expect(broken).toBeDefined();
    expect(broken!.status).toBe('error');
    expect(broken!.error).toBe('Connection refused');
    expect(broken!.count).toBe(0);
  });

  it('retries once on failure before reporting error', async () => {
    let callCount = 0;
    const configs: ExchangeFetcherConfig<{ symbol: string }>[] = [
      makeConfig('Flaky', async () => {
        callCount++;
        if (callCount === 1) throw new Error('Timeout');
        return [{ symbol: 'BTC' }];
      }),
    ];

    const { data, health } = await fetchAllExchangesWithHealth(configs, mockFetchFn);

    expect(callCount).toBe(2); // Initial + 1 retry
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe('BTC');
    expect(health[0].status).toBe('ok');
  });

  it('retries once on empty result before reporting empty', async () => {
    let callCount = 0;
    const configs: ExchangeFetcherConfig<{ symbol: string }>[] = [
      makeConfig('Empty', async () => {
        callCount++;
        return [];
      }),
    ];

    const { data, health } = await fetchAllExchangesWithHealth(configs, mockFetchFn);

    expect(callCount).toBe(2); // Initial + 1 retry
    expect(data).toHaveLength(0);
    expect(health[0].status).toBe('empty');
    expect(health[0].count).toBe(0);
  });

  it('reports "ok" if retry on empty succeeds', async () => {
    let callCount = 0;
    const configs: ExchangeFetcherConfig<{ symbol: string }>[] = [
      makeConfig('Recovering', async () => {
        callCount++;
        if (callCount === 1) return [];
        return [{ symbol: 'BTC' }];
      }),
    ];

    const { data, health } = await fetchAllExchangesWithHealth(configs, mockFetchFn);

    expect(callCount).toBe(2);
    expect(data).toHaveLength(1);
    expect(health[0].status).toBe('ok');
  });

  it('handles empty config list', async () => {
    const { data, health } = await fetchAllExchangesWithHealth([], mockFetchFn);

    expect(data).toHaveLength(0);
    expect(health).toHaveLength(0);
  });

  it('tracks latency in health reports', async () => {
    const configs: ExchangeFetcherConfig<{ symbol: string }>[] = [
      makeConfig('Binance', async () => {
        await new Promise(r => setTimeout(r, 50));
        return [{ symbol: 'BTC' }];
      }),
    ];

    const { health } = await fetchAllExchangesWithHealth(configs, mockFetchFn);

    expect(health[0].latencyMs).toBeGreaterThanOrEqual(40); // Allow some timer variance
    expect(health[0].latencyMs).toBeLessThan(2000);
  });

  it('runs all exchanges in parallel', async () => {
    const startTime = Date.now();
    const configs: ExchangeFetcherConfig<{ symbol: string }>[] = [
      makeConfig('A', async () => {
        await new Promise(r => setTimeout(r, 100));
        return [{ symbol: 'A' }];
      }),
      makeConfig('B', async () => {
        await new Promise(r => setTimeout(r, 100));
        return [{ symbol: 'B' }];
      }),
      makeConfig('C', async () => {
        await new Promise(r => setTimeout(r, 100));
        return [{ symbol: 'C' }];
      }),
    ];

    const { data } = await fetchAllExchangesWithHealth(configs, mockFetchFn);
    const elapsed = Date.now() - startTime;

    expect(data).toHaveLength(3);
    // If sequential, it would take ≥300ms. Parallel should be ~100ms.
    expect(elapsed).toBeLessThan(250);
  });

  it('preserves error message from last attempt', async () => {
    const configs: ExchangeFetcherConfig<{ symbol: string }>[] = [
      makeConfig('Broken', async () => {
        throw new Error('Rate limited');
      }),
    ];

    const { health } = await fetchAllExchangesWithHealth(configs, mockFetchFn);

    expect(health[0].error).toBe('Rate limited');
  });

  it('handles non-Error throws gracefully', async () => {
    const configs: ExchangeFetcherConfig<{ symbol: string }>[] = [
      makeConfig('Weird', async () => {
        throw 'string error'; // eslint-disable-line no-throw-literal
      }),
    ];

    const { health } = await fetchAllExchangesWithHealth(configs, mockFetchFn);

    expect(health[0].status).toBe('error');
    expect(health[0].error).toBe('Unknown error');
  });
});

// ─── fetchAllExchanges ──────────────────────────────────────────────────────

describe('fetchAllExchanges', () => {
  it('returns only the data array (no health)', async () => {
    const configs: ExchangeFetcherConfig<{ symbol: string }>[] = [
      makeConfig('Binance', async () => [{ symbol: 'BTC' }]),
      makeConfig('Bybit', async () => [{ symbol: 'ETH' }]),
    ];

    const data = await fetchAllExchanges(configs, mockFetchFn);

    expect(data).toHaveLength(2);
    expect(Array.isArray(data)).toBe(true);
    // No health property — it's just a flat array
    expect(data).toEqual(expect.arrayContaining([
      { symbol: 'BTC' },
      { symbol: 'ETH' },
    ]));
  });
});
