import { describe, it, expect } from 'vitest';
import { checkAlert, getMetricValue, type Alert, type MarketData } from '../market-data';

const mockData: MarketData = {
  symbol: 'BTC',
  price: 60000,
  change24h: 5.0,
  fundingRate: 0.01,
  openInterest: 1000000,
  volume24h: 500000,
  liquidations24h: 100000,
  spread: 10,
  spreadPct: 0.017,
  fundingByExchange: { Binance: 0.015, Bybit: 0.005 },
};

const baseAlert: Alert = {
  id: 'test-1',
  symbol: 'BTC',
  metric: 'price',
  operator: 'gt',
  value: 50000,
  enabled: true,
  createdAt: Date.now(),
};

describe('getMetricValue', () => {
  it('returns price', () => {
    expect(getMetricValue(mockData, 'price')).toBe(60000);
  });

  it('returns average funding rate without exchange', () => {
    expect(getMetricValue(mockData, 'fundingRate')).toBe(0.01);
  });

  it('returns per-exchange funding rate', () => {
    const alert = { ...baseAlert, metric: 'fundingRate' as const, exchange: 'Binance' };
    expect(getMetricValue(mockData, 'fundingRate', alert)).toBe(0.015);
  });

  it('falls back to average when exchange not found', () => {
    const alert = { ...baseAlert, metric: 'fundingRate' as const, exchange: 'Unknown' };
    expect(getMetricValue(mockData, 'fundingRate', alert)).toBe(0.01);
  });

  it('returns open interest', () => {
    expect(getMetricValue(mockData, 'openInterest')).toBe(1000000);
  });

  it('returns change24h', () => {
    expect(getMetricValue(mockData, 'change24h')).toBe(5.0);
  });

  it('returns volume24h', () => {
    expect(getMetricValue(mockData, 'volume24h')).toBe(500000);
  });

  it('returns liquidations24h', () => {
    expect(getMetricValue(mockData, 'liquidations24h')).toBe(100000);
  });

  it('returns spread', () => {
    expect(getMetricValue(mockData, 'spread')).toBe(10);
  });

  it('returns spreadPct', () => {
    expect(getMetricValue(mockData, 'spreadPct')).toBe(0.017);
  });

  it('returns price for proximity metrics', () => {
    expect(getMetricValue(mockData, 'liqProximity')).toBe(60000);
    expect(getMetricValue(mockData, 'tpProximity')).toBe(60000);
  });
});

describe('checkAlert', () => {
  it('triggers gt alert when value exceeds threshold', () => {
    expect(checkAlert({ ...baseAlert, operator: 'gt', value: 50000 }, mockData)).toBe(true);
  });

  it('does not trigger gt alert when below threshold', () => {
    expect(checkAlert({ ...baseAlert, operator: 'gt', value: 70000 }, mockData)).toBe(false);
  });

  it('triggers lt alert when value is below threshold', () => {
    expect(checkAlert({ ...baseAlert, operator: 'lt', value: 70000 }, mockData)).toBe(true);
  });

  it('does not trigger lt alert when above threshold', () => {
    expect(checkAlert({ ...baseAlert, operator: 'lt', value: 50000 }, mockData)).toBe(false);
  });

  it('triggers proximity alert when price is within range', () => {
    const alert: Alert = {
      ...baseAlert,
      metric: 'liqProximity',
      operator: 'lt',
      value: 62000, // liq price
      proximityPct: 10,
    };
    // distance = |60000 - 62000| / 62000 * 100 = 3.23% — within 10%
    expect(checkAlert(alert, mockData)).toBe(true);
  });

  it('does not trigger proximity alert when price is far', () => {
    const alert: Alert = {
      ...baseAlert,
      metric: 'liqProximity',
      operator: 'lt',
      value: 100000,
      proximityPct: 5,
    };
    // distance = |60000 - 100000| / 100000 * 100 = 40% — way beyond 5%
    expect(checkAlert(alert, mockData)).toBe(false);
  });

  it('does not trigger proximity alert with missing proximityPct', () => {
    const alert: Alert = {
      ...baseAlert,
      metric: 'liqProximity',
      operator: 'lt',
      value: 62000,
    };
    expect(checkAlert(alert, mockData)).toBe(false);
  });

  it('does not trigger proximity alert with zero price', () => {
    const zeroData = { ...mockData, price: 0 };
    const alert: Alert = {
      ...baseAlert,
      metric: 'tpProximity',
      operator: 'lt',
      value: 62000,
      proximityPct: 10,
    };
    expect(checkAlert(alert, zeroData)).toBe(false);
  });

  it('uses per-exchange funding for exchange-specific alerts', () => {
    const alert: Alert = {
      ...baseAlert,
      metric: 'fundingRate',
      operator: 'gt',
      value: 0.012,
      exchange: 'Binance',
    };
    // Binance rate = 0.015 > 0.012
    expect(checkAlert(alert, mockData)).toBe(true);

    // Same threshold for Bybit (0.005) should not trigger
    expect(checkAlert({ ...alert, exchange: 'Bybit' }, mockData)).toBe(false);
  });
});
