import { describe, it, expect } from 'vitest';
import {
  LIQ_THRESHOLD,
  TIMEFRAME_MS,
  TIMELINE_BUCKET_MS,
  DISPLAY,
  EXCHANGE_BRAND_HEX,
} from '../thresholds';

describe('LIQ_THRESHOLD', () => {
  it('all values are positive USD amounts', () => {
    Object.values(LIQ_THRESHOLD).forEach((v) => {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThan(0);
    });
  });

  it('major CEX threshold is higher than midcap', () => {
    expect(LIQ_THRESHOLD.MAJOR_CEX).toBeGreaterThan(LIQ_THRESHOLD.MIDCAP_CEX);
  });

  it('midcap is higher than altcap', () => {
    expect(LIQ_THRESHOLD.MIDCAP_CEX).toBeGreaterThan(LIQ_THRESHOLD.ALT_CEX);
  });

  it('DEX threshold is the lowest (memes have less liquidity)', () => {
    expect(LIQ_THRESHOLD.DEX_MIN).toBeLessThanOrEqual(LIQ_THRESHOLD.ALT_CEX);
  });

  it('HIGHLIGHT_PURPLE (mega liq) is the highest threshold', () => {
    expect(LIQ_THRESHOLD.HIGHLIGHT_PURPLE).toBeGreaterThanOrEqual(LIQ_THRESHOLD.HIGHLIGHT_RED);
    expect(LIQ_THRESHOLD.HIGHLIGHT_RED).toBeGreaterThanOrEqual(LIQ_THRESHOLD.HIGHLIGHT_ORANGE);
  });

  it('SOUND_ALERT is set above the midcap threshold (sound only for big ones)', () => {
    expect(LIQ_THRESHOLD.SOUND_ALERT).toBeGreaterThanOrEqual(LIQ_THRESHOLD.MIDCAP_CEX);
  });
});

describe('TIMEFRAME_MS', () => {
  it('1h, 4h, 12h, 24h all match the math', () => {
    expect(TIMEFRAME_MS['1h']).toBe(3600 * 1000);
    expect(TIMEFRAME_MS['4h']).toBe(4 * 3600 * 1000);
    expect(TIMEFRAME_MS['12h']).toBe(12 * 3600 * 1000);
    expect(TIMEFRAME_MS['24h']).toBe(24 * 3600 * 1000);
  });

  it('each timeframe is monotonically increasing', () => {
    expect(TIMEFRAME_MS['1h']).toBeLessThan(TIMEFRAME_MS['4h']);
    expect(TIMEFRAME_MS['4h']).toBeLessThan(TIMEFRAME_MS['12h']);
    expect(TIMEFRAME_MS['12h']).toBeLessThan(TIMEFRAME_MS['24h']);
  });
});

describe('TIMELINE_BUCKET_MS', () => {
  it('is 5 minutes in ms', () => {
    expect(TIMELINE_BUCKET_MS).toBe(5 * 60 * 1000);
  });

  it('divides evenly into 1 hour (12 buckets/hr)', () => {
    expect((60 * 60 * 1000) / TIMELINE_BUCKET_MS).toBe(12);
  });
});

describe('DISPLAY', () => {
  it('all limits are positive integers', () => {
    Object.values(DISPLAY).forEach((v) => {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThan(0);
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  it('heatmap symbol cap (20) is reasonable for the visible grid', () => {
    expect(DISPLAY.HEATMAP_MAX_SYMBOLS).toBe(20);
  });

  it('liquidations cap (200) is the rolling-feed window', () => {
    expect(DISPLAY.MAX_LIQUIDATIONS).toBeGreaterThanOrEqual(100);
  });
});

describe('EXCHANGE_BRAND_HEX', () => {
  it('every entry is a valid 6-digit hex color', () => {
    Object.values(EXCHANGE_BRAND_HEX).forEach((color) => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('contains the major venues', () => {
    expect(EXCHANGE_BRAND_HEX.Binance).toBeDefined();
    expect(EXCHANGE_BRAND_HEX.Bybit).toBeDefined();
    expect(EXCHANGE_BRAND_HEX.OKX).toBeDefined();
  });

  it('Binance is yellow-ish (Binance brand)', () => {
    // Brand check: just confirm it's not the fallback gray or empty
    expect(EXCHANGE_BRAND_HEX.Binance).toBe('#F0B90B');
  });
});
