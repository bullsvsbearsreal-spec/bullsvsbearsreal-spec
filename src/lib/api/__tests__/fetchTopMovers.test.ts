import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('fetchTopMovers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockTickers(rows: Array<Record<string, unknown>>) {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).includes('/api/tickers')) {
        return Promise.resolve(new Response(JSON.stringify({ data: rows }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    });
  }

  it('returns gainers (top by +%) and losers (bottom by %)', async () => {
    // Build 6 rows from 2 exchanges so exchange count >= 2 for each symbol
    mockTickers([
      { symbol: 'PUMP1', exchange: 'Binance', lastPrice: 10, quoteVolume24h: 2e6, priceChangePercent24h: 50 },
      { symbol: 'PUMP1', exchange: 'Bybit', lastPrice: 10, quoteVolume24h: 1e6, priceChangePercent24h: 50 },
      { symbol: 'PUMP2', exchange: 'Binance', lastPrice: 20, quoteVolume24h: 2e6, priceChangePercent24h: 25 },
      { symbol: 'PUMP2', exchange: 'Bybit', lastPrice: 20, quoteVolume24h: 1e6, priceChangePercent24h: 25 },
      { symbol: 'DUMP1', exchange: 'Binance', lastPrice: 5, quoteVolume24h: 2e6, priceChangePercent24h: -30 },
      { symbol: 'DUMP1', exchange: 'Bybit', lastPrice: 5, quoteVolume24h: 1e6, priceChangePercent24h: -30 },
    ]);
    const { fetchTopMovers } = await import('../aggregator');
    const result = await fetchTopMovers();
    expect(result.gainers.length).toBeGreaterThan(0);
    expect(result.losers.length).toBeGreaterThan(0);
    // PUMP1 (50%) > PUMP2 (25%) — first gainer should be PUMP1
    expect(result.gainers[0].symbol).toBe('PUMP1');
    // DUMP1 should be among losers
    const loserSymbols = result.losers.map((l) => l.symbol);
    expect(loserSymbols).toContain('DUMP1');
  });

  it('filters out symbols below $1M volume (ghost pair guard)', async () => {
    mockTickers([
      { symbol: 'GHOST', exchange: 'Binance', lastPrice: 10, quoteVolume24h: 500, priceChangePercent24h: 999 },
      { symbol: 'GHOST', exchange: 'Bybit', lastPrice: 10, quoteVolume24h: 500, priceChangePercent24h: 999 },
      { symbol: 'REAL', exchange: 'Binance', lastPrice: 10, quoteVolume24h: 2e6, priceChangePercent24h: 5 },
      { symbol: 'REAL', exchange: 'Bybit', lastPrice: 10, quoteVolume24h: 1e6, priceChangePercent24h: 5 },
    ]);
    const { fetchTopMovers } = await import('../aggregator');
    const result = await fetchTopMovers();
    const allSyms = [...result.gainers, ...result.losers].map((t) => t.symbol);
    expect(allSyms).not.toContain('GHOST');
    expect(allSyms).toContain('REAL');
  });

  it('filters out symbols with |%change| > 200% (squeeze/delist noise)', async () => {
    mockTickers([
      { symbol: 'NOISE', exchange: 'Binance', lastPrice: 10, quoteVolume24h: 2e6, priceChangePercent24h: 500 },
      { symbol: 'NOISE', exchange: 'Bybit', lastPrice: 10, quoteVolume24h: 1e6, priceChangePercent24h: 500 },
      { symbol: 'REAL', exchange: 'Binance', lastPrice: 10, quoteVolume24h: 2e6, priceChangePercent24h: 10 },
      { symbol: 'REAL', exchange: 'Bybit', lastPrice: 10, quoteVolume24h: 1e6, priceChangePercent24h: 10 },
    ]);
    const { fetchTopMovers } = await import('../aggregator');
    const result = await fetchTopMovers();
    const allSyms = [...result.gainers, ...result.losers].map((t) => t.symbol);
    expect(allSyms).not.toContain('NOISE');
  });

  it('filters out symbols on fewer than 2 exchanges (single-venue ghost pair)', async () => {
    mockTickers([
      { symbol: 'LONELY', exchange: 'TinyEx', lastPrice: 10, quoteVolume24h: 5e6, priceChangePercent24h: 30 },
      { symbol: 'MULTI', exchange: 'Binance', lastPrice: 10, quoteVolume24h: 2e6, priceChangePercent24h: 5 },
      { symbol: 'MULTI', exchange: 'Bybit', lastPrice: 10, quoteVolume24h: 1e6, priceChangePercent24h: 5 },
    ]);
    const { fetchTopMovers } = await import('../aggregator');
    const result = await fetchTopMovers();
    const allSyms = [...result.gainers, ...result.losers].map((t) => t.symbol);
    expect(allSyms).not.toContain('LONELY');
    expect(allSyms).toContain('MULTI');
  });

  it('filters out sub-cent prices (formatter would round to $0)', async () => {
    mockTickers([
      { symbol: 'DUST', exchange: 'Binance', lastPrice: 0.0001, quoteVolume24h: 2e6, priceChangePercent24h: 30 },
      { symbol: 'DUST', exchange: 'Bybit', lastPrice: 0.0001, quoteVolume24h: 1e6, priceChangePercent24h: 30 },
      { symbol: 'REAL', exchange: 'Binance', lastPrice: 5, quoteVolume24h: 2e6, priceChangePercent24h: 5 },
      { symbol: 'REAL', exchange: 'Bybit', lastPrice: 5, quoteVolume24h: 1e6, priceChangePercent24h: 5 },
    ]);
    const { fetchTopMovers } = await import('../aggregator');
    const result = await fetchTopMovers();
    const allSyms = [...result.gainers, ...result.losers].map((t) => t.symbol);
    expect(allSyms).not.toContain('DUST');
  });

  it('filters out single-letter symbols', async () => {
    mockTickers([
      { symbol: 'X', exchange: 'Binance', lastPrice: 10, quoteVolume24h: 2e6, priceChangePercent24h: 30 },
      { symbol: 'X', exchange: 'Bybit', lastPrice: 10, quoteVolume24h: 1e6, priceChangePercent24h: 30 },
      { symbol: 'BTC', exchange: 'Binance', lastPrice: 50000, quoteVolume24h: 1e9, priceChangePercent24h: 5 },
      { symbol: 'BTC', exchange: 'Bybit', lastPrice: 50000, quoteVolume24h: 5e8, priceChangePercent24h: 5 },
    ]);
    const { fetchTopMovers } = await import('../aggregator');
    const result = await fetchTopMovers();
    const allSyms = [...result.gainers, ...result.losers].map((t) => t.symbol);
    expect(allSyms).not.toContain('X');
    expect(allSyms).toContain('BTC');
  });

  it('returns at most 10 gainers + 10 losers', async () => {
    // Generate 30 valid symbols
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 30; i++) {
      rows.push(
        { symbol: `SYM${i}`, exchange: 'Binance', lastPrice: 10, quoteVolume24h: 2e6, priceChangePercent24h: i - 15 },
        { symbol: `SYM${i}`, exchange: 'Bybit', lastPrice: 10, quoteVolume24h: 1e6, priceChangePercent24h: i - 15 },
      );
    }
    mockTickers(rows);
    const { fetchTopMovers } = await import('../aggregator');
    const result = await fetchTopMovers();
    expect(result.gainers.length).toBeLessThanOrEqual(10);
    expect(result.losers.length).toBeLessThanOrEqual(10);
  });
});
