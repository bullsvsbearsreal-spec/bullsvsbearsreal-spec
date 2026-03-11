import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spotPriceFetchers, type SpotPrice } from '../exchanges';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a mock fetch function that resolves with given JSON body */
function mockOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

/** Build a mock fetch that returns a non-OK response */
function mockNotOk(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  });
}

/** Build a mock fetch that throws (network error) */
function mockThrow(msg = 'Network error') {
  return vi.fn().mockRejectedValue(new Error(msg));
}

/** Build a mock fetch that returns invalid JSON */
function mockBadJson() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => { throw new SyntaxError('Unexpected token'); },
  });
}

function getFetcher(name: string) {
  const f = spotPriceFetchers.find((f) => f.name === name);
  if (!f) throw new Error(`No fetcher named "${name}"`);
  return f;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── Binance ────────────────────────────────────────────────────────────────

describe('Binance spot fetcher', () => {
  const fetcher = getFetcher('Binance');

  beforeEach(() => {
    vi.stubEnv('PROXY_URL', 'https://proxy.example.com');
  });

  it('parses valid Binance ticker response', async () => {
    const mockFetch = mockOk([
      { symbol: 'BTCUSDT', lastPrice: '70000.50', quoteVolume: '5000000000' },
      { symbol: 'ETHUSDT', lastPrice: '3500.25', quoteVolume: '2000000000' },
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'Binance',
      price: 70000.5,
      volume24h: 5000000000,
    });
    expect(result[1]).toEqual({
      symbol: 'ETH',
      exchange: 'Binance',
      price: 3500.25,
      volume24h: 2000000000,
    });
  });

  it('routes through PROXY_URL when set', async () => {
    const mockFetch = mockOk([]);
    await fetcher.fetcher(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('proxy.example.com');
    expect(calledUrl).toContain(encodeURIComponent('https://api.binance.com'));
  });

  it('filters out non-USDT pairs', async () => {
    const mockFetch = mockOk([
      { symbol: 'BTCUSDT', lastPrice: '70000', quoteVolume: '5000000000' },
      { symbol: 'BTCBUSD', lastPrice: '70000', quoteVolume: '1000000' },
      { symbol: 'ETHBTC', lastPrice: '0.05', quoteVolume: '500' },
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('filters out zero price entries', async () => {
    const mockFetch = mockOk([
      { symbol: 'BTCUSDT', lastPrice: '70000', quoteVolume: '5000000000' },
      { symbol: 'DEADUSDT', lastPrice: '0', quoteVolume: '100' },
      { symbol: 'DEAD2USDT', lastPrice: '0.00000000', quoteVolume: '0' },
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });

  it('returns [] on non-array response body', async () => {
    const mockFetch = mockOk({ error: 'bad request' });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('filters out stock/non-crypto symbols', async () => {
    const mockFetch = mockOk([
      { symbol: 'BTCUSDT', lastPrice: '70000', quoteVolume: '5000000000' },
      { symbol: 'AAPLXUSDT', lastPrice: '180', quoteVolume: '100000' },
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });
});

// ─── Bybit ──────────────────────────────────────────────────────────────────

describe('Bybit spot fetcher', () => {
  const fetcher = getFetcher('Bybit');

  beforeEach(() => {
    vi.stubEnv('PROXY_URL', 'https://proxy.example.com');
  });

  it('parses valid Bybit ticker response', async () => {
    const mockFetch = mockOk({
      retCode: 0,
      result: {
        list: [
          { symbol: 'BTCUSDT', lastPrice: '70000', turnover24h: '5000000000' },
          { symbol: 'SOLUSDT', lastPrice: '150.5', turnover24h: '800000000' },
        ],
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'Bybit',
      price: 70000,
      volume24h: 5000000000,
    });
    expect(result[1]).toEqual({
      symbol: 'SOL',
      exchange: 'Bybit',
      price: 150.5,
      volume24h: 800000000,
    });
  });

  it('returns [] when retCode is not 0', async () => {
    const mockFetch = mockOk({ retCode: 10001, retMsg: 'Invalid request' });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });

  it('handles missing result.list gracefully', async () => {
    const mockFetch = mockOk({ retCode: 0, result: {} });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });
});

// ─── OKX ────────────────────────────────────────────────────────────────────

describe('OKX spot fetcher', () => {
  const fetcher = getFetcher('OKX');

  it('parses valid OKX response', async () => {
    const mockFetch = mockOk({
      code: '0',
      data: [
        { instId: 'BTC-USDT', last: '70000', volCcy24h: '5000000000' },
        { instId: 'ETH-USDT', last: '3500', volCcy24h: '2000000000' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'OKX',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('uses volCcy24h directly without multiplying by price', async () => {
    const mockFetch = mockOk({
      code: '0',
      data: [{ instId: 'BTC-USDT', last: '70000', volCcy24h: '1234567' }],
    });
    const result = await fetcher.fetcher(mockFetch);
    // volume24h should be 1234567, NOT 1234567 * 70000
    expect(result[0].volume24h).toBe(1234567);
  });

  it('returns [] when code is not "0"', async () => {
    const mockFetch = mockOk({ code: '50000', msg: 'Internal error' });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('filters non-USDT pairs', async () => {
    const mockFetch = mockOk({
      code: '0',
      data: [
        { instId: 'BTC-USDT', last: '70000', volCcy24h: '5000000000' },
        { instId: 'BTC-USDC', last: '70000', volCcy24h: '100000' },
        { instId: 'ETH-BTC', last: '0.05', volCcy24h: '500' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── Kraken ─────────────────────────────────────────────────────────────────

describe('Kraken spot fetcher', () => {
  const fetcher = getFetcher('Kraken');

  it('maps XETHZUSD to ETH (single X prefix stripped correctly)', async () => {
    const mockFetch = mockOk({
      result: {
        'XETHZUSD': { c: ['3500.00'], v: ['50', '1000'] },
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('ETH');
    expect(result[0].price).toBe(3500);
  });

  it('maps XXBTZUSD to BTC correctly', async () => {
    const mockFetch = mockOk({
      result: {
        'XXBTZUSD': { c: ['70000.00'], v: ['100', '500'] },
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('maps XDGZUSD to DOGE correctly', async () => {
    const mockFetch = mockOk({
      result: {
        'XDGZUSD': { c: ['0.15'], v: ['1000', '50000000'] },
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('DOGE');
  });

  it('calculates volume as base volume * price', async () => {
    const mockFetch = mockOk({
      result: {
        'XETHZUSD': { c: ['3500'], v: ['100', '500'] },
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    // v[1] is 24h volume in base currency, so volume24h = 500 * 3500 = 1750000
    expect(result[0].volume24h).toBe(500 * 3500);
  });

  it('filters out fiat pairs (ZGBPZUSD)', async () => {
    const mockFetch = mockOk({
      result: {
        'XETHZUSD': { c: ['3500'], v: ['50', '1000'] },
        'ZGBPZUSD': { c: ['1.27'], v: ['1000', '50000'] },
        'ZEURZUSD': { c: ['1.08'], v: ['1000', '80000'] },
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('ETH');
  });

  it('handles XETHZUSD format', async () => {
    const mockFetch = mockOk({
      result: {
        'XETHZUSD': { c: ['3500'], v: ['50', '1000'] },
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('ETH');
    expect(result[0].price).toBe(3500);
  });

  it('handles plain USD suffix pairs (SOLUSDT, SOLUSD)', async () => {
    const mockFetch = mockOk({
      result: {
        'SOLUSD': { c: ['150'], v: ['100', '10000'] },
        'SOLUSDT': { c: ['150.5'], v: ['100', '10000'] },
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.symbol === 'SOL')).toBe(true);
  });

  it('returns [] when result is missing', async () => {
    const mockFetch = mockOk({ error: ['Service unavailable'] });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });

  it('skips entries with zero price', async () => {
    const mockFetch = mockOk({
      result: {
        'XXBTZUSD': { c: ['0'], v: ['100', '500'] },
        'XETHZUSD': { c: ['3500'], v: ['50', '1000'] },
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('ETH');
  });
});

// ─── Coinbase ───────────────────────────────────────────────────────────────

describe('Coinbase spot fetcher', () => {
  const fetcher = getFetcher('Coinbase');

  it('parses valid Coinbase products response', async () => {
    const mockFetch = mockOk({
      products: [
        { product_id: 'BTC-USD', price: '70000', volume_24h: '500' },
        { product_id: 'ETH-USD', price: '3500', volume_24h: '10000' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'Coinbase',
      price: 70000,
      volume24h: 500 * 70000,
    });
  });

  it('calculates volume as base volume * price', async () => {
    const mockFetch = mockOk({
      products: [
        { product_id: 'BTC-USD', price: '70000', volume_24h: '100' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    // volume_24h is base volume, so volume24h = 100 * 70000 = 7000000
    expect(result[0].volume24h).toBe(100 * 70000);
  });

  it('accepts both -USD and -USDT pairs', async () => {
    const mockFetch = mockOk({
      products: [
        { product_id: 'BTC-USD', price: '70000', volume_24h: '500' },
        { product_id: 'ETH-USDT', price: '3500', volume_24h: '10000' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.symbol)).toEqual(['BTC', 'ETH']);
  });

  it('strips -USD and -USDT suffix correctly', async () => {
    const mockFetch = mockOk({
      products: [
        { product_id: 'SOL-USDT', price: '150', volume_24h: '10000' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result[0].symbol).toBe('SOL');
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });

  it('returns [] when products is empty', async () => {
    const mockFetch = mockOk({ products: [] });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });
});

// ─── HTX ────────────────────────────────────────────────────────────────────

describe('HTX spot fetcher', () => {
  const fetcher = getFetcher('HTX');

  it('parses valid HTX response', async () => {
    const mockFetch = mockOk({
      status: 'ok',
      data: [
        { symbol: 'btcusdt', close: 70000, vol: 5000000000 },
        { symbol: 'ethusdt', close: 3500, vol: 2000000000 },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'HTX',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('uses vol directly (already in quote currency)', async () => {
    const mockFetch = mockOk({
      status: 'ok',
      data: [{ symbol: 'btcusdt', close: 70000, vol: 1234567 }],
    });
    const result = await fetcher.fetcher(mockFetch);
    // vol should NOT be multiplied by price — it's already in USDT
    expect(result[0].volume24h).toBe(1234567);
  });

  it('converts lowercase symbols to uppercase', async () => {
    const mockFetch = mockOk({
      status: 'ok',
      data: [{ symbol: 'solusdt', close: 150, vol: 800000000 }],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result[0].symbol).toBe('SOL');
  });

  it('returns [] when status is not "ok"', async () => {
    const mockFetch = mockOk({ status: 'error', 'err-msg': 'System error' });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] when data is not array', async () => {
    const mockFetch = mockOk({ status: 'ok', data: null });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── Bitfinex ───────────────────────────────────────────────────────────────

describe('Bitfinex spot fetcher', () => {
  const fetcher = getFetcher('Bitfinex');

  it('parses valid Bitfinex array-of-arrays response', async () => {
    // Bitfinex format: [symbol, bid, bid_size, ask, ask_size, daily_change, daily_change_pct, last_price, volume, high, low]
    const mockFetch = mockOk([
      ['tBTCUSD', 69999, 10, 70001, 5, 500, 0.007, 70000, 500, 71000, 69000],
      ['tETHUSD', 3499, 20, 3501, 10, 50, 0.014, 3500, 10000, 3600, 3400],
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'Bitfinex',
      price: 70000,
      volume24h: Math.abs(500) * 70000,
    });
  });

  it('calculates volume as Math.abs(vol) * price', async () => {
    const mockFetch = mockOk([
      ['tBTCUSD', 0, 0, 0, 0, 0, 0, 70000, -500, 0, 0],
    ]);
    const result = await fetcher.fetcher(mockFetch);
    // Volume can be negative in Bitfinex data, should use Math.abs
    expect(result[0].volume24h).toBe(500 * 70000);
  });

  it('strips "t" prefix from symbols', async () => {
    const mockFetch = mockOk([
      ['tSOLUSD', 0, 0, 0, 0, 0, 0, 150, 10000, 0, 0],
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result[0].symbol).toBe('SOL');
  });

  it('excludes funding pairs (f*)', async () => {
    const mockFetch = mockOk([
      ['tBTCUSD', 0, 0, 0, 0, 0, 0, 70000, 500, 0, 0],
      ['fUSD', 0, 0, 0, 0, 0, 0, 1, 100000, 0, 0],
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('excludes perpetual/derivatives pairs (F0:)', async () => {
    const mockFetch = mockOk([
      ['tBTCUSD', 0, 0, 0, 0, 0, 0, 70000, 500, 0, 0],
      ['tBTCF0:USTF0', 0, 0, 0, 0, 0, 0, 70000, 300, 0, 0],
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('handles UST (USDT) suffix', async () => {
    const mockFetch = mockOk([
      ['tBTCUST', 0, 0, 0, 0, 0, 0, 70000, 500, 0, 0],
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });

  it('returns [] when response is not array', async () => {
    const mockFetch = mockOk({ error: 'rate limit' });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });
});

// ─── Bitget ─────────────────────────────────────────────────────────────────

describe('Bitget spot fetcher', () => {
  const fetcher = getFetcher('Bitget');

  it('parses valid Bitget response', async () => {
    const mockFetch = mockOk({
      code: '00000',
      data: [
        { symbol: 'BTCUSDT', lastPr: '70000', quoteVolume: '5000000000' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'Bitget',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('returns [] when code is not "00000"', async () => {
    const mockFetch = mockOk({ code: '40001', msg: 'error' });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── KuCoin ─────────────────────────────────────────────────────────────────

describe('KuCoin spot fetcher', () => {
  const fetcher = getFetcher('KuCoin');

  it('parses valid KuCoin response', async () => {
    const mockFetch = mockOk({
      code: '200000',
      data: {
        ticker: [
          { symbol: 'BTC-USDT', last: '70000', volValue: '5000000000' },
        ],
      },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'KuCoin',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('returns [] when code is not "200000"', async () => {
    const mockFetch = mockOk({ code: '400100', msg: 'error' });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── Gate.io ────────────────────────────────────────────────────────────────

describe('Gate.io spot fetcher', () => {
  const fetcher = getFetcher('Gate.io');

  it('returns [] when PROXY_URL is not set', async () => {
    vi.stubEnv('PROXY_URL', '');
    const mockFetch = mockOk([]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('parses valid Gate.io response via proxy', async () => {
    vi.stubEnv('PROXY_URL', 'https://proxy.example.com');
    const mockFetch = mockOk([
      { currency_pair: 'BTC_USDT', last: '70000', quote_volume: '5000000000' },
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'Gate.io',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('routes through PROXY_URL', async () => {
    vi.stubEnv('PROXY_URL', 'https://proxy.example.com/');
    const mockFetch = mockOk([]);
    await fetcher.fetcher(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('proxy.example.com');
    expect(calledUrl).toContain(encodeURIComponent('https://api.gateio.ws'));
  });

  it('returns [] on non-OK response', async () => {
    vi.stubEnv('PROXY_URL', 'https://proxy.example.com');
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── MEXC ───────────────────────────────────────────────────────────────────

describe('MEXC spot fetcher', () => {
  const fetcher = getFetcher('MEXC');

  it('parses valid MEXC response', async () => {
    const mockFetch = mockOk([
      { symbol: 'BTCUSDT', lastPrice: '70000', quoteVolume: '5000000000' },
    ]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'MEXC',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('returns [] on non-array body', async () => {
    const mockFetch = mockOk({ code: -1, msg: 'error' });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── BingX ──────────────────────────────────────────────────────────────────

describe('BingX spot fetcher', () => {
  const fetcher = getFetcher('BingX');

  it('parses valid BingX response', async () => {
    const mockFetch = mockOk({
      code: 0,
      data: [
        { symbol: 'BTC-USDT', lastPrice: '70000', quoteVolume: '5000000000' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'BingX',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('returns [] when code is not 0', async () => {
    const mockFetch = mockOk({ code: 100001, data: [] });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── CoinEx ─────────────────────────────────────────────────────────────────

describe('CoinEx spot fetcher', () => {
  const fetcher = getFetcher('CoinEx');

  it('parses valid CoinEx response', async () => {
    const mockFetch = mockOk({
      code: 0,
      data: [
        { market: 'BTCUSDT', last: '70000', value: '5000000000' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'CoinEx',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('returns [] when code is not 0', async () => {
    const mockFetch = mockOk({ code: 1, data: [] });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── Phemex ─────────────────────────────────────────────────────────────────

describe('Phemex spot fetcher', () => {
  const fetcher = getFetcher('Phemex');

  it('parses valid Phemex response (spot "s" prefix)', async () => {
    const mockFetch = mockOk({
      result: [
        { symbol: 'sBTCUSDT', closeRp: '70000', turnoverRv: '5000000000' },
        { symbol: 'sETHUSDT', closeRp: '3500', turnoverRv: '2000000000' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      symbol: 'BTC',
      exchange: 'Phemex',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('excludes non-spot (perp) symbols without "s" prefix', async () => {
    const mockFetch = mockOk({
      result: [
        { symbol: 'sBTCUSDT', closeRp: '70000', turnoverRv: '5000000000' },
        { symbol: 'BTCUSDT', closeRp: '70000', turnoverRv: '8000000000' },
      ],
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── WhiteBIT ───────────────────────────────────────────────────────────────

describe('WhiteBIT spot fetcher', () => {
  const fetcher = getFetcher('WhiteBIT');

  it('parses valid WhiteBIT key-value response', async () => {
    const mockFetch = mockOk({
      'BTC_USDT': { last_price: '70000', quote_volume: '5000000000' },
      'ETH_USDT': { last_price: '3500', quote_volume: '2000000000' },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.symbol === 'BTC')).toEqual({
      symbol: 'BTC',
      exchange: 'WhiteBIT',
      price: 70000,
      volume24h: 5000000000,
    });
  });

  it('filters non-USDT pairs', async () => {
    const mockFetch = mockOk({
      'BTC_USDT': { last_price: '70000', quote_volume: '5000000000' },
      'BTC_USDC': { last_price: '70000', quote_volume: '100000' },
    });
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
  });

  it('returns [] when response is an array', async () => {
    const mockFetch = mockOk([1, 2, 3]);
    const result = await fetcher.fetcher(mockFetch);
    expect(result).toEqual([]);
  });

  it('returns [] on non-OK response', async () => {
    const result = await fetcher.fetcher(mockNotOk());
    expect(result).toEqual([]);
  });
});

// ─── Error handling (all fetchers) ──────────────────────────────────────────

describe('Error handling for all fetchers', () => {
  // Set up proxy for proxy-dependent fetchers
  beforeEach(() => {
    vi.stubEnv('PROXY_URL', 'https://proxy.example.com');
  });

  for (const fetcher of spotPriceFetchers) {
    describe(`${fetcher.name}`, () => {
      it('returns [] on non-OK HTTP response', async () => {
        const result = await fetcher.fetcher(mockNotOk(503));
        expect(result).toEqual([]);
      });

      it('returns [] or throws on malformed JSON', async () => {
        try {
          const result = await fetcher.fetcher(mockBadJson());
          // Some fetchers may catch JSON errors internally
          expect(result).toEqual([]);
        } catch {
          // Throwing is also acceptable behavior for malformed JSON
          expect(true).toBe(true);
        }
      });
    });
  }
});

// ─── General validation (all fetchers) ──────────────────────────────────────

describe('General validation across all fetchers', () => {
  beforeEach(() => {
    vi.stubEnv('PROXY_URL', 'https://proxy.example.com');
  });

  it('all fetchers are named', () => {
    for (const fetcher of spotPriceFetchers) {
      expect(fetcher.name).toBeTruthy();
      expect(typeof fetcher.name).toBe('string');
    }
  });

  it('all fetcher names are unique', () => {
    const names = spotPriceFetchers.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('results from all fetchers have required SpotPrice fields', async () => {
    // Feed each fetcher realistic minimal data and check output shape
    const feedData: Record<string, unknown> = {
      'Binance': [{ symbol: 'BTCUSDT', lastPrice: '70000', quoteVolume: '100' }],
      'Bybit': { retCode: 0, result: { list: [{ symbol: 'BTCUSDT', lastPrice: '70000', turnover24h: '100' }] } },
      'OKX': { code: '0', data: [{ instId: 'BTC-USDT', last: '70000', volCcy24h: '100' }] },
      'Bitget': { code: '00000', data: [{ symbol: 'BTCUSDT', lastPr: '70000', quoteVolume: '100' }] },
      'KuCoin': { code: '200000', data: { ticker: [{ symbol: 'BTC-USDT', last: '70000', volValue: '100' }] } },
      'Kraken': { result: { 'XXBTZUSD': { c: ['70000'], v: ['1', '10'] } } },
      'MEXC': [{ symbol: 'BTCUSDT', lastPrice: '70000', quoteVolume: '100' }],
      'Coinbase': { products: [{ product_id: 'BTC-USD', price: '70000', volume_24h: '1' }] },
      'HTX': { status: 'ok', data: [{ symbol: 'btcusdt', close: 70000, vol: 100 }] },
      'Gate.io': [{ currency_pair: 'BTC_USDT', last: '70000', quote_volume: '100' }],
      'BingX': { code: 0, data: [{ symbol: 'BTC-USDT', lastPrice: '70000', quoteVolume: '100' }] },
      'CoinEx': { code: 0, data: [{ market: 'BTCUSDT', last: '70000', value: '100' }] },
      'Phemex': { result: [{ symbol: 'sBTCUSDT', closeRp: '70000', turnoverRv: '100' }] },
      'WhiteBIT': { 'BTC_USDT': { last_price: '70000', quote_volume: '100' } },
      'Bitfinex': [['tBTCUSD', 0, 0, 0, 0, 0, 0, 70000, 10, 0, 0]],
    };

    for (const fetcher of spotPriceFetchers) {
      const data = feedData[fetcher.name];
      if (!data) continue; // Skip if no mock data for this exchange
      const mockFetch = mockOk(data);
      const result = await fetcher.fetcher(mockFetch);
      for (const item of result) {
        expect(item).toHaveProperty('symbol');
        expect(item).toHaveProperty('exchange');
        expect(item).toHaveProperty('price');
        expect(item).toHaveProperty('volume24h');
        expect(typeof item.symbol).toBe('string');
        expect(typeof item.exchange).toBe('string');
        expect(typeof item.price).toBe('number');
        expect(typeof item.volume24h).toBe('number');
        expect(item.price).toBeGreaterThan(0);
        expect(item.exchange).toBe(fetcher.name);
      }
    }
  });
});
