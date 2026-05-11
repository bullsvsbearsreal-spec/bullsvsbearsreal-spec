/**
 * Unit tests for the pure-function math behind <BtcHalvingCountdown>.
 * We don't render the component (no testing-library in this repo) —
 * just lock in the contracts for partitionMs + cycleProgress.
 */

import { describe, it, expect } from 'vitest';
import {
  partitionMs,
  cycleProgress,
  LAST_HALVING_ISO,
  NEXT_HALVING_ISO,
} from '../BtcHalvingCountdown';

describe('partitionMs', () => {
  it('clamps negative ms to 0 (post-target case)', () => {
    expect(partitionMs(-1)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
    expect(partitionMs(-99999999)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });

  it('returns 0 for exactly 0', () => {
    expect(partitionMs(0)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });

  it('splits seconds correctly', () => {
    expect(partitionMs(1000)).toEqual({ d: 0, h: 0, m: 0, s: 1 });
    expect(partitionMs(59_000)).toEqual({ d: 0, h: 0, m: 0, s: 59 });
  });

  it('rolls over seconds → minutes', () => {
    expect(partitionMs(60_000)).toEqual({ d: 0, h: 0, m: 1, s: 0 });
    expect(partitionMs(60_500)).toEqual({ d: 0, h: 0, m: 1, s: 0 });
    expect(partitionMs(125_000)).toEqual({ d: 0, h: 0, m: 2, s: 5 });
  });

  it('rolls over minutes → hours', () => {
    expect(partitionMs(60 * 60 * 1000)).toEqual({ d: 0, h: 1, m: 0, s: 0 });
    expect(partitionMs(3 * 60 * 60 * 1000 + 30 * 60 * 1000)).toEqual({ d: 0, h: 3, m: 30, s: 0 });
  });

  it('rolls over hours → days', () => {
    expect(partitionMs(86_400_000)).toEqual({ d: 1, h: 0, m: 0, s: 0 });
    expect(partitionMs(86_400_000 + 3_600_000)).toEqual({ d: 1, h: 1, m: 0, s: 0 });
  });

  it('large delta (e.g. ~1450 days) split correctly', () => {
    // 2024-04-19 → 2028-04-17 = ~1459 days
    const last = Date.parse(LAST_HALVING_ISO);
    const next = Date.parse(NEXT_HALVING_ISO);
    const delta = next - last;
    const p = partitionMs(delta);
    expect(p.d).toBeGreaterThan(1400);
    expect(p.d).toBeLessThan(1500);
    expect(p.h).toBeGreaterThanOrEqual(0);
    expect(p.h).toBeLessThan(24);
  });

  it('round-trips: reconstructing ms from partitions matches input (modulo sub-second)', () => {
    const inputMs = 88_321_654; // ~24.5 hours
    const p = partitionMs(inputMs);
    const reconstructed = p.d * 86400_000 + p.h * 3600_000 + p.m * 60_000 + p.s * 1000;
    // Sub-second drift expected (we floor)
    expect(inputMs - reconstructed).toBeLessThan(1000);
    expect(inputMs - reconstructed).toBeGreaterThanOrEqual(0);
  });
});

describe('cycleProgress', () => {
  const last = Date.parse(LAST_HALVING_ISO);
  const next = Date.parse(NEXT_HALVING_ISO);

  it('returns 0 at the start of the cycle', () => {
    expect(cycleProgress(last)).toBe(0);
  });

  it('returns 1 at the end of the cycle', () => {
    expect(cycleProgress(next)).toBe(1);
  });

  it('clamps to 0 before the cycle started', () => {
    expect(cycleProgress(last - 86_400_000)).toBe(0);
  });

  it('clamps to 1 after the cycle ended', () => {
    expect(cycleProgress(next + 86_400_000)).toBe(1);
  });

  it('returns ~0.5 at the midpoint', () => {
    const mid = (last + next) / 2;
    const p = cycleProgress(mid);
    expect(p).toBeGreaterThan(0.49);
    expect(p).toBeLessThan(0.51);
  });

  it('returns a monotonically increasing value through the cycle', () => {
    const checkpoints = [last, last + 1_000_000, last + 10_000_000, last + 1_000_000_000];
    const values = checkpoints.map(cycleProgress);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});

describe('halving constants', () => {
  it('LAST_HALVING_ISO is the April 2024 halving date', () => {
    expect(LAST_HALVING_ISO).toBe('2024-04-19T00:00:00Z');
  });

  it('NEXT_HALVING_ISO is in April 2028 (next expected halving)', () => {
    expect(NEXT_HALVING_ISO).toMatch(/^2028-04/);
  });

  it('next halving is exactly 4 years after the last (within 30 days)', () => {
    // BTC halving every 210,000 blocks ≈ 4 years; chain re-targets keep
    // ~4 year cadence within a couple weeks. Allow 30 days slack.
    const last = Date.parse(LAST_HALVING_ISO);
    const next = Date.parse(NEXT_HALVING_ISO);
    const diff = next - last;
    const fourYears = 4 * 365 * 86_400_000;
    expect(Math.abs(diff - fourYears)).toBeLessThan(30 * 86_400_000);
  });
});
