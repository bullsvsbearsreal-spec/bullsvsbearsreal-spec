/**
 * Tests for exchange constants helpers — getArbRoundTripFee and
 * getExchangeTradeUrl. Both feed the cross-exchange arbitrage scanner
 * + per-row "Trade now" CTA on /screener and /perp-funding.
 *
 * Failure modes:
 *   - getArbRoundTripFee: a regression that doubles or halves the fee
 *     would make unprofitable arbs look profitable (or vice versa).
 *   - getExchangeTradeUrl: a broken URL silently breaks the CTA — user
 *     clicks "Trade BTC on Bybit" and lands on a 404. Page still loads.
 */
import { describe, it, expect } from 'vitest';
import {
  EXCHANGE_FEES,
  getArbRoundTripFee,
  getExchangeTradeUrl,
} from '../exchanges';

describe('getArbRoundTripFee', () => {
  it('sums 2× taker per leg (open + close on each side)', () => {
    // Binance taker = 0.05%, Bybit taker = 0.055%
    // Round-trip = 2*0.05 + 2*0.055 = 0.21
    const fee = getArbRoundTripFee('Binance', 'Bybit');
    expect(fee).toBeCloseTo(0.21, 5);
  });

  it('zero-fee venues contribute zero (Lighter / Bitfinex)', () => {
    // Lighter taker = 0, Bitfinex taker = 0 → round-trip = 0
    expect(getArbRoundTripFee('Lighter', 'Bitfinex')).toBeCloseTo(0, 5);
  });

  it('zero on one side still costs the other side', () => {
    // Lighter (0) ↔ Bybit (0.055) → 2*0 + 2*0.055 = 0.11
    expect(getArbRoundTripFee('Lighter', 'Bybit')).toBeCloseTo(0.11, 5);
  });

  it('falls back to 0.10% per side for unknown venues', () => {
    // Unknown venue defaults to 0.05% per side, doubled = 0.10
    // Both unknown → 0.10 + 0.10 = 0.20
    expect(getArbRoundTripFee('FakeExchangeA', 'FakeExchangeB')).toBeCloseTo(0.20, 5);
  });

  it('order-independent (symmetric)', () => {
    expect(getArbRoundTripFee('Binance', 'Bybit')).toBeCloseTo(
      getArbRoundTripFee('Bybit', 'Binance'),
      5,
    );
  });
});

describe('EXCHANGE_FEES — sanity', () => {
  it('contains all 5 major spot venues', () => {
    for (const ex of ['Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid']) {
      expect(EXCHANGE_FEES[ex]).toBeDefined();
      expect(EXCHANGE_FEES[ex].taker).toBeGreaterThanOrEqual(0);
    }
  });

  it('taker fees are reasonable (between 0 and 0.10%)', () => {
    // Sanity guard against a typo that puts a basis-point fee in
    // percent units (0.05 → 5 would mean 5% taker = catastrophic).
    for (const [, fees] of Object.entries(EXCHANGE_FEES)) {
      expect(fees.taker).toBeGreaterThanOrEqual(0);
      expect(fees.taker).toBeLessThan(0.10);
    }
  });
});

describe('getExchangeTradeUrl — known venues', () => {
  it('builds a Binance URL embedding the symbol + USDT', () => {
    expect(getExchangeTradeUrl('Binance', 'BTC')).toBe('https://www.binance.com/en/futures/BTCUSDT');
  });

  it('uppercases the input symbol', () => {
    expect(getExchangeTradeUrl('Binance', 'btc')).toBe('https://www.binance.com/en/futures/BTCUSDT');
  });

  it('builds a Hyperliquid URL', () => {
    const url = getExchangeTradeUrl('Hyperliquid', 'BTC');
    expect(url).toMatch(/app\.hyperliquid\.xyz\/trade\/BTC/);
  });

  it('builds Bybit/OKX/Bitget/Kraken URLs', () => {
    expect(getExchangeTradeUrl('Bybit', 'ETH')).toMatch(/bybit\.com\/trade.*ETHUSDT/);
    expect(getExchangeTradeUrl('OKX', 'SOL')).toMatch(/okx\.com\/trade-swap\/sol-usdt-swap/);
    expect(getExchangeTradeUrl('Bitget', 'DOGE')).toMatch(/bitget\.com\/futures\/usdt\/DOGEUSDT/);
    expect(getExchangeTradeUrl('Kraken', 'BTC')).toMatch(/kraken\.com\/trade\/futures\/btc-perpetual/);
  });

  it('returns null for unknown exchange', () => {
    expect(getExchangeTradeUrl('NonexistentExchange', 'BTC')).toBe(null);
  });

  it('returns a URL string for every exchange in EXCHANGE_FEES', () => {
    // If we add a venue to fees but forget the trade-URL switch, /screener
    // shows a missing CTA. Lock the invariant: every fee'd exchange has a URL.
    const exemptions = new Set<string>([]); // none currently
    for (const ex of Object.keys(EXCHANGE_FEES)) {
      if (exemptions.has(ex)) continue;
      const url = getExchangeTradeUrl(ex, 'BTC');
      expect(url, `Missing trade URL for "${ex}"`).toBeTruthy();
      // Every URL should be https
      expect(url, `URL for "${ex}" not https`).toMatch(/^https:\/\//);
    }
  });

  it('all returned URLs include the symbol somewhere (case-insensitive)', () => {
    // No exemptions — every venue's URL must embed the requested symbol so
    // clicking "Trade BTC on <venue>" lands on the BTC market, not the
    // venue homepage. GMX previously exempted; now uses ?to=<symbol> to
    // pre-select the index token in V2.
    const exemptions = new Set<string>();
    for (const ex of Object.keys(EXCHANGE_FEES)) {
      if (exemptions.has(ex)) continue;
      const url = getExchangeTradeUrl(ex, 'XYZ');
      if (!url) continue;
      expect(url.toUpperCase(), `URL for "${ex}" missing symbol`).toContain('XYZ');
    }
  });
});
