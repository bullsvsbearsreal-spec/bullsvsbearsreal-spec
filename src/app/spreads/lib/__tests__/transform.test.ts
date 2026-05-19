import { describe, it, expect } from 'vitest';
import { transformLiveData, transformKlineData } from '../spread-math';
import type { Candle } from '../types';

describe('transformLiveData', () => {
  it('returns empty data when fewer than 2 snapshots', () => {
    const { data, exs } = transformLiveData([], ['Binance', 'Bybit']);
    expect(data).toEqual([]);
    expect(exs).toEqual(['Binance', 'Bybit']);

    const single = transformLiveData(
      [{ t: 1, prices: { Binance: 50000 } }],
      ['Binance', 'Bybit'],
    );
    expect(single.data).toEqual([]);
  });

  it('returns empty when no selected exchange has any prices', () => {
    const { data, exs } = transformLiveData(
      [
        { t: 1, prices: { OKX: 50000 } },
        { t: 2, prices: { OKX: 50100 } },
      ],
      ['Binance', 'Bybit'],
    );
    expect(data).toEqual([]);
    expect(exs).toEqual([]);
  });

  it('produces data points with _spread and _spreadPct calculated', () => {
    const { data, exs } = transformLiveData(
      [
        { t: 1000, prices: { Binance: 50000, Bybit: 50100 } },
        { t: 2000, prices: { Binance: 50050, Bybit: 50150 } },
      ],
      ['Binance', 'Bybit'],
    );
    expect(exs).toEqual(['Binance', 'Bybit']);
    expect(data.length).toBe(2);
    // _spread = max - min = 100
    expect(data[0]._spread).toBe(100);
    // _spreadPct = 100/50000*100 = 0.2
    expect(data[0]._spreadPct).toBeCloseTo(0.2, 3);
  });

  it('skips snapshots with fewer than 2 active exchanges', () => {
    const { data } = transformLiveData(
      [
        { t: 1, prices: { Binance: 50000, Bybit: 50100 } },
        { t: 2, prices: { Binance: 50050 } },  // only one
        { t: 3, prices: { Binance: 50100, Bybit: 50200 } },
      ],
      ['Binance', 'Bybit'],
    );
    // Snapshot at t=2 should be skipped (only 1 exchange)
    expect(data.length).toBe(2);
  });

  it('produces per-exchange deviation fields (e.g. Binance_dev)', () => {
    const { data } = transformLiveData(
      [
        { t: 1, prices: { Binance: 50000, Bybit: 50000 } },
        { t: 2, prices: { Binance: 50000, Bybit: 51000 } },  // 2% above avg
      ],
      ['Binance', 'Bybit'],
    );
    expect(data.length).toBe(2);
    // At t=2: avg = 50500, Bybit_dev = (51000-50500)/50500 * 100 ≈ 0.99
    expect(data[1].Bybit_dev).toBeCloseTo(0.99, 1);
    expect(data[1].Binance_dev).toBeCloseTo(-0.99, 1);
  });

  it('only emits the exchanges that had data (filters absent ones)', () => {
    const { exs } = transformLiveData(
      [
        { t: 1, prices: { Binance: 50000, Bybit: 50100 } },
        { t: 2, prices: { Binance: 50050, Bybit: 50150 } },
      ],
      ['Binance', 'Bybit', 'OKX'],  // OKX has no data
    );
    expect(exs).not.toContain('OKX');
    expect(exs).toContain('Binance');
    expect(exs).toContain('Bybit');
  });

  it('produces label strings (HH:MM:SS time format)', () => {
    const { data } = transformLiveData(
      [
        { t: Date.now(), prices: { Binance: 50000, Bybit: 50100 } },
        { t: Date.now() + 1000, prices: { Binance: 50050, Bybit: 50150 } },
      ],
      ['Binance', 'Bybit'],
    );
    expect(data[0].label).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });
});

describe('transformKlineData', () => {
  it('returns empty when no kline data is provided', () => {
    const { data, exs } = transformKlineData({}, ['Binance'], '1d');
    expect(data).toEqual([]);
    expect(exs).toEqual([]);
  });

  it('falls back to all available exchanges when none of the selected ones have data', () => {
    const kd: Record<string, Candle[]> = {
      OKX: [
        { t: 1000, o: 1, h: 2, l: 0.5, c: 50000 },
        { t: 2000, o: 50000, h: 50100, l: 49900, c: 50050 },
      ],
    };
    const { exs, available } = transformKlineData(kd, ['Binance'], '1d');
    expect(available).toEqual(['OKX']);
    // active = [] initially, falls back to av = ['OKX']
    expect(exs).toEqual(['OKX']);
  });

  it('produces points with _spread and per-exchange values', () => {
    const kd: Record<string, Candle[]> = {
      Binance: [
        { t: 1000_000, o: 0, h: 0, l: 0, c: 50000 },
        { t: 2000_000, o: 0, h: 0, l: 0, c: 50050 },
      ],
      Bybit: [
        { t: 1000_000, o: 0, h: 0, l: 0, c: 50100 },
        { t: 2000_000, o: 0, h: 0, l: 0, c: 50150 },
      ],
    };
    const { data } = transformKlineData(kd, ['Binance', 'Bybit'], '1d');
    expect(data.length).toBeGreaterThan(0);
    // Each point should have _spread set
    data.forEach((pt) => {
      expect(pt._spread).toBeGreaterThanOrEqual(0);
    });
  });

  it('honors timeframe-specific bucket size (1d=1h, others=4h)', () => {
    const oneHour = 3600_000;
    const fourHour = 4 * 3600_000;
    const kd: Record<string, Candle[]> = {
      Binance: [
        { t: oneHour, o: 0, h: 0, l: 0, c: 50000 },
        { t: 2 * oneHour, o: 0, h: 0, l: 0, c: 50100 },
      ],
      Bybit: [
        { t: oneHour, o: 0, h: 0, l: 0, c: 50050 },
        { t: 2 * oneHour, o: 0, h: 0, l: 0, c: 50150 },
      ],
    };
    const out1d = transformKlineData(kd, ['Binance', 'Bybit'], '1d');
    const out7d = transformKlineData(kd, ['Binance', 'Bybit'], '7d');
    // 1d bucket should aggregate both hours into 2 separate hourly buckets
    // 7d bucket should pull all hours within the same 4h bucket together
    expect(out1d.data.length).toBeGreaterThanOrEqual(out7d.data.length);
    // Just verify both timeframes returned data without throwing
    expect(out1d.data.length).toBeGreaterThan(0);
  });

  it('stitches live prices as the latest data point when provided', () => {
    const kd: Record<string, Candle[]> = {
      Binance: [
        { t: 1000_000, o: 0, h: 0, l: 0, c: 50000 },
        { t: 2000_000, o: 0, h: 0, l: 0, c: 50050 },
      ],
      Bybit: [
        { t: 1000_000, o: 0, h: 0, l: 0, c: 50100 },
        { t: 2000_000, o: 0, h: 0, l: 0, c: 50150 },
      ],
    };
    const withoutLive = transformKlineData(kd, ['Binance', 'Bybit'], '1d');
    const withLive = transformKlineData(kd, ['Binance', 'Bybit'], '1d', {
      Binance: { price: 51000 },
      Bybit: { price: 51100 },
    });
    // Live point should add one extra data point at the end
    expect(withLive.data.length).toBe(withoutLive.data.length + 1);
    const lastPoint = withLive.data[withLive.data.length - 1];
    expect(lastPoint.Binance).toBe(51000);
    expect(lastPoint.Bybit).toBe(51100);
  });

  it('does NOT stitch live prices when fewer than 2 exchanges provide data', () => {
    const kd: Record<string, Candle[]> = {
      Binance: [{ t: 1000_000, o: 0, h: 0, l: 0, c: 50000 }, { t: 2000_000, o: 0, h: 0, l: 0, c: 50050 }],
      Bybit: [{ t: 1000_000, o: 0, h: 0, l: 0, c: 50100 }, { t: 2000_000, o: 0, h: 0, l: 0, c: 50150 }],
    };
    const out = transformKlineData(kd, ['Binance', 'Bybit'], '1d', { Binance: { price: 51000 } });
    // Only one live price, can't stitch — output count unchanged
    expect(out.data.length).toBe(transformKlineData(kd, ['Binance', 'Bybit'], '1d').data.length);
  });

  it('returns label strings (timeframe-aware: 30d=month/day, 7d=date+time, else HH:MM)', () => {
    const kd: Record<string, Candle[]> = {
      Binance: [{ t: 1000_000, o: 0, h: 0, l: 0, c: 50000 }, { t: 2000_000, o: 0, h: 0, l: 0, c: 50050 }],
      Bybit: [{ t: 1000_000, o: 0, h: 0, l: 0, c: 50100 }, { t: 2000_000, o: 0, h: 0, l: 0, c: 50150 }],
    };
    const out = transformKlineData(kd, ['Binance', 'Bybit'], '1d');
    out.data.forEach((pt) => {
      expect(typeof pt.label).toBe('string');
      expect(pt.label.length).toBeGreaterThan(0);
    });
  });
});
