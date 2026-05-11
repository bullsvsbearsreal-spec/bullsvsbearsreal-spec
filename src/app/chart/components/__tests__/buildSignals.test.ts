/**
 * Unit tests for buildSignals — the heuristic that powers the
 * <ChartSignalsStrip> colored-chip row sitting between the chart
 * and the per-venue funding strip.
 *
 * Locks in: thresholds for each of the 8 signal categories, the
 * 2 confluence rules (quiet OI build + long flush risk), null
 * handling, and the order in which signals are emitted.
 *
 * Tests inspect key/label/tone/detail — NOT the icon JSX (which
 * is purely presentational and would require a render harness).
 */

import { describe, it, expect } from 'vitest';
import { buildSignals } from '../signalsBuilder';

describe('buildSignals', () => {
  /* ─── Empty / fallback ──────────────────────────────────────── */

  it('returns empty array when no fields populated', () => {
    expect(buildSignals({ symbol: 'BTC' })).toEqual([]);
  });

  it('returns empty array when every signal is sub-threshold', () => {
    // 0.005% funding is below the 0.01 mild threshold, so it falls
    // into the "funding-flat" neutral bucket → 1 signal emitted.
    // To get zero, we have to leave fundingRatePct undefined.
    expect(buildSignals({
      symbol: 'BTC',
      openInterestChange24hPct: 2,   // below 5
      change24hPct: 2,               // below 5
      longRatio: 0.5, shortRatio: 0.5, // balanced
      rsi: 50,
      atrPct: 1.5,
    })).toEqual([]);
  });

  /* ─── Funding regime thresholds ─────────────────────────────── */

  describe('funding regime', () => {
    it('flags funding-extreme (caution) at exactly +0.05%', () => {
      const sigs = buildSignals({ symbol: 'BTC', fundingRatePct: 0.05 });
      expect(sigs).toHaveLength(1);
      expect(sigs[0].key).toBe('funding-extreme');
      expect(sigs[0].tone).toBe('caution');
      expect(sigs[0].label).toBe('Funding overheated');
    });

    it('flags funding-extreme (bullish) at exactly -0.05%', () => {
      const sigs = buildSignals({ symbol: 'BTC', fundingRatePct: -0.05 });
      expect(sigs[0].key).toBe('funding-extreme');
      expect(sigs[0].tone).toBe('bullish');
      expect(sigs[0].label).toBe('Funding deeply negative');
    });

    it('flags funding-mild (bearish) at +0.01% to <0.05%', () => {
      const sigs = buildSignals({ symbol: 'BTC', fundingRatePct: 0.02 });
      expect(sigs[0].key).toBe('funding-mild');
      expect(sigs[0].tone).toBe('bearish');
      expect(sigs[0].label).toBe('Longs paying');
    });

    it('flags funding-mild (bullish) at -0.01% to >-0.05%', () => {
      const sigs = buildSignals({ symbol: 'BTC', fundingRatePct: -0.02 });
      expect(sigs[0].key).toBe('funding-mild');
      expect(sigs[0].tone).toBe('bullish');
      expect(sigs[0].label).toBe('Shorts paying');
    });

    it('flags funding-flat (neutral) at abs < 0.01%', () => {
      const sigs = buildSignals({ symbol: 'BTC', fundingRatePct: 0.001 });
      expect(sigs[0].key).toBe('funding-flat');
      expect(sigs[0].tone).toBe('neutral');
    });

    it('flags funding-flat at exactly 0', () => {
      const sigs = buildSignals({ symbol: 'BTC', fundingRatePct: 0 });
      expect(sigs[0].key).toBe('funding-flat');
    });

    it('boundary: exactly 0.01% promotes to funding-mild', () => {
      const sigs = buildSignals({ symbol: 'BTC', fundingRatePct: 0.01 });
      expect(sigs[0].key).toBe('funding-mild');
    });

    it('omits funding when fundingRatePct is null', () => {
      expect(buildSignals({ symbol: 'BTC', fundingRatePct: null })).toEqual([]);
    });

    it('detail shows funding with sign + 4 decimals + /8h suffix', () => {
      const sigs = buildSignals({ symbol: 'BTC', fundingRatePct: 0.0500 });
      expect(sigs[0].detail).toBe('+0.0500%/8h');
    });

    it('detail shows negative funding without double-sign', () => {
      const sigs = buildSignals({ symbol: 'BTC', fundingRatePct: -0.0500 });
      expect(sigs[0].detail).toBe('-0.0500%/8h');
    });
  });

  /* ─── OI delta ──────────────────────────────────────────────── */

  describe('OI delta', () => {
    it('flags oi-shift bullish at +5% or higher', () => {
      const sigs = buildSignals({ symbol: 'BTC', openInterestChange24hPct: 5 });
      const oi = sigs.find(s => s.key === 'oi-shift');
      expect(oi).toBeDefined();
      expect(oi!.tone).toBe('bullish');
      expect(oi!.label).toBe('OI building');
    });

    it('flags oi-shift caution at -5% or lower', () => {
      const sigs = buildSignals({ symbol: 'BTC', openInterestChange24hPct: -7 });
      const oi = sigs.find(s => s.key === 'oi-shift');
      expect(oi!.tone).toBe('caution');
      expect(oi!.label).toBe('OI unwinding');
    });

    it('omits oi-shift inside (-5, +5) range', () => {
      const sigs = buildSignals({ symbol: 'BTC', openInterestChange24hPct: 4.9 });
      expect(sigs.find(s => s.key === 'oi-shift')).toBeUndefined();
    });

    it('boundary: exactly -5 promotes to oi-shift caution', () => {
      const sigs = buildSignals({ symbol: 'BTC', openInterestChange24hPct: -5 });
      expect(sigs.find(s => s.key === 'oi-shift')!.tone).toBe('caution');
    });
  });

  /* ─── Spot momentum ─────────────────────────────────────────── */

  describe('spot momentum', () => {
    it('flags spot-momo bullish at >=+5%', () => {
      const sigs = buildSignals({ symbol: 'BTC', change24hPct: 10 });
      const spot = sigs.find(s => s.key === 'spot-momo');
      expect(spot!.tone).toBe('bullish');
      expect(spot!.label).toBe('Strong move up');
    });

    it('flags spot-momo bearish at <=-5%', () => {
      const sigs = buildSignals({ symbol: 'BTC', change24hPct: -8 });
      const spot = sigs.find(s => s.key === 'spot-momo');
      expect(spot!.tone).toBe('bearish');
      expect(spot!.label).toBe('Strong move down');
    });

    it('omits spot-momo on a small move', () => {
      const sigs = buildSignals({ symbol: 'BTC', change24hPct: 2 });
      expect(sigs.find(s => s.key === 'spot-momo')).toBeUndefined();
    });

    it('detail shows pct with 2 decimals + 24h suffix', () => {
      const sigs = buildSignals({ symbol: 'BTC', change24hPct: 7.34 });
      expect(sigs.find(s => s.key === 'spot-momo')!.detail).toBe('+7.34% 24h');
    });
  });

  /* ─── Positioning skew ──────────────────────────────────────── */

  describe('positioning skew', () => {
    it('flags ls-long-heavy when longRatio >= 0.65', () => {
      const sigs = buildSignals({ symbol: 'BTC', longRatio: 0.70, shortRatio: 0.30 });
      const ls = sigs.find(s => s.key === 'ls-long-heavy');
      expect(ls!.tone).toBe('caution');
      expect(ls!.label).toBe('Crowded longs');
      expect(ls!.detail).toBe('70.0% long');
    });

    it('flags ls-short-heavy when longRatio <= 0.35', () => {
      const sigs = buildSignals({ symbol: 'BTC', longRatio: 0.20, shortRatio: 0.80 });
      const ls = sigs.find(s => s.key === 'ls-short-heavy');
      expect(ls!.tone).toBe('caution');
      expect(ls!.label).toBe('Crowded shorts');
      expect(ls!.detail).toBe('80.0% short');
    });

    it('omits both in balanced (35%, 65%) range', () => {
      const sigs = buildSignals({ symbol: 'BTC', longRatio: 0.5, shortRatio: 0.5 });
      expect(sigs.find(s => s.key.startsWith('ls-'))).toBeUndefined();
    });

    it('omits when only one ratio provided', () => {
      const sigs = buildSignals({ symbol: 'BTC', longRatio: 0.80 });
      expect(sigs.find(s => s.key.startsWith('ls-'))).toBeUndefined();
    });

    it('boundary: exactly 0.65 long promotes to ls-long-heavy', () => {
      const sigs = buildSignals({ symbol: 'BTC', longRatio: 0.65, shortRatio: 0.35 });
      expect(sigs.find(s => s.key === 'ls-long-heavy')).toBeDefined();
    });
  });

  /* ─── Confluence: quiet OI build ────────────────────────────── */

  describe('confluence: quiet OI build', () => {
    it('fires when funding flat (<0.01) AND OI growth >2%', () => {
      const sigs = buildSignals({
        symbol: 'BTC',
        fundingRatePct: 0.005,   // flat
        openInterestChange24hPct: 3, // > 2 but < 5 so no oi-shift
      });
      const c = sigs.find(s => s.key === 'quiet-build');
      expect(c).toBeDefined();
      expect(c!.tone).toBe('bullish');
      expect(c!.label).toBe('Quiet OI build');
    });

    it('does NOT fire when funding above 0.01', () => {
      const sigs = buildSignals({
        symbol: 'BTC',
        fundingRatePct: 0.02,
        openInterestChange24hPct: 3,
      });
      expect(sigs.find(s => s.key === 'quiet-build')).toBeUndefined();
    });

    it('does NOT fire when OI growth is <=2', () => {
      const sigs = buildSignals({
        symbol: 'BTC',
        fundingRatePct: 0.001,
        openInterestChange24hPct: 1.5,
      });
      expect(sigs.find(s => s.key === 'quiet-build')).toBeUndefined();
    });
  });

  /* ─── Confluence: long flush risk ───────────────────────────── */

  describe('confluence: long flush risk', () => {
    it('fires when funding > 0.03 AND OI < -2', () => {
      const sigs = buildSignals({
        symbol: 'BTC',
        fundingRatePct: 0.04,
        openInterestChange24hPct: -3,
      });
      const c = sigs.find(s => s.key === 'long-flush');
      expect(c).toBeDefined();
      expect(c!.tone).toBe('caution');
      expect(c!.label).toBe('Long flush risk');
    });

    it('does NOT fire when funding below 0.03', () => {
      const sigs = buildSignals({
        symbol: 'BTC',
        fundingRatePct: 0.02,
        openInterestChange24hPct: -3,
      });
      expect(sigs.find(s => s.key === 'long-flush')).toBeUndefined();
    });

    it('does NOT fire when OI is rising', () => {
      const sigs = buildSignals({
        symbol: 'BTC',
        fundingRatePct: 0.04,
        openInterestChange24hPct: 3,
      });
      expect(sigs.find(s => s.key === 'long-flush')).toBeUndefined();
    });
  });

  /* ─── RSI ───────────────────────────────────────────────────── */

  describe('RSI', () => {
    it('flags rsi-overbought (caution) at >=75', () => {
      const sigs = buildSignals({ symbol: 'BTC', rsi: 80 });
      const r = sigs.find(s => s.key === 'rsi-overbought');
      expect(r!.tone).toBe('caution');
      expect(r!.detail).toBe('80.0');
    });

    it('flags rsi-oversold (bullish) at <=25', () => {
      const sigs = buildSignals({ symbol: 'BTC', rsi: 20 });
      const r = sigs.find(s => s.key === 'rsi-oversold');
      expect(r!.tone).toBe('bullish');
    });

    it('omits in neutral 26-74 band', () => {
      const sigs = buildSignals({ symbol: 'BTC', rsi: 50 });
      expect(sigs.find(s => s.key.startsWith('rsi'))).toBeUndefined();
    });

    it('boundaries: exactly 75 = overbought, exactly 25 = oversold', () => {
      expect(buildSignals({ symbol: 'BTC', rsi: 75 })
        .find(s => s.key === 'rsi-overbought')).toBeDefined();
      expect(buildSignals({ symbol: 'BTC', rsi: 25 })
        .find(s => s.key === 'rsi-oversold')).toBeDefined();
    });
  });

  /* ─── Volatility (ATR %) ────────────────────────────────────── */

  describe('volatility', () => {
    it('flags vol-high (caution) at ATR% >=3', () => {
      const sigs = buildSignals({ symbol: 'BTC', atrPct: 4.2 });
      const v = sigs.find(s => s.key === 'vol-high');
      expect(v!.tone).toBe('caution');
      expect(v!.detail).toBe('ATR 4.20%');
    });

    it('flags vol-compressed (neutral) at ATR% <=0.5', () => {
      const sigs = buildSignals({ symbol: 'BTC', atrPct: 0.3 });
      const v = sigs.find(s => s.key === 'vol-compressed');
      expect(v!.tone).toBe('neutral');
    });

    it('omits in normal range (0.5, 3)', () => {
      const sigs = buildSignals({ symbol: 'BTC', atrPct: 1.5 });
      expect(sigs.find(s => s.key.startsWith('vol-'))).toBeUndefined();
    });

    it('boundary: exactly 0.5 promotes to vol-compressed', () => {
      const sigs = buildSignals({ symbol: 'BTC', atrPct: 0.5 });
      expect(sigs.find(s => s.key === 'vol-compressed')).toBeDefined();
    });
  });

  /* ─── Combined: ordering + multiple signals ─────────────────── */

  describe('combined signals', () => {
    it('emits multiple signals when multiple conditions fire', () => {
      const sigs = buildSignals({
        symbol: 'BTC',
        fundingRatePct: 0.08,             // funding-extreme
        openInterestChange24hPct: 8,      // oi-shift bullish
        change24hPct: 6,                  // spot-momo bullish
        longRatio: 0.72, shortRatio: 0.28, // ls-long-heavy
        rsi: 78,                          // rsi-overbought
        atrPct: 4,                        // vol-high
      });
      const keys = sigs.map(s => s.key);
      expect(keys).toContain('funding-extreme');
      expect(keys).toContain('oi-shift');
      expect(keys).toContain('spot-momo');
      expect(keys).toContain('ls-long-heavy');
      expect(keys).toContain('rsi-overbought');
      expect(keys).toContain('vol-high');
    });

    it('preserves emission order: funding → OI → spot → L/S → confluence → RSI → vol', () => {
      const sigs = buildSignals({
        symbol: 'BTC',
        fundingRatePct: 0.005,             // funding-flat (neutral)
        openInterestChange24hPct: 6,       // oi-shift + triggers quiet-build (wait, funding<0.01 AND oi>2)
        change24hPct: 6,                   // spot-momo
        longRatio: 0.72, shortRatio: 0.28, // ls-long-heavy
        rsi: 78,                           // rsi-overbought
        atrPct: 4,                         // vol-high
      });
      const keys = sigs.map(s => s.key);
      // Expected order from buildSignals function body
      expect(keys.indexOf('funding-flat')).toBeLessThan(keys.indexOf('oi-shift'));
      expect(keys.indexOf('oi-shift')).toBeLessThan(keys.indexOf('spot-momo'));
      expect(keys.indexOf('spot-momo')).toBeLessThan(keys.indexOf('ls-long-heavy'));
      expect(keys.indexOf('ls-long-heavy')).toBeLessThan(keys.indexOf('quiet-build'));
      expect(keys.indexOf('quiet-build')).toBeLessThan(keys.indexOf('rsi-overbought'));
      expect(keys.indexOf('rsi-overbought')).toBeLessThan(keys.indexOf('vol-high'));
    });

    it('keys are unique within a signal set (no duplicate chips)', () => {
      const sigs = buildSignals({
        symbol: 'BTC',
        fundingRatePct: 0.08, openInterestChange24hPct: 8,
        change24hPct: 6, longRatio: 0.8, shortRatio: 0.2,
        rsi: 80, atrPct: 5,
      });
      const keys = sigs.map(s => s.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
