import { describe, it, expect } from 'vitest';
import { checkAlert, getMetricValue, type Alert, type MarketData } from '../market-data';

function makeData(overrides: Partial<MarketData> = {}): MarketData {
  return {
    symbol: 'BTC',
    price: 84000,
    change24h: 2.5,
    fundingRate: 0.01,
    openInterest: 5_000_000_000,
    volume24h: 30_000_000_000,
    liquidations24h: 150_000_000,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'test-1',
    symbol: 'BTC',
    metric: 'price',
    operator: 'gt',
    value: 80000,
    enabled: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

// --- getMetricValue() ---

describe('getMetricValue', () => {
  it('returns price', () => {
    expect(getMetricValue(makeData(), 'price')).toBe(84000);
  });

  it('returns average funding rate by default', () => {
    expect(getMetricValue(makeData({ fundingRate: 0.05 }), 'fundingRate')).toBe(0.05);
  });

  it('returns per-exchange funding when exchange specified', () => {
    const data = makeData({
      fundingRate: 0.01,
      fundingByExchange: { Binance: 0.08, Bybit: -0.02 },
    });
    const alert = makeAlert({ metric: 'fundingRate', exchange: 'Binance' });
    expect(getMetricValue(data, 'fundingRate', alert)).toBe(0.08);
  });

  it('falls back to average when exchange not found', () => {
    const data = makeData({
      fundingRate: 0.01,
      fundingByExchange: { Binance: 0.08 },
    });
    const alert = makeAlert({ metric: 'fundingRate', exchange: 'UnknownExchange' });
    expect(getMetricValue(data, 'fundingRate', alert)).toBe(0.01);
  });

  it('returns openInterest', () => {
    expect(getMetricValue(makeData({ openInterest: 3e9 }), 'openInterest')).toBe(3e9);
  });

  it('returns change24h', () => {
    expect(getMetricValue(makeData({ change24h: -5.2 }), 'change24h')).toBe(-5.2);
  });

  it('returns volume24h', () => {
    expect(getMetricValue(makeData({ volume24h: 1e10 }), 'volume24h')).toBe(1e10);
  });

  it('returns liquidations24h', () => {
    expect(getMetricValue(makeData({ liquidations24h: 2e8 }), 'liquidations24h')).toBe(2e8);
  });

  it('returns spread (0 if not set)', () => {
    expect(getMetricValue(makeData(), 'spread')).toBe(0);
    expect(getMetricValue(makeData({ spread: 12.5 }), 'spread')).toBe(12.5);
  });

  it('returns spreadPct (0 if not set)', () => {
    expect(getMetricValue(makeData(), 'spreadPct')).toBe(0);
    expect(getMetricValue(makeData({ spreadPct: 0.03 }), 'spreadPct')).toBe(0.03);
  });

  it('returns current price for proximity metrics', () => {
    expect(getMetricValue(makeData({ price: 84000 }), 'liqProximity')).toBe(84000);
    expect(getMetricValue(makeData({ price: 84000 }), 'tpProximity')).toBe(84000);
  });
});

// --- checkAlert() ---

describe('checkAlert', () => {
  it('fires gt alert when value exceeds threshold', () => {
    const alert = makeAlert({ metric: 'price', operator: 'gt', value: 80000 });
    expect(checkAlert(alert, makeData({ price: 84000 }))).toBe(true);
  });

  it('does not fire gt alert when value is below threshold', () => {
    const alert = makeAlert({ metric: 'price', operator: 'gt', value: 90000 });
    expect(checkAlert(alert, makeData({ price: 84000 }))).toBe(false);
  });

  it('does not fire gt alert at exact threshold', () => {
    const alert = makeAlert({ metric: 'price', operator: 'gt', value: 84000 });
    expect(checkAlert(alert, makeData({ price: 84000 }))).toBe(false);
  });

  it('fires lt alert when value is below threshold', () => {
    const alert = makeAlert({ metric: 'price', operator: 'lt', value: 90000 });
    expect(checkAlert(alert, makeData({ price: 84000 }))).toBe(true);
  });

  it('does not fire lt alert when value exceeds threshold', () => {
    const alert = makeAlert({ metric: 'price', operator: 'lt', value: 80000 });
    expect(checkAlert(alert, makeData({ price: 84000 }))).toBe(false);
  });

  it('fires on high positive funding', () => {
    const alert = makeAlert({ metric: 'fundingRate', operator: 'gt', value: 0.05 });
    expect(checkAlert(alert, makeData({ fundingRate: 0.08 }))).toBe(true);
  });

  it('fires on negative funding below threshold', () => {
    const alert = makeAlert({ metric: 'fundingRate', operator: 'lt', value: 0 });
    expect(checkAlert(alert, makeData({ fundingRate: -0.02 }))).toBe(true);
  });

  it('fires on per-exchange funding rate', () => {
    const alert = makeAlert({
      metric: 'fundingRate', operator: 'gt', value: 0.05,
      exchange: 'Binance',
    });
    const data = makeData({
      fundingRate: 0.01,
      fundingByExchange: { Binance: 0.08 },
    });
    expect(checkAlert(alert, data)).toBe(true);
  });

  it('fires liquidation proximity alert when price is within threshold %', () => {
    const alert = makeAlert({
      metric: 'liqProximity', operator: 'gt',
      value: 80000, proximityPct: 5,
    });
    expect(checkAlert(alert, makeData({ price: 82000 }))).toBe(true);
  });

  it('does not fire proximity alert when price is far from target', () => {
    const alert = makeAlert({
      metric: 'liqProximity', operator: 'gt',
      value: 60000, proximityPct: 5,
    });
    expect(checkAlert(alert, makeData({ price: 84000 }))).toBe(false);
  });

  it('does not fire proximity without proximityPct', () => {
    const alert = makeAlert({ metric: 'liqProximity', operator: 'gt', value: 84000 });
    expect(checkAlert(alert, makeData({ price: 84000 }))).toBe(false);
  });

  it('does not fire proximity with zero price', () => {
    const alert = makeAlert({ metric: 'tpProximity', value: 90000, proximityPct: 5 });
    expect(checkAlert(alert, makeData({ price: 0 }))).toBe(false);
  });

  it('does not fire proximity with zero target', () => {
    const alert = makeAlert({ metric: 'tpProximity', value: 0, proximityPct: 5 });
    expect(checkAlert(alert, makeData({ price: 84000 }))).toBe(false);
  });
});
