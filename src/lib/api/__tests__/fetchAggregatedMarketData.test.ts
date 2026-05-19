import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('fetchAggregatedMarketData', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('combines tickers + funding + OI into one snapshot', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/api/tickers')) {
        return Promise.resolve(new Response(JSON.stringify({
          data: [
            { symbol: 'BTC', exchange: 'Binance', lastPrice: 50000, quoteVolume24h: 1e10, priceChangePercent24h: 2.5 },
            { symbol: 'ETH', exchange: 'Binance', lastPrice: 3000, quoteVolume24h: 5e9, priceChangePercent24h: 1.0 },
          ],
        }), { status: 200 }));
      }
      if (u.includes('/api/funding')) {
        return Promise.resolve(new Response(JSON.stringify({
          data: [
            { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' },
          ],
        }), { status: 200 }));
      }
      if (u.includes('/api/openinterest')) {
        return Promise.resolve(new Response(JSON.stringify({
          data: [
            { symbol: 'BTC', exchange: 'Binance', openInterestValue: 5e9 },
            { symbol: 'ETH', exchange: 'Binance', openInterestValue: 2e9 },
          ],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    const { fetchAggregatedMarketData } = await import('../aggregator');
    const result = await fetchAggregatedMarketData();
    expect(result.tickers).toBeInstanceOf(Map);
    expect(result.tickers.size).toBeGreaterThan(0);
    expect(result.fundingRates.length).toBeGreaterThan(0);
    expect(result.openInterest.length).toBeGreaterThan(0);
  });

  it('sums total volume across all tickers (clamped to MAX_SANE_VOLUME)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/api/tickers')) {
        return Promise.resolve(new Response(JSON.stringify({
          data: [
            { symbol: 'BTC', exchange: 'Binance', lastPrice: 50000, quoteVolume24h: 1e10, priceChangePercent24h: 2.5 },
            { symbol: 'ETH', exchange: 'Binance', lastPrice: 3000, quoteVolume24h: 5e9, priceChangePercent24h: 1.0 },
          ],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    });
    const { fetchAggregatedMarketData } = await import('../aggregator');
    const result = await fetchAggregatedMarketData();
    // Total volume = 1e10 + 5e9 = 1.5e10 (both under the $100B cap)
    expect(result.totalVolume24h).toBe(1.5e10);
  });

  it('sums total OI across all rows', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/api/openinterest')) {
        return Promise.resolve(new Response(JSON.stringify({
          data: [
            { symbol: 'BTC', exchange: 'Binance', openInterestValue: 5e9 },
            { symbol: 'BTC', exchange: 'Bybit', openInterestValue: 3e9 },
            { symbol: 'ETH', exchange: 'Binance', openInterestValue: 2e9 },
          ],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    });
    const { fetchAggregatedMarketData } = await import('../aggregator');
    const result = await fetchAggregatedMarketData();
    expect(result.totalOpenInterest).toBe(1e10);
  });

  it('lastUpdate is a recent ms timestamp', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    );
    const { fetchAggregatedMarketData } = await import('../aggregator');
    const before = Date.now();
    const result = await fetchAggregatedMarketData();
    const after = Date.now();
    expect(result.lastUpdate).toBeGreaterThanOrEqual(before);
    expect(result.lastUpdate).toBeLessThanOrEqual(after);
  });

  it('handles all-empty responses gracefully (zero totals)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    );
    const { fetchAggregatedMarketData } = await import('../aggregator');
    const result = await fetchAggregatedMarketData();
    expect(result.totalVolume24h).toBe(0);
    expect(result.totalOpenInterest).toBe(0);
    expect(result.tickers.size).toBe(0);
  });
});
