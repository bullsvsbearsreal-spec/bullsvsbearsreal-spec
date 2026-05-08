/**
 * Tests for the cross-exchange aggregator helpers — used by /screener,
 * /perp-funding, and the home dashboard's "Total OI" / "Avg funding" tiles.
 *
 * Failure modes:
 *   - aggregateOpenInterestBySymbol mis-summing across venues = wrong
 *     "BTC OI: $XXB" headline.
 *   - calculateAverageFundingRates dividing by wrong count = funding-rate
 *     screener silently shows mean instead of consensus.
 *   - calculateTotalVolume picking the wrong field (volume24h vs
 *     quoteVolume24h) = market-volume tile silently 1000× off.
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateOpenInterestBySymbol,
  aggregateOpenInterestByExchange,
  calculateAverageFundingRates,
  calculateTotalVolume,
} from '../aggregator';
import type {
  OpenInterestData,
  FundingRateData,
  TickerData,
} from '../types';

const oi = (sym: string, ex: string, value: number): OpenInterestData => ({
  symbol: sym,
  exchange: ex,
  openInterest: value / 100_000, // approx coins (irrelevant for these tests)
  openInterestValue: value,
  timestamp: 0,
});

const fr = (sym: string, ex: string, rate: number): FundingRateData => ({
  symbol: sym,
  exchange: ex,
  fundingRate: rate,
  fundingTime: 0,
  nextFundingTime: 0,
});

const tk = (sym: string, qVol: number): TickerData => ({
  symbol: sym,
  lastPrice: 100,
  priceChangePercent24h: 0,
  high24h: 100,
  low24h: 100,
  volume24h: qVol / 100,   // base-volume (NOT what we sum)
  quoteVolume24h: qVol,    // quote-volume — THIS is what aggregator sums
  timestamp: 0,
});

describe('aggregateOpenInterestBySymbol', () => {
  it('sums OI across exchanges per symbol', () => {
    const data = [
      oi('BTC', 'binance', 1_000_000_000),
      oi('BTC', 'bybit', 500_000_000),
      oi('BTC', 'okx', 250_000_000),
      oi('ETH', 'binance', 400_000_000),
    ];
    const out = aggregateOpenInterestBySymbol(data);
    expect(out.get('BTC')).toBe(1_750_000_000);
    expect(out.get('ETH')).toBe(400_000_000);
  });

  it('handles missing openInterestValue as 0', () => {
    const data: OpenInterestData[] = [
      { symbol: 'BTC', exchange: 'b', openInterest: 0, openInterestValue: undefined as any, timestamp: 0 },
      oi('BTC', 'c', 100_000_000),
    ];
    expect(aggregateOpenInterestBySymbol(data).get('BTC')).toBe(100_000_000);
  });

  it('returns empty map on empty input', () => {
    expect(aggregateOpenInterestBySymbol([]).size).toBe(0);
  });
});

describe('aggregateOpenInterestByExchange', () => {
  it('sums OI per exchange across all symbols', () => {
    const data = [
      oi('BTC', 'binance', 1_000_000_000),
      oi('ETH', 'binance', 400_000_000),
      oi('BTC', 'bybit', 500_000_000),
      oi('SOL', 'bybit', 100_000_000),
    ];
    const out = aggregateOpenInterestByExchange(data);
    expect(out.get('binance')).toBe(1_400_000_000);
    expect(out.get('bybit')).toBe(600_000_000);
  });
});

describe('calculateAverageFundingRates', () => {
  it('averages funding rates per symbol across listed exchanges', () => {
    const data = [
      fr('BTC', 'binance', 0.01),
      fr('BTC', 'bybit', 0.02),
      fr('BTC', 'okx', 0.03),
      fr('ETH', 'binance', -0.005),
    ];
    const out = calculateAverageFundingRates(data);
    expect(out.get('BTC')!.avgRate).toBeCloseTo(0.02, 5);
    expect(out.get('BTC')!.exchanges).toEqual(['binance', 'bybit', 'okx']);
    expect(out.get('ETH')!.avgRate).toBeCloseTo(-0.005, 5);
    expect(out.get('ETH')!.exchanges).toEqual(['binance']);
  });

  it('handles negative rates correctly (no abs)', () => {
    // Negative funding = shorts pay longs. Critical to preserve sign in
    // the average so the screener's "Negative Funding" preset works.
    const data = [
      fr('BTC', 'a', -0.01),
      fr('BTC', 'b', -0.03),
    ];
    expect(calculateAverageFundingRates(data).get('BTC')!.avgRate).toBeCloseTo(-0.02, 5);
  });

  it('returns empty map on empty input', () => {
    expect(calculateAverageFundingRates([]).size).toBe(0);
  });

  it('preserves exchange order as encountered', () => {
    const data = [
      fr('BTC', 'okx', 0.01),
      fr('BTC', 'binance', 0.01),
      fr('BTC', 'bybit', 0.01),
    ];
    expect(calculateAverageFundingRates(data).get('BTC')!.exchanges)
      .toEqual(['okx', 'binance', 'bybit']);
  });
});

describe('calculateTotalVolume', () => {
  it('sums quoteVolume24h (NOT volume24h)', () => {
    // Critical: must use the USD-quoted field. Past bug: aggregator
    // accidentally summed base-currency volume24h (e.g. BTC units),
    // showing market volume 1000× too low.
    const data = [
      tk('BTC', 50_000_000_000),
      tk('ETH', 30_000_000_000),
      tk('SOL', 5_000_000_000),
    ];
    expect(calculateTotalVolume(data)).toBe(85_000_000_000);
  });

  it('zero-volume tickers contribute 0', () => {
    const data = [tk('BTC', 0), tk('NEW', 0)];
    expect(calculateTotalVolume(data)).toBe(0);
  });

  it('missing quoteVolume24h treated as 0', () => {
    const data: TickerData[] = [
      { symbol: 'X', lastPrice: 1, priceChangePercent24h: 0, high24h: 1, low24h: 1, volume24h: 999, quoteVolume24h: undefined as any, timestamp: 0 },
      tk('Y', 100),
    ];
    expect(calculateTotalVolume(data)).toBe(100);
  });
});
