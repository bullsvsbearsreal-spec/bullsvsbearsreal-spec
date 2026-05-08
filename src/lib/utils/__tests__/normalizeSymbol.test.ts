/**
 * Regression tests for normalizeSymbolParam (commit f1745ac5).
 *
 * Bug it prevents: /symbol/BTCUSDT rendered all zeros (Price "—",
 * Volume $0, OI $0, Funding 0%, "0 exchanges") because the page
 * filtered tickers with `t.symbol === "BTCUSDT"` while the upstream
 * /api/tickers normalizes to bare assets ("BTC", "ETH" etc.). The
 * normaliser strips common quote suffixes so /symbol/BTCUSDT and
 * /symbol/BTC both resolve to BTC's data.
 */
import { describe, it, expect } from 'vitest';
import { normalizeSymbolParam } from '../normalizeSymbol';

describe('normalizeSymbolParam', () => {
  it('strips USDT suffix from common pairs', () => {
    expect(normalizeSymbolParam('BTCUSDT')).toBe('BTC');
    expect(normalizeSymbolParam('ETHUSDT')).toBe('ETH');
    expect(normalizeSymbolParam('SOLUSDT')).toBe('SOL');
  });

  it('strips USDC, BUSD, TUSD, USD, EUR', () => {
    expect(normalizeSymbolParam('BTCUSDC')).toBe('BTC');
    expect(normalizeSymbolParam('BTCBUSD')).toBe('BTC');
    expect(normalizeSymbolParam('BTCTUSD')).toBe('BTC');
    expect(normalizeSymbolParam('BTCUSD')).toBe('BTC');
    expect(normalizeSymbolParam('BTCEUR')).toBe('BTC');
  });

  it('handles dash and underscore separators', () => {
    expect(normalizeSymbolParam('BTC-USDT')).toBe('BTC');
    expect(normalizeSymbolParam('BTC_USDT')).toBe('BTC');
    expect(normalizeSymbolParam('btc-usdt')).toBe('BTC');
  });

  it('lowercases input get uppercased', () => {
    expect(normalizeSymbolParam('btcusdt')).toBe('BTC');
    expect(normalizeSymbolParam('ethusd')).toBe('ETH');
  });

  it('does NOT shorten USDT itself to USD', () => {
    // Critical: the longer suffix takes priority.
    expect(normalizeSymbolParam('USDT')).toBe('USDT');
    expect(normalizeSymbolParam('USDC')).toBe('USDC');
  });

  it('passes already-normalized base assets through untouched', () => {
    expect(normalizeSymbolParam('BTC')).toBe('BTC');
    expect(normalizeSymbolParam('ETH')).toBe('ETH');
    expect(normalizeSymbolParam('SOL')).toBe('SOL');
  });

  it('handles cross-pairs by returning the BASE asset', () => {
    // Some venues quote ALT/BTC or ALT/ETH pairs.
    expect(normalizeSymbolParam('ETHBTC')).toBe('ETH');
    expect(normalizeSymbolParam('SOLBTC')).toBe('SOL');
    expect(normalizeSymbolParam('LINKETH')).toBe('LINK');
  });

  it('returns empty string for empty input rather than crashing', () => {
    expect(normalizeSymbolParam('')).toBe('');
  });

  it('handles unknown pair formats by returning the cleaned input', () => {
    // /symbol/BTC-PERP (Hyperliquid-style) — no quote suffix matches,
    // returns the cleaned version.
    expect(normalizeSymbolParam('BTC-PERP')).toBe('BTCPERP');
    expect(normalizeSymbolParam('FOOBAR')).toBe('FOOBAR');
  });

  it('does not strip a quote suffix that would leave an empty string', () => {
    expect(normalizeSymbolParam('BTC')).toBe('BTC'); // would be empty if stripped
    expect(normalizeSymbolParam('ETH')).toBe('ETH');
  });
});
