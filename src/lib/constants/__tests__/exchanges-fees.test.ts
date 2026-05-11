/**
 * Unit tests for the fee-schedule snapshot helper exposed on
 * /api/v1/arbitrage. The route handler is integration-tested
 * separately — these just lock down the helper's contract so a
 * silent shape change can't break consumers.
 */

import { describe, it, expect } from 'vitest';
import {
  EXCHANGE_FEES,
  FEE_MODEL_VERSION,
  FEE_MODEL_UPDATED_AT,
  getFeeScheduleSnapshot,
} from '../exchanges';

describe('getFeeScheduleSnapshot', () => {
  const snap = getFeeScheduleSnapshot();

  it('exposes the version + updatedAt verbatim', () => {
    expect(snap.version).toBe(FEE_MODEL_VERSION);
    expect(snap.updatedAt).toBe(FEE_MODEL_UPDATED_AT);
  });

  it('declares percent as the unit', () => {
    expect(snap.unit).toBe('percent');
  });

  it('echoes every exchange in EXCHANGE_FEES', () => {
    const fromConst = Object.keys(EXCHANGE_FEES).sort();
    const fromSnap = Object.keys(snap.schedule).sort();
    expect(fromSnap).toEqual(fromConst);
  });

  it('returns the same maker + taker as the underlying constant', () => {
    for (const [ex, fees] of Object.entries(EXCHANGE_FEES)) {
      expect(snap.schedule[ex].maker).toBe(fees.maker);
      expect(snap.schedule[ex].taker).toBe(fees.taker);
    }
  });

  it('shallow-clones values so callers cannot mutate EXCHANGE_FEES', () => {
    const before = EXCHANGE_FEES.Binance.taker;
    const s = getFeeScheduleSnapshot();
    s.schedule.Binance.taker = 99;
    expect(EXCHANGE_FEES.Binance.taker).toBe(before);
  });

  it('version follows the vMAJOR.MINOR-YYYY-MM-DD format', () => {
    expect(FEE_MODEL_VERSION).toMatch(/^v\d+\.\d+-\d{4}-\d{2}-\d{2}$/);
  });

  it('updatedAt is a valid ISO-8601 UTC timestamp', () => {
    expect(FEE_MODEL_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Number.isFinite(Date.parse(FEE_MODEL_UPDATED_AT))).toBe(true);
  });
});
