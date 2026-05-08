/**
 * Tests for normalizeSymbolBase — the cross-exchange symbol matcher used
 * by aggregator code to merge "BTCUSDT" / "BTC-USDT" / "1000SHIBUSDT" /
 * "SOL-USD-SWAP" into the same base asset bucket. A regression here
 * would split the same coin across multiple rows in funding/OI/ticker
 * aggregations, doubling-counting volumes and breaking the screener.
 *
 * Distinct from normalizeSymbolParam (lib/utils/normalizeSymbol.ts) which
 * is for user-input URL params — that one is more conservative and
 * doesn't strip numeric prefixes.
 */
import { describe, it, expect } from 'vitest';
import { normalizeSymbolBase } from '../normalize';

describe('normalizeSymbolBase — quote-suffix stripping', () => {
  it('strips USDT', () => {
    expect(normalizeSymbolBase('BTCUSDT')).toBe('BTC');
    expect(normalizeSymbolBase('ETHUSDT')).toBe('ETH');
  });

  it('strips USDC, USD, BUSD', () => {
    expect(normalizeSymbolBase('BTCUSDC')).toBe('BTC');
    expect(normalizeSymbolBase('BTCUSD')).toBe('BTC');
    expect(normalizeSymbolBase('BTCBUSD')).toBe('BTC');
  });

  it('strips PERP and SWAP suffixes', () => {
    expect(normalizeSymbolBase('BTCPERP')).toBe('BTC');
    expect(normalizeSymbolBase('BTCSWAP')).toBe('BTC');
  });

  it('handles dash and underscore separators', () => {
    expect(normalizeSymbolBase('BTC-USDT')).toBe('BTC');
    expect(normalizeSymbolBase('BTC_USDT')).toBe('BTC');
    expect(normalizeSymbolBase('SOL-USD-SWAP')).toBe('SOL');
  });
});

describe('normalizeSymbolBase — multiplier-prefix stripping', () => {
  it('strips 1000 prefix from cheap coins', () => {
    // Binance/Bybit list cheap memecoins as 1000PEPE, 1000SHIB etc.
    expect(normalizeSymbolBase('1000SHIBUSDT')).toBe('SHIB');
    expect(normalizeSymbolBase('1000PEPEUSDT')).toBe('PEPE');
    expect(normalizeSymbolBase('1000BONKUSDT')).toBe('BONK');
  });

  it('strips 10000 prefix', () => {
    expect(normalizeSymbolBase('10000SATSUSDT')).toBe('SATS');
  });

  it('strips 1000000 prefix', () => {
    expect(normalizeSymbolBase('1000000PEIPEIUSDT')).toBe('PEIPEI');
  });

  it('strips 1M alias prefix', () => {
    expect(normalizeSymbolBase('1MBABYDOGEUSDT')).toBe('BABYDOGE');
  });
});

describe('normalizeSymbolBase — preserves valid base assets', () => {
  it('passes BTC / ETH / SOL through unchanged', () => {
    expect(normalizeSymbolBase('BTC')).toBe('BTC');
    expect(normalizeSymbolBase('ETH')).toBe('ETH');
    expect(normalizeSymbolBase('SOL')).toBe('SOL');
  });

  it('uppercases lowercase input', () => {
    expect(normalizeSymbolBase('btc')).toBe('BTC');
    expect(normalizeSymbolBase('btcusdt')).toBe('BTC');
  });
});

describe('normalizeSymbolBase — degenerate inputs', () => {
  it('returns the original uppercased when stripping would empty the string', () => {
    // "USDT" alone → after stripping "" → fall back to "USDT"
    expect(normalizeSymbolBase('USDT')).toBe('USDT');
    // "1000USDT" → strip suffix to "1000" → strip prefix to "" → fall back
    // to ORIGINAL ("1000USDT"). This is the consistent "if normalization
    // semantically erases the symbol, leave it alone" rule.
    expect(normalizeSymbolBase('1000USDT')).toBe('1000USDT');
  });

  it('handles weird mixed-suffix combos', () => {
    expect(normalizeSymbolBase('1000SHIBUSDC')).toBe('SHIB');
    expect(normalizeSymbolBase('1MFLOKIUSDT')).toBe('FLOKI');
  });
});
