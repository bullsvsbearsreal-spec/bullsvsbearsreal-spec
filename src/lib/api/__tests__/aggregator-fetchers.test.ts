import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('fetchSpotPrices', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed array on a successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([
        { symbol: 'BTC', exchange: 'Binance', price: 50000, volume24h: 1e9 },
        { symbol: 'ETH', exchange: 'Binance', price: 3000, volume24h: 5e8 },
      ]), { status: 200 }),
    );
    const { fetchSpotPrices } = await import('../aggregator');
    const result = await fetchSpotPrices();
    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('BTC');
  });

  it('unwraps { data: [...] } envelope shape', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ symbol: 'BTC', exchange: 'Binance', price: 50000, volume24h: 1e9 }],
      }), { status: 200 }),
    );
    const { fetchSpotPrices } = await import('../aggregator');
    const result = await fetchSpotPrices();
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('returns [] on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream down', { status: 503 }),
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchSpotPrices } = await import('../aggregator');
    const result = await fetchSpotPrices();
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('returns [] on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchSpotPrices } = await import('../aggregator');
    const result = await fetchSpotPrices();
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('caches successful results — second call within TTL does not refetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([
        { symbol: 'BTC', exchange: 'Binance', price: 50000, volume24h: 1e9 },
      ]), { status: 200 }),
    );
    const { fetchSpotPrices } = await import('../aggregator');
    await fetchSpotPrices();
    await fetchSpotPrices();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache empty arrays — refetches on next call', async () => {
    // Regression guard for the source comment: 'Empty array got pinned for
    // 30s when /api/spot-prices upstream failed.'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { symbol: 'BTC', exchange: 'Binance', price: 50000, volume24h: 1e9 },
      ]), { status: 200 }));
    const { fetchSpotPrices } = await import('../aggregator');
    const first = await fetchSpotPrices();
    const second = await fetchSpotPrices();
    expect(first).toEqual([]);
    expect(second).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('extracts currencyStatus into the side-channel cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ symbol: 'BTC', exchange: 'Binance', price: 50000, volume24h: 1e9 }],
        currencyStatus: { 'Binance:BTC': { canDeposit: true, canWithdraw: false } },
      }), { status: 200 }),
    );
    const { fetchSpotPrices, getCurrencyStatus } = await import('../aggregator');
    await fetchSpotPrices();
    const status = getCurrencyStatus();
    expect(status['Binance:BTC']).toBeDefined();
    expect(status['Binance:BTC'].canDeposit).toBe(true);
  });
});
