import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('fetchAllTickers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns deduped + sorted tickers on successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          { symbol: 'BTC', exchange: 'Binance', lastPrice: 50000, quoteVolume24h: 1e10, priceChangePercent24h: 2.5 },
          { symbol: 'ETH', exchange: 'Binance', lastPrice: 3000, quoteVolume24h: 5e9, priceChangePercent24h: 1.0 },
        ],
        meta: { totalVolume: 1.5e10 },
      }), { status: 200 }),
    );
    const { fetchAllTickers } = await import('../aggregator');
    const result = await fetchAllTickers();
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Sorted by volume desc — BTC first
    expect(result[0].symbol).toBe('BTC');
  });

  it('filters out tickers with > $100B 24h volume (Gate.io inflated data)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          { symbol: 'BTC', exchange: 'Binance', lastPrice: 50000, quoteVolume24h: 1e10, priceChangePercent24h: 2.5 },
          { symbol: 'BTC', exchange: 'Gate.io', lastPrice: 50000, quoteVolume24h: 5e11, priceChangePercent24h: 2.5 },  // 500B — filtered
        ],
      }), { status: 200 }),
    );
    const { fetchAllTickers } = await import('../aggregator');
    const result = await fetchAllTickers();
    // Should keep Binance, drop Gate.io
    const btc = result.find((t) => t.symbol === 'BTC');
    expect(btc).toBeDefined();
    expect(btc!.quoteVolume24h).toBe(1e10);
  });

  it('prefers tickers with real 24h price change over flat-zero ones', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          { symbol: 'BTC', exchange: 'BITSTAMP', lastPrice: 50000, quoteVolume24h: 1e10, priceChangePercent24h: 0 },
          { symbol: 'BTC', exchange: 'Binance', lastPrice: 50000, quoteVolume24h: 5e9, priceChangePercent24h: 2.5 },
        ],
      }), { status: 200 }),
    );
    const { fetchAllTickers } = await import('../aggregator');
    const result = await fetchAllTickers();
    const btc = result.find((t) => t.symbol === 'BTC');
    // Binance has real change → should win even though BITSTAMP has higher volume
    expect(btc!.priceChangePercent24h).toBe(2.5);
  });

  it('caches non-empty result — second call within TTL does not refetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ symbol: 'BTC', exchange: 'Binance', lastPrice: 50000, quoteVolume24h: 1e10, priceChangePercent24h: 2.5 }],
      }), { status: 200 }),
    );
    const { fetchAllTickers } = await import('../aggregator');
    await fetchAllTickers();
    await fetchAllTickers();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache empty arrays — refetches on next call', async () => {
    // Regression guard: 'empty array got pinned for 30s when /api/tickers
    // came back with no data — every page reading tickers froze'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ symbol: 'BTC', exchange: 'Binance', lastPrice: 50000, quoteVolume24h: 1e10, priceChangePercent24h: 2.5 }],
      }), { status: 200 }));
    const { fetchAllTickers } = await import('../aggregator');
    await fetchAllTickers();
    const second = await fetchAllTickers();
    expect(second.length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('caches the server-computed total volume', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ symbol: 'BTC', exchange: 'Binance', lastPrice: 50000, quoteVolume24h: 1e10, priceChangePercent24h: 2.5 }],
        meta: { totalVolume: 250_000_000_000 },
      }), { status: 200 }),
    );
    const { fetchAllTickers, getServerTotalVolume } = await import('../aggregator');
    await fetchAllTickers();
    expect(getServerTotalVolume()).toBe(250_000_000_000);
  });
});
