/**
 * Unit tests for buildAiInsight — the heuristic that powers the
 * <ChartAiStrip> Bloomberg-style commentary line.
 *
 * Tests the ranking + threshold behavior, not the JSX rendering.
 * Locks in: which signals fire at which thresholds, weight order,
 * top-2 truncation, and the warming-up fallback.
 */

import { describe, it, expect } from 'vitest';
import { buildAiInsight } from '../ChartTerminalStrips';

describe('buildAiInsight', () => {
  /* ─── Empty / fallback ──────────────────────────────────────── */

  it('returns warming-up fallback when no signals fire', () => {
    expect(buildAiInsight({ symbol: 'BTC' })).toBe(
      'BTC: warming up — no strong signal on either side.',
    );
  });

  it('returns warming-up when all signals are sub-threshold', () => {
    const result = buildAiInsight({
      symbol: 'BTC',
      fundingRatePct: 0.001,   // below 0.005 threshold
      openInterestChange24hPct: 1, // below 2 threshold
      change24hPct: 0.5,       // below 2 threshold
      rsi: 50,                  // neutral
      longRatio: 0.5,           // balanced
      atrPct: 1.5,              // below 4 threshold and above 0.5
    });
    expect(result).toContain('warming up');
  });

  it('prefixes every insight with the symbol', () => {
    const result = buildAiInsight({ symbol: 'ETH', fundingRatePct: 0.10 });
    expect(result).toMatch(/^ETH: /);
  });

  /* ─── Funding regime thresholds ─────────────────────────────── */

  it('flags funding overheated at >=0.05% positive', () => {
    expect(buildAiInsight({ symbol: 'BTC', fundingRatePct: 0.05 }))
      .toContain('Funding overheated');
    expect(buildAiInsight({ symbol: 'BTC', fundingRatePct: 0.20 }))
      .toContain('longs paying a heavy carry');
  });

  it('flags funding deeply negative at <=-0.05%', () => {
    expect(buildAiInsight({ symbol: 'BTC', fundingRatePct: -0.05 }))
      .toContain('Funding deeply negative');
    expect(buildAiInsight({ symbol: 'BTC', fundingRatePct: -0.10 }))
      .toContain('shorts paying out');
  });

  it('flags funding hot at 0.02-0.05%', () => {
    expect(buildAiInsight({ symbol: 'BTC', fundingRatePct: 0.025 }))
      .toContain('Funding hot');
    expect(buildAiInsight({ symbol: 'BTC', fundingRatePct: 0.025 }))
      .toContain('longs paying');
  });

  it('flags funding mild at 0.005-0.02% (lowest tier)', () => {
    expect(buildAiInsight({ symbol: 'BTC', fundingRatePct: 0.01 }))
      .toContain('Funding mild');
  });

  it('does not include any funding bit below 0.005%', () => {
    const result = buildAiInsight({ symbol: 'BTC', fundingRatePct: 0.001 });
    expect(result).not.toContain('Funding');
  });

  /* ─── RSI extremes ──────────────────────────────────────────── */

  it('flags RSI overbought at >=75', () => {
    expect(buildAiInsight({ symbol: 'BTC', rsi: 80 })).toContain('overbought territory');
  });

  it('flags RSI stretched at 70-75', () => {
    expect(buildAiInsight({ symbol: 'BTC', rsi: 72 })).toContain('stretched');
  });

  it('flags RSI oversold at <=25', () => {
    expect(buildAiInsight({ symbol: 'BTC', rsi: 20 })).toContain('oversold');
  });

  it('flags RSI cooling at 25-30', () => {
    expect(buildAiInsight({ symbol: 'BTC', rsi: 28 })).toContain('cooling');
  });

  it('does not flag neutral RSI (30-70 range)', () => {
    const result = buildAiInsight({ symbol: 'BTC', rsi: 50 });
    expect(result).not.toContain('RSI');
  });

  /* ─── Ranking: funding extreme outranks RSI stretched ───────── */

  it('puts the heaviest signal first in the output', () => {
    // funding overheated (weight 100) > RSI overbought (weight 80)
    const result = buildAiInsight({
      symbol: 'BTC',
      fundingRatePct: 0.06,
      rsi: 76,
    });
    const fundingIdx = result.indexOf('Funding');
    const rsiIdx = result.indexOf('RSI');
    expect(fundingIdx).toBeGreaterThan(-1);
    expect(rsiIdx).toBeGreaterThan(-1);
    expect(fundingIdx).toBeLessThan(rsiIdx);
  });

  /* ─── Top-2 truncation ──────────────────────────────────────── */

  it('returns at most the top 2 signals even when 3+ fire', () => {
    const result = buildAiInsight({
      symbol: 'BTC',
      fundingRatePct: 0.10,    // weight 100
      rsi: 80,                  // weight 80
      openInterestChange24hPct: 10,  // weight 65
      change24hPct: 8,         // weight 60
    });
    // Funding (highest) + RSI (2nd) should appear, OI + spot should not
    expect(result).toContain('Funding overheated');
    expect(result).toContain('RSI 80');
    // OI weight 65 and spot weight 60 lose the truncation
    expect(result).not.toContain('OI +');
    expect(result).not.toContain('Spot +8');
  });

  /* ─── Crowded book signal ───────────────────────────────────── */

  it('flags crowded longs at longRatio >= 0.65', () => {
    expect(buildAiInsight({ symbol: 'BTC', longRatio: 0.70 }))
      .toContain('70% long — crowded');
  });

  it('flags crowded shorts at longRatio <= 0.35', () => {
    expect(buildAiInsight({ symbol: 'BTC', longRatio: 0.30 }))
      .toContain('70% short — crowded');  // 100 - 30 = 70% short
  });

  /* ─── Volatility regime ─────────────────────────────────────── */

  it('flags elevated volatility at ATR >= 4%', () => {
    expect(buildAiInsight({ symbol: 'BTC', atrPct: 5 }))
      .toContain('Volatility elevated');
  });

  it('flags compressed volatility at ATR <= 0.5%', () => {
    expect(buildAiInsight({ symbol: 'BTC', atrPct: 0.3 }))
      .toContain('Volatility compressed');
  });

  /* ─── OI delta ──────────────────────────────────────────────── */

  it('flags OI building at >=5% 24h positive change', () => {
    expect(buildAiInsight({ symbol: 'BTC', openInterestChange24hPct: 6 }))
      .toContain('fresh positioning');
  });

  it('flags OI unwinding at <=-5% 24h negative change', () => {
    expect(buildAiInsight({ symbol: 'BTC', openInterestChange24hPct: -8 }))
      .toContain('positions unwinding');
  });

  /* ─── Determinism ───────────────────────────────────────────── */

  it('is deterministic — same input always returns same output', () => {
    const data = {
      symbol: 'BTC',
      fundingRatePct: 0.03,
      rsi: 65,
      openInterestChange24hPct: 3,
    };
    const a = buildAiInsight(data);
    const b = buildAiInsight(data);
    const c = buildAiInsight(data);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});
