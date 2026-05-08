/**
 * Tests for the Zod query-param + data-shape schemas at the API boundary.
 *
 * These run on every request to /api/liquidations, /api/tickers, etc. A
 * regression that loosens the regex would let injected query params through
 * to the upstream HTTP call (e.g. "BTC; rm -rf /" or path-traversal "../"
 * — not directly exploitable but can break URL-encoding assumptions).
 *
 * A regression that tightens or shifts a default would silently change
 * which exchange/limit gets used when params are omitted, breaking
 * pagination and per-route defaults invisibly.
 */
import { describe, it, expect } from 'vitest';
import {
  AssetClassSchema,
  FundingQuerySchema,
  TickersQuerySchema,
  LiquidationsQuerySchema,
  TickerDataSchema,
  FundingRateSchema,
  OpenInterestSchema,
  LiquidationSchema,
  safeParseArray,
} from '../schemas';

describe('AssetClassSchema', () => {
  it('accepts the 5 valid asset classes', () => {
    for (const v of ['crypto', 'stocks', 'forex', 'commodities', 'all']) {
      expect(AssetClassSchema.parse(v)).toBe(v);
    }
  });

  it('rejects unknown asset classes', () => {
    expect(AssetClassSchema.safeParse('options').success).toBe(false);
    expect(AssetClassSchema.safeParse('').success).toBe(false);
    expect(AssetClassSchema.safeParse(null).success).toBe(false);
  });
});

describe('FundingQuerySchema', () => {
  it('defaults to crypto when assetClass omitted', () => {
    expect(FundingQuerySchema.parse({})).toEqual({ assetClass: 'crypto' });
  });

  it('accepts a valid assetClass', () => {
    expect(FundingQuerySchema.parse({ assetClass: 'stocks' })).toEqual({ assetClass: 'stocks' });
  });

  it('rejects an invalid assetClass', () => {
    expect(FundingQuerySchema.safeParse({ assetClass: 'futures' }).success).toBe(false);
  });
});

describe('TickersQuerySchema', () => {
  it('parses a comma-separated symbol list, uppercases, trims, dedupes empty', () => {
    const r = TickersQuerySchema.parse({ symbols: 'btc, eth ,sol' });
    expect(r.symbols).toEqual(['BTC', 'ETH', 'SOL']);
  });

  it('drops empty entries from trailing commas', () => {
    const r = TickersQuerySchema.parse({ symbols: 'BTC,,ETH,' });
    expect(r.symbols).toEqual(['BTC', 'ETH']);
  });

  it('omitted → symbols is undefined (route handles default)', () => {
    const r = TickersQuerySchema.parse({});
    expect(r.symbols).toBeUndefined();
  });

  it('rejects symbol strings over 1000 chars (DoS guard)', () => {
    const huge = 'A'.repeat(1001);
    expect(TickersQuerySchema.safeParse({ symbols: huge }).success).toBe(false);
  });
});

describe('LiquidationsQuerySchema — symbol + exchange', () => {
  it('uppercases symbol, lowercases exchange', () => {
    const r = LiquidationsQuerySchema.parse({ symbol: 'btc', exchange: 'BINANCE' });
    expect(r.symbol).toBe('BTC');
    expect(r.exchange).toBe('binance');
  });

  it('default exchange is okx when omitted', () => {
    const r = LiquidationsQuerySchema.parse({ symbol: 'BTC' });
    expect(r.exchange).toBe('okx');
  });

  it('rejects empty symbol', () => {
    expect(LiquidationsQuerySchema.safeParse({ symbol: '' }).success).toBe(false);
  });

  it('rejects non-alphanumeric symbol (injection guard)', () => {
    // The regex is the firewall against shell/path injection — locks down
    // exactly the chars that survive into the upstream HTTP URL.
    expect(LiquidationsQuerySchema.safeParse({ symbol: 'BTC; rm -rf /' }).success).toBe(false);
    expect(LiquidationsQuerySchema.safeParse({ symbol: '../etc' }).success).toBe(false);
    expect(LiquidationsQuerySchema.safeParse({ symbol: 'BTC USDT' }).success).toBe(false); // no spaces
    expect(LiquidationsQuerySchema.safeParse({ symbol: 'BTC-USDT' }).success).toBe(false); // no dash
    expect(LiquidationsQuerySchema.safeParse({ symbol: "BTC'OR 1=1" }).success).toBe(false);
  });

  it('rejects symbol over 20 chars', () => {
    expect(LiquidationsQuerySchema.safeParse({ symbol: 'A'.repeat(21) }).success).toBe(false);
  });

  it('rejects non-alphanumeric exchange', () => {
    expect(LiquidationsQuerySchema.safeParse({ symbol: 'BTC', exchange: 'b/inance' }).success).toBe(false);
  });
});

describe('LiquidationsQuerySchema — limit', () => {
  it('default limit is 100 when omitted', () => {
    const r = LiquidationsQuerySchema.parse({ symbol: 'BTC' });
    expect(r.limit).toBe(100);
  });

  it('parses a numeric string', () => {
    const r = LiquidationsQuerySchema.parse({ symbol: 'BTC', limit: '50' });
    expect(r.limit).toBe(50);
  });

  it('clamps limit to [1, 100]', () => {
    // Negative limits clamp up to 1 (Math.max).
    expect(LiquidationsQuerySchema.parse({ symbol: 'BTC', limit: '-5' }).limit).toBe(1);
    // Excessive limits clamp down to 100 (Math.min).
    expect(LiquidationsQuerySchema.parse({ symbol: 'BTC', limit: '500' }).limit).toBe(100);
    expect(LiquidationsQuerySchema.parse({ symbol: 'BTC', limit: '99999' }).limit).toBe(100);
    // Quirk: limit='0' falls through `parseInt(s) || 100` to the
    // garbage-input default of 100 (NOT clamped to 1). It's the same
    // path as 'abc' or '' since 0 is falsy. Intentional or not, locking
    // it in so a refactor doesn't silently change behaviour.
    expect(LiquidationsQuerySchema.parse({ symbol: 'BTC', limit: '0' }).limit).toBe(100);
  });

  it('falls back to 100 on garbage limit input', () => {
    expect(LiquidationsQuerySchema.parse({ symbol: 'BTC', limit: 'abc' }).limit).toBe(100);
    expect(LiquidationsQuerySchema.parse({ symbol: 'BTC', limit: '' }).limit).toBe(100);
  });
});

describe('LiquidationSchema', () => {
  it('accepts a valid liquidation', () => {
    const r = LiquidationSchema.safeParse({
      side: 'long', size: 1.5, price: 100_000, value: 150_000, timestamp: 1730000000000,
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown side', () => {
    const r = LiquidationSchema.safeParse({
      side: 'closeout', size: 1, price: 1, value: 1, timestamp: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe('FundingRateSchema + TickerDataSchema + OpenInterestSchema', () => {
  it('FundingRate accepts the minimal shape', () => {
    expect(FundingRateSchema.safeParse({ symbol: 'BTC', exchange: 'binance', fundingRate: 0.0001 }).success).toBe(true);
  });

  it('FundingRate type field is "cex" or "dex" only', () => {
    expect(FundingRateSchema.safeParse({ symbol: 'BTC', exchange: 'binance', fundingRate: 0, type: 'cex' }).success).toBe(true);
    expect(FundingRateSchema.safeParse({ symbol: 'BTC', exchange: 'binance', fundingRate: 0, type: 'spot' }).success).toBe(false);
  });

  it('TickerData accepts minimal shape', () => {
    expect(TickerDataSchema.safeParse({ symbol: 'BTC', exchange: 'binance' }).success).toBe(true);
  });

  it('OpenInterest requires symbol + exchange + numeric OI', () => {
    expect(OpenInterestSchema.safeParse({ symbol: 'BTC', exchange: 'binance', openInterest: 12345 }).success).toBe(true);
    expect(OpenInterestSchema.safeParse({ symbol: 'BTC', exchange: 'binance' }).success).toBe(false);
    expect(OpenInterestSchema.safeParse({ symbol: 'BTC', exchange: 'binance', openInterest: 'lots' }).success).toBe(false);
  });
});

describe('safeParseArray', () => {
  it('drops invalid entries and returns the valid ones', () => {
    const items = [
      { symbol: 'BTC', exchange: 'binance', fundingRate: 0.0001 }, // valid
      { symbol: 'ETH', exchange: 'binance' },                       // missing fundingRate
      { symbol: 'SOL', exchange: 'binance', fundingRate: 'big' },   // bad type
      { symbol: 'XRP', exchange: 'binance', fundingRate: -0.0002 }, // valid
    ];
    const r = safeParseArray(items, FundingRateSchema, 'test');
    expect(r.length).toBe(2);
    expect(r[0].symbol).toBe('BTC');
    expect(r[1].symbol).toBe('XRP');
  });

  it('returns empty array on empty input', () => {
    expect(safeParseArray([], FundingRateSchema, 'test')).toEqual([]);
  });
});
