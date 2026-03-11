import { describe, it, expect, vi, beforeEach } from 'vitest';
import { oiFetchers } from '../exchanges';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Pull a named fetcher from the oiFetchers array */
function getFetcher(name: string) {
  const config = oiFetchers.find((f) => f.name === name);
  if (!config) throw new Error(`No fetcher named "${name}"`);
  return config.fetcher;
}

/** Build a mock fetchFn that returns different responses based on URL substring matching */
function makeFetchFn(routes: Record<string, any>) {
  return vi.fn(async (url: string) => {
    for (const [pattern, body] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        return { ok: true, json: async () => body } as any;
      }
    }
    return { ok: false, status: 404, json: async () => ({}) } as any;
  }) as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.PROXY_URL;
});

// ─── Binance ────────────────────────────────────────────────────────────────

describe('Binance OI fetcher', () => {
  const fetcher = getFetcher('Binance');

  it('calculates OI value as openInterest * lastPrice', async () => {
    const fetchFn = makeFetchFn({
      'ticker/24hr': [
        { symbol: 'BTCUSDT', quoteVolume: '5000000000', lastPrice: '67500.00' },
        { symbol: 'ETHUSDT', quoteVolume: '2000000000', lastPrice: '3500.00' },
      ],
      'openInterest?symbol=BTCUSDT': { openInterest: '42000.5' },
      'openInterest?symbol=ETHUSDT': { openInterest: '500000.0' },
    });

    const data = await fetcher(fetchFn);

    const btc = data.find((d) => d.symbol === 'BTC');
    expect(btc).toBeDefined();
    expect(btc!.exchange).toBe('Binance');
    expect(btc!.openInterest).toBeCloseTo(42000.5);
    expect(btc!.openInterestValue).toBeCloseTo(42000.5 * 67500);

    const eth = data.find((d) => d.symbol === 'ETH');
    expect(eth).toBeDefined();
    expect(eth!.openInterestValue).toBeCloseTo(500000 * 3500);
  });

  it('strips USDT suffix from symbol', async () => {
    const fetchFn = makeFetchFn({
      'ticker/24hr': [
        { symbol: 'SOLUSDT', quoteVolume: '1000000', lastPrice: '150.00' },
      ],
      'openInterest?symbol=SOLUSDT': { openInterest: '1000' },
    });

    const data = await fetcher(fetchFn);
    expect(data[0].symbol).toBe('SOL');
  });

  it('returns empty array on failed ticker fetch', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 451 })) as any;
    const data = await fetcher(fetchFn);
    expect(data).toEqual([]);
  });

  it('skips symbols where OI fetch fails', async () => {
    let callCount = 0;
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('ticker/24hr')) {
        return {
          ok: true,
          json: async () => [
            { symbol: 'BTCUSDT', quoteVolume: '5000000000', lastPrice: '67500' },
            { symbol: 'ETHUSDT', quoteVolume: '2000000000', lastPrice: '3500' },
          ],
        };
      }
      if (url.includes('openInterest?symbol=BTCUSDT')) {
        return { ok: true, json: async () => ({ openInterest: '100' }) };
      }
      // ETH OI fetch fails
      return { ok: false, status: 500 };
    }) as any;

    const data = await fetcher(fetchFn);
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe('BTC');
  });

  it('routes through PROXY_URL when set', async () => {
    process.env.PROXY_URL = 'https://proxy.example.com/';
    const fetchFn = makeFetchFn({
      'proxy.example.com': [
        { symbol: 'BTCUSDT', quoteVolume: '5000000000', lastPrice: '67500' },
      ],
    });

    await fetcher(fetchFn);
    const calledUrl = fetchFn.mock.calls[0][0] as string;
    expect(calledUrl).toContain('proxy.example.com');
    expect(calledUrl).toContain(encodeURIComponent('https://fapi.binance.com'));
  });
});

// ─── dYdX ───────────────────────────────────────────────────────────────────

describe('dYdX OI fetcher', () => {
  const fetcher = getFetcher('dYdX');

  it('parses markets object and calculates OI value', async () => {
    const fetchFn = makeFetchFn({
      'perpetualMarkets': {
        markets: {
          'BTC-USD': { openInterest: '1250.5', oraclePrice: '67000' },
          'ETH-USD': { openInterest: '30000', oraclePrice: '3400' },
        },
      },
    });

    const data = await fetcher(fetchFn);

    const btc = data.find((d) => d.symbol === 'BTC');
    expect(btc).toBeDefined();
    expect(btc!.openInterest).toBeCloseTo(1250.5);
    expect(btc!.openInterestValue).toBeCloseTo(1250.5 * 67000);

    const eth = data.find((d) => d.symbol === 'ETH');
    expect(eth).toBeDefined();
    expect(eth!.openInterestValue).toBeCloseTo(30000 * 3400);
  });

  it('filters out zero-OI entries', async () => {
    const fetchFn = makeFetchFn({
      'perpetualMarkets': {
        markets: {
          'BTC-USD': { openInterest: '1250', oraclePrice: '67000' },
          'DEAD-USD': { openInterest: '0', oraclePrice: '0.001' },
          'GHOST-USD': { openInterest: '0.0', oraclePrice: '0' },
        },
      },
    });

    const data = await fetcher(fetchFn);
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe('BTC');
  });

  it('excludes forex pairs', async () => {
    const fetchFn = makeFetchFn({
      'perpetualMarkets': {
        markets: {
          'BTC-USD': { openInterest: '1000', oraclePrice: '67000' },
          'EUR-USD': { openInterest: '500000', oraclePrice: '1.08' },
          'GBP-USD': { openInterest: '300000', oraclePrice: '1.26' },
          'JPY-USD': { openInterest: '1000000', oraclePrice: '0.0067' },
        },
      },
    });

    const data = await fetcher(fetchFn);
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe('BTC');
  });

  it('strips -USD suffix from symbol', async () => {
    const fetchFn = makeFetchFn({
      'perpetualMarkets': {
        markets: {
          'SOL-USD': { openInterest: '50000', oraclePrice: '150' },
        },
      },
    });

    const data = await fetcher(fetchFn);
    expect(data[0].symbol).toBe('SOL');
  });

  it('returns empty on API error', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500 })) as any;
    const data = await fetcher(fetchFn);
    expect(data).toEqual([]);
  });
});

// ─── Drift ──────────────────────────────────────────────────────────────────

describe('Drift OI fetcher', () => {
  const fetcher = getFetcher('Drift');

  it('sums long + short OI and multiplies by oracle price', async () => {
    const fetchFn = makeFetchFn({
      'stats/markets': {
        markets: [
          {
            marketType: 'perp',
            symbol: 'SOL-PERP',
            oraclePrice: '148.50',
            openInterest: { long: '250000', short: '230000' },
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe('SOL');
    expect(data[0].openInterest).toBeCloseTo(480000);
    expect(data[0].openInterestValue).toBeCloseTo(480000 * 148.5);
  });

  it('strips 1M prefix from symbols (1MBONK -> BONK)', async () => {
    const fetchFn = makeFetchFn({
      'stats/markets': {
        markets: [
          {
            marketType: 'perp',
            symbol: '1MBONK-PERP',
            oraclePrice: '0.000025',
            openInterest: { long: '5000000000', short: '4000000000' },
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data[0].symbol).toBe('BONK');
  });

  it('strips -PERP suffix from symbols', async () => {
    const fetchFn = makeFetchFn({
      'stats/markets': {
        markets: [
          {
            marketType: 'perp',
            symbol: 'BTC-PERP',
            oraclePrice: '67000',
            openInterest: { long: '100', short: '95' },
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data[0].symbol).toBe('BTC');
  });

  it('filters markets with OI value < 1000', async () => {
    const fetchFn = makeFetchFn({
      'stats/markets': {
        markets: [
          {
            marketType: 'perp',
            symbol: 'BTC-PERP',
            oraclePrice: '67000',
            openInterest: { long: '100', short: '95' },
          },
          {
            marketType: 'perp',
            symbol: 'TINY-PERP',
            oraclePrice: '0.001',
            openInterest: { long: '10', short: '5' },
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe('BTC');
  });

  it('skips non-perp markets', async () => {
    const fetchFn = makeFetchFn({
      'stats/markets': {
        markets: [
          {
            marketType: 'spot',
            symbol: 'SOL',
            oraclePrice: '150',
            openInterest: { long: '100000', short: '90000' },
          },
          {
            marketType: 'perp',
            symbol: 'BTC-PERP',
            oraclePrice: '67000',
            openInterest: { long: '50', short: '45' },
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe('BTC');
  });

  it('skips markets with zero or negative oracle price', async () => {
    const fetchFn = makeFetchFn({
      'stats/markets': {
        markets: [
          {
            marketType: 'perp',
            symbol: 'DEAD-PERP',
            oraclePrice: '0',
            openInterest: { long: '1000000', short: '1000000' },
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data).toEqual([]);
  });

  it('uses Math.abs on OI values (handles negative)', async () => {
    const fetchFn = makeFetchFn({
      'stats/markets': {
        markets: [
          {
            marketType: 'perp',
            symbol: 'ETH-PERP',
            oraclePrice: '3500',
            openInterest: { long: '-5000', short: '4000' },
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data[0].openInterest).toBeCloseTo(9000);
    expect(data[0].openInterestValue).toBeCloseTo(9000 * 3500);
  });

  it('returns empty on API failure', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500 })) as any;
    const data = await fetcher(fetchFn);
    expect(data).toEqual([]);
  });
});

// ─── GMX ────────────────────────────────────────────────────────────────────

describe('GMX OI fetcher', () => {
  const fetcher = getFetcher('GMX');

  // Helper to make a BigInt string at 1e30 precision from a USD value
  // Build a 1e30-precision BigInt string from a USD value
  const toGmxBigInt = (usd: number) => {
    const base = BigInt(Math.round(usd));
    let scale = BigInt(1);
    for (let i = 0; i < 30; i++) scale = scale * BigInt(10);
    return (base * scale).toString();
  };

  it('parses BigInt OI at 1e30 precision to USD values', async () => {
    const fetchFn = makeFetchFn({
      'markets/info': {
        markets: [
          {
            name: 'BTC/USD [WBTC.b-USDC]',
            isListed: true,
            openInterestLong: toGmxBigInt(50000000),   // $50M long
            openInterestShort: toGmxBigInt(45000000),   // $45M short
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe('BTC');
    expect(data[0].openInterestValue).toBeCloseTo(95000000, -2); // ~$95M total
    expect(data[0].openInterest).toBeCloseTo(95000000, -2); // Already in USD
  });

  it('parses symbol from "BTC/USD [WBTC.b-USDC]" format', async () => {
    const fetchFn = makeFetchFn({
      'markets/info': {
        markets: [
          {
            name: 'ETH/USD [WETH-USDC]',
            isListed: true,
            openInterestLong: toGmxBigInt(20000000),
            openInterestShort: toGmxBigInt(18000000),
          },
          {
            name: 'DOGE/USD [DOGE-USDC]',
            isListed: true,
            openInterestLong: toGmxBigInt(5000000),
            openInterestShort: toGmxBigInt(4000000),
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    const symbols = data.map((d) => d.symbol);
    expect(symbols).toContain('ETH');
    expect(symbols).toContain('DOGE');
  });

  it('strips .v2 suffix from symbols (XAUT.v2 -> XAUT)', async () => {
    const fetchFn = makeFetchFn({
      'markets/info': {
        markets: [
          {
            name: 'XAUT.v2/USD [XAUT-USDC]',
            isListed: true,
            openInterestLong: toGmxBigInt(2000000),
            openInterestShort: toGmxBigInt(1500000),
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data[0].symbol).toBe('XAUT');
  });

  it('deduplicates by symbol, keeping highest OI pool', async () => {
    const fetchFn = makeFetchFn({
      'markets/info': {
        markets: [
          {
            name: 'BTC/USD [WBTC.b-USDC]',
            isListed: true,
            openInterestLong: toGmxBigInt(50000000),  // 50M + 45M = 95M total
            openInterestShort: toGmxBigInt(45000000),
          },
          {
            name: 'BTC/USD [WBTC-USDT]',
            isListed: true,
            openInterestLong: toGmxBigInt(10000000),  // 10M + 8M = 18M total (lower)
            openInterestShort: toGmxBigInt(8000000),
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    const btcEntries = data.filter((d) => d.symbol === 'BTC');
    expect(btcEntries).toHaveLength(1);
    expect(btcEntries[0].openInterestValue).toBeCloseTo(95000000, -2); // Kept the higher one
  });

  it('excludes SWAP and deprecated markets', async () => {
    const fetchFn = makeFetchFn({
      'markets/info': {
        markets: [
          {
            name: 'BTC/USD [WBTC.b-USDC]',
            isListed: true,
            openInterestLong: toGmxBigInt(50000000),
            openInterestShort: toGmxBigInt(45000000),
          },
          {
            name: 'ETH/USD SWAP',
            isListed: true,
            openInterestLong: toGmxBigInt(1000000),
            openInterestShort: toGmxBigInt(1000000),
          },
          {
            name: 'SOL/USD (deprecated)',
            isListed: true,
            openInterestLong: toGmxBigInt(500000),
            openInterestShort: toGmxBigInt(500000),
          },
          {
            name: 'DOGE/USD [DOGE-USDC]',
            isListed: false, // Not listed
            openInterestLong: toGmxBigInt(3000000),
            openInterestShort: toGmxBigInt(2000000),
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data).toHaveLength(1);
    expect(data[0].symbol).toBe('BTC');
  });

  it('filters out tiny markets (OI <= $1000)', async () => {
    const fetchFn = makeFetchFn({
      'markets/info': {
        markets: [
          {
            name: 'TINY/USD [TINY-USDC]',
            isListed: true,
            openInterestLong: toGmxBigInt(300),
            openInterestShort: toGmxBigInt(200),
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    expect(data).toEqual([]);
  });

  it('handles missing OI fields gracefully (defaults to 0)', async () => {
    const fetchFn = makeFetchFn({
      'markets/info': {
        markets: [
          {
            name: 'LINK/USD [LINK-USDC]',
            isListed: true,
            // openInterestLong and openInterestShort both missing
          },
        ],
      },
    });

    const data = await fetcher(fetchFn);
    // OI is 0, which is < 1000 threshold, so it should be filtered out
    expect(data).toEqual([]);
  });

  it('returns empty on API failure', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500 })) as any;
    const data = await fetcher(fetchFn);
    expect(data).toEqual([]);
  });
});
