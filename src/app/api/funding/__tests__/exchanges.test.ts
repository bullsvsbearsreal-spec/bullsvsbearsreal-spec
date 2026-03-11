import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fundingFetchers } from '../exchanges';

// Helper: find a fetcher config by exchange name (returns the first match)
function getFetcher(name: string) {
  const config = fundingFetchers.find((f) => f.name === name);
  if (!config) throw new Error(`Fetcher "${name}" not found`);
  return config.fetcher;
}

// Helper: create a mock fetchFn that resolves with JSON data
function mockFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}

// Helper: create a mock fetchFn that returns a non-ok response
function mockFetchFail(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  });
}

// ---------------------------------------------------------------------------
// Binance USDT-M
// ---------------------------------------------------------------------------
describe('Binance USDT-M fetcher', () => {
  const fetcher = getFetcher('Binance'); // first Binance entry is USDT-M

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses funding rate and symbol correctly', async () => {
    const mockData = [
      {
        symbol: 'BTCUSDT',
        lastFundingRate: '0.00012345',
        markPrice: '68500.50',
        indexPrice: '68480.00',
        nextFundingTime: 1710000000000,
      },
      {
        symbol: 'ETHUSDT',
        lastFundingRate: '-0.00005000',
        markPrice: '3500.25',
        indexPrice: '3498.00',
        nextFundingTime: 1710000000000,
      },
    ];

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(2);

    // BTC: 0.00012345 * 100 = 0.012345%
    expect(results[0].symbol).toBe('BTC');
    expect(results[0].exchange).toBe('Binance');
    expect(results[0].fundingRate).toBeCloseTo(0.012345, 6);
    expect(results[0].fundingInterval).toBe('8h');
    expect(results[0].markPrice).toBeCloseTo(68500.5);
    expect(results[0].nextFundingTime).toBe(1710000000000);
    expect(results[0].type).toBe('cex');

    // ETH: negative rate
    expect(results[1].symbol).toBe('ETH');
    expect(results[1].fundingRate).toBeCloseTo(-0.005, 6);
  });

  it('filters out non-USDT pairs', async () => {
    const mockData = [
      {
        symbol: 'BTCBUSD',
        lastFundingRate: '0.0001',
        markPrice: '68500',
        indexPrice: '68500',
        nextFundingTime: 1710000000000,
      },
      {
        symbol: 'ETHUSDT',
        lastFundingRate: '0.0001',
        markPrice: '3500',
        indexPrice: '3500',
        nextFundingTime: 1710000000000,
      },
    ];

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('ETH');
  });

  it('filters out entries with null fundingRate', async () => {
    const mockData = [
      {
        symbol: 'BTCUSDT',
        lastFundingRate: null,
        markPrice: '68500',
        indexPrice: '68500',
        nextFundingTime: 1710000000000,
      },
    ];

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(0);
  });

  it('returns empty array on HTTP error', async () => {
    const fetchFn = mockFetchFail(500);
    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });

  it('returns empty array when response is not an array', async () => {
    const fetchFn = mockFetchOk({ error: 'bad data' });
    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// OKX
// ---------------------------------------------------------------------------
describe('OKX fetcher', () => {
  const fetcher = getFetcher('OKX');

  it('parses funding rate, predicted rate, and symbol correctly', async () => {
    // OKX fetcher makes parallel calls: instruments + mark-price, then per-symbol funding-rate
    const instrumentsResponse = {
      ok: true,
      json: async () => ({
        code: '0',
        data: [
          { instId: 'BTC-USDT-SWAP' },
          { instId: 'ETH-USDT-SWAP' },
        ],
      }),
    };

    const markPriceResponse = {
      ok: true,
      json: async () => ({
        code: '0',
        data: [
          { instId: 'BTC-USDT-SWAP', markPx: '68500.50' },
          { instId: 'ETH-USDT-SWAP', markPx: '3500.25' },
        ],
      }),
    };

    const fundingRateData: Record<string, any> = {
      'BTC-USDT-SWAP': {
        code: '0',
        data: [{
          fundingRate: '0.00015000',
          nextFundingRate: '0.00010000',
          nextFundingTime: '1710000000000',
        }],
      },
      'ETH-USDT-SWAP': {
        code: '0',
        data: [{
          fundingRate: '-0.00008000',
          nextFundingRate: '',
          nextFundingTime: '1710003600000',
        }],
      },
    };

    let callIndex = 0;
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/instruments')) return instrumentsResponse;
      if (url.includes('/mark-price')) return markPriceResponse;
      // Per-symbol funding rate calls
      const instIdMatch = url.match(/instId=([^&]+)/);
      const instId = instIdMatch ? decodeURIComponent(instIdMatch[1]) : '';
      return {
        ok: true,
        json: async () => fundingRateData[instId] || { code: '0', data: [] },
      };
    });

    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(2);

    // BTC: 0.00015 * 100 = 0.015%
    const btc = results.find((r: any) => r.symbol === 'BTC');
    expect(btc).toBeDefined();
    expect(btc!.fundingRate).toBeCloseTo(0.015, 6);
    expect(btc!.predictedRate).toBeCloseTo(0.01, 6); // 0.0001 * 100
    expect(btc!.markPrice).toBeCloseTo(68500.5);
    expect(btc!.exchange).toBe('OKX');
    expect(btc!.fundingInterval).toBe('8h');
    expect(btc!.type).toBe('cex');

    // ETH: -0.00008 * 100 = -0.008%
    const eth = results.find((r: any) => r.symbol === 'ETH');
    expect(eth).toBeDefined();
    expect(eth!.fundingRate).toBeCloseTo(-0.008, 6);
    // Empty nextFundingRate string → predictedRate should be undefined (parseFloat('') is NaN, skipped)
    expect(eth!.predictedRate).toBeUndefined();
  });

  it('returns empty array when instruments request fails', async () => {
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/instruments')) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, json: async () => ({ code: '0', data: [] }) };
    });

    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });

  it('returns empty array when instruments returns error code', async () => {
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/instruments')) {
        return { ok: true, json: async () => ({ code: '50001', data: [] }) };
      }
      return { ok: true, json: async () => ({ code: '0', data: [] }) };
    });

    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// dYdX
// ---------------------------------------------------------------------------
describe('dYdX fetcher', () => {
  const fetcher = getFetcher('dYdX');

  it('parses market data and calculates funding rate correctly', async () => {
    const mockData = {
      markets: {
        'BTC-USD': {
          status: 'ACTIVE',
          nextFundingRate: '0.0000125', // hourly fraction
          oraclePrice: '68500.00',
        },
        'ETH-USD': {
          status: 'ACTIVE',
          nextFundingRate: '-0.0000050',
          oraclePrice: '3500.00',
        },
      },
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results.length).toBeGreaterThanOrEqual(2);

    const btc = results.find((r: any) => r.symbol === 'BTC');
    expect(btc).toBeDefined();
    // 0.0000125 * 100 = 0.00125%
    expect(btc!.fundingRate).toBeCloseTo(0.00125, 6);
    expect(btc!.fundingInterval).toBe('1h');
    expect(btc!.markPrice).toBeCloseTo(68500);
    expect(btc!.exchange).toBe('dYdX');
    expect(btc!.type).toBe('dex');

    const eth = results.find((r: any) => r.symbol === 'ETH');
    expect(eth).toBeDefined();
    expect(eth!.fundingRate).toBeCloseTo(-0.0005, 6);
  });

  it('filters out non-ACTIVE markets', async () => {
    const mockData = {
      markets: {
        'BTC-USD': {
          status: 'ACTIVE',
          nextFundingRate: '0.0000100',
          oraclePrice: '68500.00',
        },
        'LUNA-USD': {
          status: 'OFFLINE',
          nextFundingRate: '0.0050000',
          oraclePrice: '0.50',
        },
      },
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results.every((r: any) => r.symbol !== 'LUNA')).toBe(true);
  });

  it('filters out non-USD pairs', async () => {
    const mockData = {
      markets: {
        'BTC-USD': {
          status: 'ACTIVE',
          nextFundingRate: '0.0000100',
          oraclePrice: '68500.00',
        },
        'BTC-EUR': {
          status: 'ACTIVE',
          nextFundingRate: '0.0000100',
          oraclePrice: '68500.00',
        },
      },
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    // Only BTC-USD passes (ends with -USD)
    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('BTC');
  });

  it('filters out forex pairs (illiquid on dYdX)', async () => {
    const mockData = {
      markets: {
        'BTC-USD': {
          status: 'ACTIVE',
          nextFundingRate: '0.0000100',
          oraclePrice: '68500.00',
        },
        'EUR-USD': {
          status: 'ACTIVE',
          nextFundingRate: '0.0000050',
          oraclePrice: '1.08',
        },
      },
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    // EUR-USD normalizes to EURUSD with assetClass 'forex' → filtered out
    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('BTC');
  });

  it('skips entries with NaN funding rate', async () => {
    const mockData = {
      markets: {
        'BTC-USD': {
          status: 'ACTIVE',
          nextFundingRate: 'not-a-number',
          oraclePrice: '68500.00',
        },
      },
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(0);
  });

  it('returns empty array when markets key is missing', async () => {
    const fetchFn = mockFetchOk({ someOtherKey: {} });
    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });

  it('returns empty array on HTTP error', async () => {
    const fetchFn = mockFetchFail(500);
    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Drift
// ---------------------------------------------------------------------------
describe('Drift fetcher', () => {
  const fetcher = getFetcher('Drift');

  it('parses funding rate from Data API and negates for longs-pay convention', async () => {
    const mockData = {
      markets: [
        {
          marketType: 'perp',
          symbol: 'SOL-PERP',
          oraclePrice: '150.00',
          openInterest: { long: '50000', short: '48000' },
          fundingRate: { long: '0.005' }, // positive = longs receive in Drift
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('SOL');
    expect(results[0].exchange).toBe('Drift');
    // frLong = 0.005, result = -0.005 (negated: positive = longs pay)
    expect(results[0].fundingRate).toBeCloseTo(-0.005, 6);
    expect(results[0].fundingInterval).toBe('1h');
    expect(results[0].type).toBe('dex');
    expect(results[0].markPrice).toBeCloseTo(150);
  });

  it('strips 1M prefix from symbols like 1MBONK', async () => {
    const mockData = {
      markets: [
        {
          marketType: 'perp',
          symbol: '1MBONK-PERP',
          oraclePrice: '0.025',
          openInterest: { long: '100000000', short: '95000000' },
          fundingRate: { long: '0.01' },
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('BONK');
  });

  it('strips -PERP suffix from symbol', async () => {
    const mockData = {
      markets: [
        {
          marketType: 'perp',
          symbol: 'BTC-PERP',
          oraclePrice: '68500',
          openInterest: { long: '100', short: '100' },
          fundingRate: { long: '-0.008' }, // negative = longs pay in Drift
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('BTC');
    // frLong=-0.008, negated → 0.008 (longs pay)
    expect(results[0].fundingRate).toBeCloseTo(0.008, 6);
  });

  it('skips spot markets', async () => {
    const mockData = {
      markets: [
        {
          marketType: 'spot',
          symbol: 'SOL',
          oraclePrice: '150.00',
          openInterest: { long: '50000', short: '48000' },
          fundingRate: { long: '0.005' },
        },
        {
          marketType: 'perp',
          symbol: 'BTC-PERP',
          oraclePrice: '68500',
          openInterest: { long: '100', short: '100' },
          fundingRate: { long: '0.003' },
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('BTC');
  });

  it('skips markets with zero price', async () => {
    const mockData = {
      markets: [
        {
          marketType: 'perp',
          symbol: 'DEAD-PERP',
          oraclePrice: '0',
          openInterest: { long: '1000', short: '1000' },
          fundingRate: { long: '0.005' },
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(0);
  });

  it('skips markets with tiny OI (< $1000)', async () => {
    const mockData = {
      markets: [
        {
          marketType: 'perp',
          symbol: 'TINY-PERP',
          oraclePrice: '1.00',
          openInterest: { long: '100', short: '100' }, // (100+100)*1 = $200 < $1000
          fundingRate: { long: '0.005' },
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(0);
  });

  it('returns empty array on HTTP error', async () => {
    const fetchFn = mockFetchFail(500);
    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GMX V2
// ---------------------------------------------------------------------------
describe('GMX fetcher', () => {
  const fetcher = getFetcher('GMX');

  it('parses BigInt funding rates and converts annual→hourly percentage', async () => {
    // fundingRateLong: -0.05 annual at 1e30 = -5e28
    // hourly % = -(-5e28) / 1e30 / 8760 * 100 = 0.05 / 8760 * 100 ≈ 0.000570776%
    const annualRate = BigInt('-50000000000000000000000000000'); // -5e28 = -0.05 annual
    const borrowRate = BigInt('10000000000000000000000000000');  // 1e28 = 0.01 annual

    const mockData = {
      markets: [
        {
          name: 'BTC/USD [WBTC.b-USDC]',
          isListed: true,
          fundingRateLong: annualRate.toString(),
          fundingRateShort: BigInt('30000000000000000000000000000').toString(), // 3e28 = 0.03 annual
          borrowingRateLong: borrowRate.toString(),
          borrowingRateShort: BigInt('8000000000000000000000000000').toString(), // 8e27
          openInterestLong: BigInt('5000000000000000000000000000000000').toString(),   // 5e33 = $5000
          openInterestShort: BigInt('4000000000000000000000000000000000').toString(),  // 4e33 = $4000
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('BTC');
    expect(results[0].exchange).toBe('GMX');
    expect(results[0].fundingInterval).toBe('1h');
    expect(results[0].type).toBe('dex');

    // fundingRate = -(rawFundingL) where rawFundingL = safeBigInt(annualRate) / 1e30 / 8760 * 100
    // safeBigInt(-5e28) = -5e28, / 1e30 = -0.05, / 8760 ≈ -5.707e-6, * 100 ≈ -5.707e-4
    // fundingL = -(-5.707e-4) = 5.707e-4 ≈ 0.000571%
    const expectedFundingRate = 0.05 / 8760 * 100; // ≈ 0.000571%
    expect(results[0].fundingRate).toBeCloseTo(expectedFundingRate, 6);
  });

  it('deduplicates symbols keeping highest OI pool', async () => {
    const mockData = {
      markets: [
        {
          name: 'BTC/USD [WBTC.b-USDC]',
          isListed: true,
          fundingRateLong: '0',
          fundingRateShort: '0',
          borrowingRateLong: '0',
          borrowingRateShort: '0',
          openInterestLong: BigInt('1000000000000000000000000000000000').toString(),  // 1e33
          openInterestShort: BigInt('1000000000000000000000000000000000').toString(),
        },
        {
          name: 'BTC/USD [WBTC-USDT]',
          isListed: true,
          fundingRateLong: '100000000000000000000000000000', // 1e29
          fundingRateShort: '0',
          borrowingRateLong: '0',
          borrowingRateShort: '0',
          openInterestLong: BigInt('5000000000000000000000000000000000').toString(),  // 5e33 — higher
          openInterestShort: BigInt('5000000000000000000000000000000000').toString(),
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    // Only one BTC entry (the one with higher OI)
    const btcEntries = results.filter((r: any) => r.symbol === 'BTC');
    expect(btcEntries).toHaveLength(1);
    // The higher OI pool has fundingRateLong = 1e29
    // rawFundingL = 1e29 / 1e30 / 8760 * 100 = 0.1 / 8760 * 100 ≈ 0.001142%
    // fundingL = -rawFundingL ≈ -0.001142% (shorts pay)
    expect(btcEntries[0].fundingRate).toBeCloseTo(-(0.1 / 8760 * 100), 6);
  });

  it('strips .v2 suffix from symbol names', async () => {
    const mockData = {
      markets: [
        {
          name: 'XAUT.v2/USD [XAUT-USDC]',
          isListed: true,
          fundingRateLong: '0',
          fundingRateShort: '0',
          borrowingRateLong: '0',
          borrowingRateShort: '0',
          openInterestLong: BigInt('1000000000000000000000000000000000').toString(),
          openInterestShort: BigInt('1000000000000000000000000000000000').toString(),
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('XAUT');
  });

  it('filters out SWAP and deprecated markets', async () => {
    const mockData = {
      markets: [
        {
          name: 'ETH/USD SWAP',
          isListed: true,
          fundingRateLong: '0',
          fundingRateShort: '0',
          openInterestLong: '0',
          openInterestShort: '0',
        },
        {
          name: 'BTC/USD (deprecated)',
          isListed: true,
          fundingRateLong: '0',
          fundingRateShort: '0',
          openInterestLong: '0',
          openInterestShort: '0',
        },
        {
          name: 'SOL/USD [SOL-USDC]',
          isListed: false, // not listed
          fundingRateLong: '0',
          fundingRateShort: '0',
          openInterestLong: '0',
          openInterestShort: '0',
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(0);
  });

  it('handles safeBigInt gracefully for invalid values', async () => {
    const mockData = {
      markets: [
        {
          name: 'BTC/USD [WBTC-USDC]',
          isListed: true,
          fundingRateLong: 'not-a-bigint',
          fundingRateShort: null,
          borrowingRateLong: undefined,
          borrowingRateShort: '0',
          openInterestLong: '0',
          openInterestShort: '0',
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    // safeBigInt returns 0 for invalid values, so fundingRate=0 is valid (not NaN)
    expect(results).toHaveLength(1);
    expect(results[0].fundingRate).toBeCloseTo(0, 10);
  });

  it('returns empty array on HTTP error', async () => {
    const fetchFn = mockFetchFail(500);
    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Bitunix
// ---------------------------------------------------------------------------
describe('Bitunix fetcher', () => {
  const fetcher = getFetcher('Bitunix');

  it('uses rate directly as percentage (no * 100 multiplication)', async () => {
    // Bitunix fundingRate is already a percentage: 0.0023 = 0.0023%
    const mockData = {
      data: [
        {
          symbol: 'BTCUSDT',
          fundingRate: '0.0023',
          fundingInterval: '8',
          markPrice: '68500.00',
          lastPrice: '68480.00',
          nextFundingTime: '1710000000000',
        },
        {
          symbol: 'ETHUSDT',
          fundingRate: '-0.0150',
          fundingInterval: '8',
          markPrice: '3500.00',
          lastPrice: '3498.00',
          nextFundingTime: '1710000000000',
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(2);

    // Rate is used directly — NOT multiplied by 100
    expect(results[0].symbol).toBe('BTC');
    expect(results[0].exchange).toBe('Bitunix');
    expect(results[0].fundingRate).toBeCloseTo(0.0023, 6);
    expect(results[0].fundingInterval).toBe('8h');
    expect(results[0].markPrice).toBeCloseTo(68500);
    expect(results[0].type).toBe('cex');

    expect(results[1].symbol).toBe('ETH');
    expect(results[1].fundingRate).toBeCloseTo(-0.015, 6);
  });

  it('maps fundingInterval number to string correctly', async () => {
    const mockData = {
      data: [
        {
          symbol: 'AAAUSDT',
          fundingRate: '0.001',
          fundingInterval: '1',
          markPrice: '1.00',
          lastPrice: '1.00',
          nextFundingTime: '1710000000000',
        },
        {
          symbol: 'BBBUSDT',
          fundingRate: '0.001',
          fundingInterval: '4',
          markPrice: '1.00',
          lastPrice: '1.00',
          nextFundingTime: '1710000000000',
        },
        {
          symbol: 'CCCUSDT',
          fundingRate: '0.001',
          fundingInterval: '8',
          markPrice: '1.00',
          lastPrice: '1.00',
          nextFundingTime: '1710000000000',
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results[0].fundingInterval).toBe('1h');
    expect(results[1].fundingInterval).toBe('4h');
    expect(results[2].fundingInterval).toBe('8h');
  });

  it('filters out non-USDT pairs', async () => {
    const mockData = {
      data: [
        {
          symbol: 'BTCUSD',
          fundingRate: '0.001',
          fundingInterval: '8',
          markPrice: '68500',
          lastPrice: '68500',
          nextFundingTime: '1710000000000',
        },
      ],
    };

    const fetchFn = mockFetchOk(mockData);
    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(0);
  });

  it('falls back to proxy when direct API returns empty', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes('fapi.bitunix.com')) {
        // Direct API returns empty
        return { ok: true, json: async () => ({ data: [] }) };
      }
      if (url.includes('/api/proxy/bitunix')) {
        // Proxy returns data
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                symbol: 'BTCUSDT',
                fundingRate: '0.005',
                fundingInterval: '8',
                markPrice: '68500',
                lastPrice: '68500',
                nextFundingTime: '1710000000000',
              },
            ],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const results = await fetcher(fetchFn);

    expect(results).toHaveLength(1);
    expect(results[0].symbol).toBe('BTC');
    // Proxy was called
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when both direct and proxy fail', async () => {
    const fetchFn = vi.fn().mockImplementation(async () => {
      return { ok: true, json: async () => ({ data: [] }) };
    });

    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });

  it('returns empty array on HTTP error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));

    // The fetcher has try/catch blocks so it should handle errors gracefully
    const results = await fetcher(fetchFn);
    expect(results).toEqual([]);
  });
});
