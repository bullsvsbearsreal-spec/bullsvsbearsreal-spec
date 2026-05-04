import { describe, it, expect } from 'vitest';
import {
  detectPriceArbitrage,
  detectFundingArbitrage,
  type TickerEntry,
  type FundingEntry,
} from '../arbitrage-detector';

// ─── Price Arbitrage Detection ──────────────────────────────────

describe('detectPriceArbitrage', () => {
  it('returns empty for empty input', () => {
    expect(detectPriceArbitrage([])).toEqual([]);
  });

  it('returns empty when single exchange per symbol', () => {
    const tickers: TickerEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', lastPrice: 60000, quoteVolume24h: 1_000_000 },
    ];
    expect(detectPriceArbitrage(tickers)).toEqual([]);
  });

  it('detects price spread between exchanges', () => {
    const tickers: TickerEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', lastPrice: 60000, quoteVolume24h: 5_000_000 },
      { symbol: 'BTC', exchange: 'Bybit', lastPrice: 60600, quoteVolume24h: 5_000_000 },
    ];
    const arbs = detectPriceArbitrage(tickers, 0.5);
    expect(arbs.length).toBe(1);
    expect(arbs[0].symbol).toBe('BTC');
    expect(arbs[0].lowExchange).toBe('Binance');
    expect(arbs[0].highExchange).toBe('Bybit');
    expect(arbs[0].spreadPct).toBeCloseTo(1.0, 1);
    expect(arbs[0].spreadUsd).toBe(600);
  });

  it('filters out arbs below threshold', () => {
    const tickers: TickerEntry[] = [
      { symbol: 'ETH', exchange: 'Binance', lastPrice: 3000, quoteVolume24h: 1_000_000 },
      { symbol: 'ETH', exchange: 'OKX', lastPrice: 3003, quoteVolume24h: 1_000_000 },
    ];
    // 0.1% spread, after fees (~0.1%) net is ~0. Threshold 0.5 should filter
    expect(detectPriceArbitrage(tickers, 0.5)).toEqual([]);
  });

  it('filters out low volume exchanges', () => {
    const tickers: TickerEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', lastPrice: 60000, quoteVolume24h: 5_000_000 },
      { symbol: 'BTC', exchange: 'SmallDEX', lastPrice: 61000, quoteVolume24h: 100 },
    ];
    expect(detectPriceArbitrage(tickers, 0.1)).toEqual([]);
  });

  it('filters out denomination mismatches (>3x price deviation)', () => {
    const tickers: TickerEntry[] = [
      { symbol: 'PEPE', exchange: 'Binance', lastPrice: 0.00001, quoteVolume24h: 1_000_000 },
      { symbol: 'PEPE', exchange: 'Bybit', lastPrice: 0.000011, quoteVolume24h: 1_000_000 },
      { symbol: 'PEPE', exchange: 'GMX', lastPrice: 10.0, quoteVolume24h: 1_000_000 }, // 1M denomination
    ];
    const arbs = detectPriceArbitrage(tickers, 0);
    // Should NOT include Drift as it's a denomination mismatch
    arbs.forEach(a => {
      expect(a.lowExchange).not.toBe('GMX');
      expect(a.highExchange).not.toBe('GMX');
    });
  });

  it('caps at MAX_PRICE_SPREAD_PCT (5%)', () => {
    const tickers: TickerEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', lastPrice: 60000, quoteVolume24h: 5_000_000 },
      { symbol: 'BTC', exchange: 'Bybit', lastPrice: 64000, quoteVolume24h: 5_000_000 },
    ];
    // 6.67% spread > 5% cap
    expect(detectPriceArbitrage(tickers, 0)).toEqual([]);
  });

  it('ignores invalid prices (0 or null)', () => {
    const tickers: TickerEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', lastPrice: 0, quoteVolume24h: 5_000_000 },
      { symbol: 'BTC', exchange: 'Bybit', lastPrice: 60000, quoteVolume24h: 5_000_000 },
    ];
    expect(detectPriceArbitrage(tickers)).toEqual([]);
  });

  it('sorts results by netPct descending', () => {
    const tickers: TickerEntry[] = [
      { symbol: 'ETH', exchange: 'Binance', lastPrice: 3000, quoteVolume24h: 5_000_000 },
      { symbol: 'ETH', exchange: 'Bybit', lastPrice: 3060, quoteVolume24h: 5_000_000 },
      { symbol: 'SOL', exchange: 'Binance', lastPrice: 100, quoteVolume24h: 5_000_000 },
      { symbol: 'SOL', exchange: 'Bybit', lastPrice: 104, quoteVolume24h: 5_000_000 },
    ];
    const arbs = detectPriceArbitrage(tickers, 0);
    if (arbs.length >= 2) {
      expect(arbs[0].netPct).toBeGreaterThanOrEqual(arbs[1].netPct);
    }
  });

  it('skips when same exchange is both high and low', () => {
    const tickers: TickerEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', lastPrice: 60000, quoteVolume24h: 5_000_000 },
      { symbol: 'BTC', exchange: 'Binance', lastPrice: 60500, quoteVolume24h: 5_000_000 },
    ];
    // After filtering, low and high would both be Binance entries
    // The detector should skip same-exchange arbs
    expect(detectPriceArbitrage(tickers, 0)).toEqual([]);
  });
});

// ─── Funding Arbitrage Detection ────────────────────────────────

describe('detectFundingArbitrage', () => {
  it('returns empty for empty input', () => {
    expect(detectFundingArbitrage([])).toEqual([]);
  });

  it('returns empty when single exchange per symbol', () => {
    const rates: FundingEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' },
    ];
    expect(detectFundingArbitrage(rates)).toEqual([]);
  });

  it('detects funding rate spread', () => {
    const rates: FundingEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' },
      { symbol: 'BTC', exchange: 'Bybit', fundingRate: 0.08, fundingInterval: '8h' },
    ];
    const arbs = detectFundingArbitrage(rates, 0.01);
    expect(arbs.length).toBe(1);
    expect(arbs[0].symbol).toBe('BTC');
    expect(arbs[0].lowExchange).toBe('Binance');
    expect(arbs[0].highExchange).toBe('Bybit');
    expect(arbs[0].spread8h).toBeCloseTo(0.07, 4);
  });

  it('normalizes 1h rates to 8h (multiply by 8)', () => {
    const rates: FundingEntry[] = [
      { symbol: 'ETH', exchange: 'Hyperliquid', fundingRate: 0.001, fundingInterval: '1h' },
      { symbol: 'ETH', exchange: 'Binance', fundingRate: 0.05, fundingInterval: '8h' },
    ];
    const arbs = detectFundingArbitrage(rates, 0.01);
    expect(arbs.length).toBe(1);
    // 0.001 * 8 = 0.008 vs 0.05, spread = 0.042
    expect(arbs[0].lowRate).toBeCloseTo(0.008, 4);
    expect(arbs[0].highRate).toBeCloseTo(0.05, 4);
  });

  it('normalizes 4h rates to 8h (multiply by 2)', () => {
    const rates: FundingEntry[] = [
      { symbol: 'SOL', exchange: 'ExchangeA', fundingRate: 0.01, fundingInterval: '4h' },
      { symbol: 'SOL', exchange: 'ExchangeB', fundingRate: 0.06, fundingInterval: '8h' },
    ];
    const arbs = detectFundingArbitrage(rates, 0.01);
    expect(arbs.length).toBe(1);
    // 0.01 * 2 = 0.02 vs 0.06, spread = 0.04
    expect(arbs[0].lowRate).toBeCloseTo(0.02, 4);
  });

  it('filters out null funding rates', () => {
    const rates: FundingEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', fundingRate: null, fundingInterval: '8h' },
      { symbol: 'BTC', exchange: 'Bybit', fundingRate: 0.05, fundingInterval: '8h' },
    ];
    expect(detectFundingArbitrage(rates)).toEqual([]);
  });

  it('filters below threshold', () => {
    const rates: FundingEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' },
      { symbol: 'BTC', exchange: 'Bybit', fundingRate: 0.015, fundingInterval: '8h' },
    ];
    // Spread = 0.005, below default threshold of 0.02
    expect(detectFundingArbitrage(rates)).toEqual([]);
  });

  it('sorts results by spread8h descending', () => {
    const rates: FundingEntry[] = [
      { symbol: 'ETH', exchange: 'A', fundingRate: 0.01, fundingInterval: '8h' },
      { symbol: 'ETH', exchange: 'B', fundingRate: 0.05, fundingInterval: '8h' },
      { symbol: 'SOL', exchange: 'A', fundingRate: -0.02, fundingInterval: '8h' },
      { symbol: 'SOL', exchange: 'B', fundingRate: 0.10, fundingInterval: '8h' },
    ];
    const arbs = detectFundingArbitrage(rates, 0.01);
    expect(arbs.length).toBe(2);
    expect(arbs[0].spread8h).toBeGreaterThanOrEqual(arbs[1].spread8h);
    expect(arbs[0].symbol).toBe('SOL'); // 0.12 spread > ETH's 0.04
  });

  it('skips same-exchange entries', () => {
    const rates: FundingEntry[] = [
      { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.01, fundingInterval: '8h' },
      { symbol: 'BTC', exchange: 'Binance', fundingRate: 0.08, fundingInterval: '8h' },
    ];
    expect(detectFundingArbitrage(rates)).toEqual([]);
  });
});
