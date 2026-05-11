/**
 * Unit tests for the three formatters used across the chart strips:
 *   - fmtCompactUsd: USD as K/M/B/T compact strings
 *   - fmtPct:        percent with configurable digits + sign
 *   - fmtCountdown:  ms → HH:MM:SS
 *
 * The strips render dozens of these per second, and a single bad format
 * leaks immediately to the user (the prior $0.0000e+0 / $0 H/L regression
 * was exactly this kind of bug). Tests lock the threshold cutoffs and
 * the null-data behavior.
 */

import { describe, it, expect } from 'vitest';
import {
  fmtCompactUsd,
  fmtPct,
  fmtCountdown,
} from '../ChartTerminalStrips';

/* ─── fmtCompactUsd ──────────────────────────────────────────────── */

describe('fmtCompactUsd', () => {
  it('returns em-dash for null / undefined / NaN / Infinity', () => {
    expect(fmtCompactUsd(null)).toBe('—');
    expect(fmtCompactUsd(undefined)).toBe('—');
    expect(fmtCompactUsd(NaN)).toBe('—');
    expect(fmtCompactUsd(Infinity)).toBe('—');
    expect(fmtCompactUsd(-Infinity)).toBe('—');
  });

  it('handles literal zero without exponent notation', () => {
    expect(fmtCompactUsd(0)).toBe('$0');
  });

  it('renders sub-thousand without suffix', () => {
    expect(fmtCompactUsd(500)).toBe('$500');
    expect(fmtCompactUsd(999)).toBe('$999');
  });

  it('uses K for thousands, with 1 decimal', () => {
    expect(fmtCompactUsd(1500)).toBe('$1.5K');
    expect(fmtCompactUsd(999_999)).toBe('$1000.0K');
  });

  it('uses M for millions, with 2 decimals', () => {
    expect(fmtCompactUsd(1_500_000)).toBe('$1.50M');
    expect(fmtCompactUsd(12_300_000)).toBe('$12.30M');
  });

  it('uses B for billions', () => {
    expect(fmtCompactUsd(11_220_000_000)).toBe('$11.22B');
    expect(fmtCompactUsd(40_400_000_000)).toBe('$40.40B');
  });

  it('uses T for trillions', () => {
    expect(fmtCompactUsd(1_500_000_000_000)).toBe('$1.50T');
  });

  it('shows sign prefix when opts.sign + positive', () => {
    expect(fmtCompactUsd(1_500_000, { sign: true })).toBe('+$1.50M');
  });

  it('always shows minus for negative regardless of opts.sign', () => {
    expect(fmtCompactUsd(-1_500_000)).toBe('-$1.50M');
    expect(fmtCompactUsd(-1_500_000, { sign: true })).toBe('-$1.50M');
  });

  it('boundary: 1000 exactly crosses into K bucket', () => {
    expect(fmtCompactUsd(1000)).toBe('$1.0K');
    expect(fmtCompactUsd(999.99)).toBe('$1000');
  });
});

/* ─── fmtPct ─────────────────────────────────────────────────────── */

describe('fmtPct', () => {
  it('returns em-dash for null / undefined / NaN / Infinity', () => {
    expect(fmtPct(null)).toBe('—');
    expect(fmtPct(undefined)).toBe('—');
    expect(fmtPct(NaN)).toBe('—');
    expect(fmtPct(Infinity)).toBe('—');
  });

  it('formats positive with default 2 digits', () => {
    expect(fmtPct(1.234)).toBe('1.23%');
    expect(fmtPct(0)).toBe('0.00%');
  });

  it('shows minus sign for negatives (default)', () => {
    expect(fmtPct(-1.234)).toBe('-1.23%');
  });

  it('shows plus sign for positives when opts.sign', () => {
    expect(fmtPct(1.234, { sign: true })).toBe('+1.23%');
  });

  it('preserves minus for negatives even with opts.sign', () => {
    expect(fmtPct(-1.234, { sign: true })).toBe('-1.23%');
  });

  it('respects opts.digits', () => {
    expect(fmtPct(1.23456, { digits: 4 })).toBe('1.2346%');
    expect(fmtPct(1.23456, { digits: 0 })).toBe('1%');
  });

  it('zero with sign still shows + sign per implementation', () => {
    // The implementation includes 0 in the "show + sign" branch
    expect(fmtPct(0, { sign: true })).toBe('+0.00%');
  });
});

/* ─── fmtCountdown ───────────────────────────────────────────────── */

describe('fmtCountdown', () => {
  it('clamps non-positive ms to 00:00:00', () => {
    expect(fmtCountdown(0)).toBe('00:00:00');
    expect(fmtCountdown(-1)).toBe('00:00:00');
    expect(fmtCountdown(-9999999)).toBe('00:00:00');
  });

  it('formats sub-minute', () => {
    expect(fmtCountdown(1000)).toBe('00:00:01');
    expect(fmtCountdown(59_000)).toBe('00:00:59');
  });

  it('formats sub-hour', () => {
    expect(fmtCountdown(60_000)).toBe('00:01:00');
    expect(fmtCountdown(3_599_000)).toBe('00:59:59');
  });

  it('formats multi-hour', () => {
    expect(fmtCountdown(3_600_000)).toBe('01:00:00');
    expect(fmtCountdown(7_200_000 + 60_000 + 30_000)).toBe('02:01:30');
  });

  it('zero-pads single digits', () => {
    expect(fmtCountdown(5_000)).toBe('00:00:05');
    expect(fmtCountdown(60_000 + 5_000)).toBe('00:01:05');
  });

  it('handles >24h without rolling to days', () => {
    // 25 hours
    expect(fmtCountdown(25 * 3_600_000)).toBe('25:00:00');
  });

  it('floors fractional ms (sub-second drop)', () => {
    expect(fmtCountdown(1_999)).toBe('00:00:01'); // not 00:00:02
  });
});
