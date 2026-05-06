import { describe, it, expect } from 'vitest';
import { scorePositionHealth, healthLabel, type PositionHealthInput } from '../position-health';

const base: PositionHealthInput = {
  side: 'long',
  size: 1,
  entryPrice: 50_000,
  markPrice: 50_000,
  leverage: 1,
  liquidationPrice: 25_000,
  tpPrice: null,
  slPrice: null,
  unrealizedPnl: 0,
  marginUsed: 50_000,
  currentFunding: 0,
} as PositionHealthInput;

describe('healthLabel', () => {
  it('maps score bands to labels', () => {
    expect(healthLabel(10)).toBe('critical');
    expect(healthLabel(35)).toBe('risky');
    expect(healthLabel(55)).toBe('caution');
    expect(healthLabel(75)).toBe('ok');
    expect(healthLabel(95)).toBe('healthy');
  });
});

describe('scorePositionHealth', () => {
  it('a clean unleveraged spot-like long with cushion is healthy', () => {
    const r = scorePositionHealth(base);
    expect(r.score).toBeGreaterThan(80);
    expect(r.label).toBeOneOf(['ok', 'healthy']);
    expect(r.reasons).toEqual([]);
  });

  it('25x leverage with no SL drags the score down hard', () => {
    const r = scorePositionHealth({
      ...base,
      leverage: 25,
      // 25x means liq is ~4% from entry: 50000 * 0.96 = 48000
      liquidationPrice: 48_000,
      slPrice: null,
    });
    expect(r.score).toBeLessThan(55);
    expect(r.label).toBeOneOf(['critical', 'risky', 'caution']);
    expect(r.reasons.some(x => x.includes('25× leverage'))).toBe(true);
    expect(r.reasons.some(x => x.includes('No stop-loss'))).toBe(true);
  });

  it('long paying high positive funding loses funding sub-score', () => {
    const r = scorePositionHealth({
      ...base,
      currentFunding: 0.15, // 0.15% per 8h ≈ 165%/year
    });
    expect(r.factors.funding).toBeLessThan(40);
    expect(r.reasons.some(x => x.includes('funding'))).toBe(true);
  });

  it('short collecting funding gets full funding score', () => {
    const r = scorePositionHealth({
      ...base,
      side: 'short',
      currentFunding: 0.05,  // longs paying shorts → short collects
      // Adjust liq for short — must be ABOVE entry/mark
      liquidationPrice: 75_000,
    });
    expect(r.factors.funding).toBe(100);
  });

  it('SL below mark for a long is valid', () => {
    const r = scorePositionHealth({ ...base, slPrice: 47_000 });
    expect(r.factors.stopLoss).toBe(100);
  });

  it('SL on the wrong side (above mark for a long) penalises', () => {
    const r = scorePositionHealth({
      ...base,
      leverage: 5,
      slPrice: 53_000,        // above mark — would never fire for a long
    });
    expect(r.factors.stopLoss).toBe(40);
  });

  it('unknown liquidation price gets partial credit, not zero', () => {
    const r = scorePositionHealth({ ...base, liquidationPrice: null });
    expect(r.factors.liqBuffer).toBe(50);
  });

  it('very deep underwater drags profitability score', () => {
    const r = scorePositionHealth({
      ...base,
      unrealizedPnl: -45_000,  // -90% of margin
      marginUsed: 50_000,
    });
    expect(r.factors.profitability).toBeLessThan(30);
  });

  it('liq buffer score zero when mark already past liq (long)', () => {
    // long: mark BELOW liq is past it
    const r = scorePositionHealth({
      ...base,
      markPrice: 24_000,
      liquidationPrice: 25_000,
    });
    expect(r.factors.liqBuffer).toBe(0);
  });

  it('liq buffer score zero when mark already past liq (short)', () => {
    const r = scorePositionHealth({
      ...base,
      side: 'short',
      markPrice: 76_000,
      liquidationPrice: 75_000,
    });
    expect(r.factors.liqBuffer).toBe(0);
  });

  it('reasons list capped at 3 items', () => {
    const r = scorePositionHealth({
      ...base,
      leverage: 50,
      liquidationPrice: 49_500, // ~1% buffer
      slPrice: null,
      currentFunding: 0.20,
      unrealizedPnl: -45_000,
    });
    expect(r.reasons.length).toBeLessThanOrEqual(3);
    expect(r.score).toBeLessThan(20);
    expect(r.label).toBe('critical');
  });

  it('1x position with no SL is not penalised heavily for missing SL', () => {
    const r = scorePositionHealth({ ...base, slPrice: null });
    // Spot-like: missing SL OK
    expect(r.factors.stopLoss).toBeGreaterThan(70);
  });

  it('10x position with no SL gets dinged hard on SL', () => {
    const r = scorePositionHealth({ ...base, leverage: 10, slPrice: null });
    expect(r.factors.stopLoss).toBeLessThanOrEqual(30);
  });
});
