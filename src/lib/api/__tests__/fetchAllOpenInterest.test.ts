import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('fetchAllOpenInterest', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed OI rows on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          { symbol: 'BTC', exchange: 'Binance', openInterestValue: 5e9 },
          { symbol: 'ETH', exchange: 'Binance', openInterestValue: 2e9 },
        ],
      }), { status: 200 }),
    );
    const { fetchAllOpenInterest } = await import('../aggregator');
    const result = await fetchAllOpenInterest();
    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('BTC');
  });

  it('hits /api/openinterest (no query params)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [
        { symbol: 'BTC', exchange: 'Binance', openInterestValue: 5e9 },
      ] }), { status: 200 }),
    );
    const { fetchAllOpenInterest } = await import('../aggregator');
    await fetchAllOpenInterest();
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/openinterest');
  });

  it('unwraps { data: [...] } envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ symbol: 'BTC', exchange: 'Binance', openInterestValue: 5e9 }],
        meta: { totalExchanges: 30 },
      }), { status: 200 }),
    );
    const { fetchAllOpenInterest } = await import('../aggregator');
    const result = await fetchAllOpenInterest();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('caches non-empty results — second call within TTL does not refetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({
        data: [{ symbol: 'BTC', exchange: 'Binance', openInterestValue: 5e9 }],
      }), { status: 200 }))
    );
    const { fetchAllOpenInterest } = await import('../aggregator');
    await fetchAllOpenInterest();
    await fetchAllOpenInterest();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache empty arrays', async () => {
    // Regression guard: 'empty array got pinned for cache duration —
    // OI page froze for the full TTL when every venue was down'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ symbol: 'BTC', exchange: 'Binance', openInterestValue: 5e9 }],
      }), { status: 200 }));
    const { fetchAllOpenInterest } = await import('../aggregator');
    await fetchAllOpenInterest();
    const second = await fetchAllOpenInterest();
    expect(second.length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
