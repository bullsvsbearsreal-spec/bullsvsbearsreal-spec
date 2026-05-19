import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('fetchAllFundingRates', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed funding rates on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' },
          { symbol: 'ETH', exchange: 'Binance', fundingRate: 0.005, fundingInterval: '8h' },
        ],
      }), { status: 200 }),
    );
    const { fetchAllFundingRates } = await import('../aggregator');
    const result = await fetchAllFundingRates();
    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('BTC');
  });

  it('defaults to crypto asset class (hits /api/funding directly)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [
        { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' },
      ] }), { status: 200 }),
    );
    const { fetchAllFundingRates } = await import('../aggregator');
    await fetchAllFundingRates();
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toBe('/api/funding');
    expect(url).not.toContain('?assetClass=');
  });

  it('appends ?assetClass= for non-crypto', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const { fetchAllFundingRates } = await import('../aggregator');
    await fetchAllFundingRates('stocks');
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('assetClass=stocks');
  });

  it('URL-encodes asset class values', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ symbol: 'AAPL', exchange: 'Aster', fundingRate: 0.001 }] }), { status: 200 }),
    );
    const { fetchAllFundingRates } = await import('../aggregator');
    await fetchAllFundingRates('forex');
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('assetClass=forex');
  });

  it('caches per-asset-class (different cache keys per filter)', async () => {
    // Use mockImplementation so each fetch call gets a fresh Response
    // — Response bodies are one-shot, so mockResolvedValue with a
    // single Response object fails on the second consumer.
    const makeResp = () => new Response(JSON.stringify({
      data: [{ symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' }],
    }), { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(makeResp()));
    const { fetchAllFundingRates } = await import('../aggregator');
    await fetchAllFundingRates('crypto');
    await fetchAllFundingRates('crypto');
    // Same asset class → cached → 1 call
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await fetchAllFundingRates('stocks');
    // Different asset class → fresh fetch → 2 calls total
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does NOT cache empty arrays', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' }],
      }), { status: 200 }));
    const { fetchAllFundingRates } = await import('../aggregator');
    await fetchAllFundingRates('crypto');
    const second = await fetchAllFundingRates('crypto');
    expect(second.length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
