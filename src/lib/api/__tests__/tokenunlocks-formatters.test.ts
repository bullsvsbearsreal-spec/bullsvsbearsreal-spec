/**
 * Tests for the token-unlock display formatters used by /token-unlocks
 * and /airdrops. These run on every row render — a regression that
 * drops the "$" or scales by the wrong order of magnitude would render
 * misleading dollar values in the unlocks calendar.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatUnlockAmount,
  formatUnlockValue,
  getDaysUntilUnlock,
  formatUnlockDate,
} from '../tokenunlocks';

describe('formatUnlockAmount — token quantity formatter', () => {
  it('formats billions with B suffix and 2 decimals', () => {
    expect(formatUnlockAmount(1_500_000_000)).toBe('1.50B');
    expect(formatUnlockAmount(2_345_000_000)).toBe('2.35B');
  });

  it('formats millions with M suffix', () => {
    expect(formatUnlockAmount(5_000_000)).toBe('5.00M');
    expect(formatUnlockAmount(1_234_567)).toBe('1.23M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatUnlockAmount(50_000)).toBe('50.00K');
    expect(formatUnlockAmount(1_500)).toBe('1.50K');
  });

  it('formats small numbers with no suffix, integer', () => {
    expect(formatUnlockAmount(500)).toBe('500');
    expect(formatUnlockAmount(0)).toBe('0');
    expect(formatUnlockAmount(99)).toBe('99');
  });

  it('boundary at exactly 1K, 1M, 1B uses the higher suffix', () => {
    expect(formatUnlockAmount(1_000)).toBe('1.00K');
    expect(formatUnlockAmount(1_000_000)).toBe('1.00M');
    expect(formatUnlockAmount(1_000_000_000)).toBe('1.00B');
  });
});

describe('formatUnlockValue — USD value formatter', () => {
  it('always prefixes with "$"', () => {
    expect(formatUnlockValue(1_000_000_000)).toBe('$1.00B');
    expect(formatUnlockValue(5_000_000)).toBe('$5.00M');
    expect(formatUnlockValue(50_000)).toBe('$50.00K');
    expect(formatUnlockValue(500)).toBe('$500');
  });

  it('zero formats as "$0"', () => {
    expect(formatUnlockValue(0)).toBe('$0');
  });
});

describe('getDaysUntilUnlock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for today', () => {
    expect(getDaysUntilUnlock('2026-05-08T12:00:00Z')).toBe(0);
  });

  it('returns positive integer for future dates', () => {
    expect(getDaysUntilUnlock('2026-05-15T12:00:00Z')).toBe(7);
    expect(getDaysUntilUnlock('2026-06-08T12:00:00Z')).toBe(31);
  });

  it('returns negative integer for past dates', () => {
    expect(getDaysUntilUnlock('2026-05-01T12:00:00Z')).toBe(-7);
    expect(getDaysUntilUnlock('2026-04-08T12:00:00Z')).toBe(-30);
  });

  it('uses ceiling rounding (any future hours = 1 day)', () => {
    // 6 hours into the future rounds up to 1 day.
    expect(getDaysUntilUnlock('2026-05-08T18:00:00Z')).toBe(1);
  });
});

describe('formatUnlockDate — human-readable relative formatter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats today as "Today"', () => {
    expect(formatUnlockDate('2026-05-08T12:00:00Z')).toBe('Today');
  });

  it('formats tomorrow as "Tomorrow"', () => {
    // 24h ahead → ceil → 1 day
    expect(formatUnlockDate('2026-05-09T12:00:00Z')).toBe('Tomorrow');
  });

  it('formats past dates as "Unlocked"', () => {
    expect(formatUnlockDate('2026-05-01T12:00:00Z')).toBe('Unlocked');
    expect(formatUnlockDate('2025-12-25T00:00:00Z')).toBe('Unlocked');
  });

  it('formats 2-7 days as "In N days"', () => {
    expect(formatUnlockDate('2026-05-10T12:00:00Z')).toBe('In 2 days');
    expect(formatUnlockDate('2026-05-15T12:00:00Z')).toBe('In 7 days');
  });

  it('formats 8-30 days as "In N weeks" (rounded up)', () => {
    // 8 days → ceil(8/7) = 2 weeks
    expect(formatUnlockDate('2026-05-16T12:00:00Z')).toBe('In 2 weeks');
    // 21 days → ceil(21/7) = 3 weeks
    expect(formatUnlockDate('2026-05-29T12:00:00Z')).toBe('In 3 weeks');
  });

  it('formats >30 days as "Mon DD" date', () => {
    const r = formatUnlockDate('2026-08-15T12:00:00Z');
    // toLocaleDateString format depends on locale; just check it's date-like.
    expect(r).toMatch(/Aug.*15/);
  });
});
