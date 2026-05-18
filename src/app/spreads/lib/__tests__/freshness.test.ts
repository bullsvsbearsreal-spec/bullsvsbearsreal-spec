import { describe, it, expect } from 'vitest';
import {
  FRESH_MS,
  WARM_MS,
  STALE_MS,
  DEAD_MS,
  getFreshness,
  getFreshnessColor,
  getFreshnessDotColor,
  getFreshnessOpacity,
  type FreshnessLevel,
} from '../freshness';

describe('freshness constants', () => {
  it('are monotonically increasing (fresh < warm < stale < dead)', () => {
    expect(FRESH_MS).toBeLessThan(WARM_MS);
    expect(WARM_MS).toBeLessThan(STALE_MS);
    expect(STALE_MS).toBeLessThan(DEAD_MS);
  });

  it('FRESH_MS is 3s (real-time tier)', () => {
    expect(FRESH_MS).toBe(3000);
  });

  it('DEAD_MS is 60s (disconnected tier)', () => {
    expect(DEAD_MS).toBe(60000);
  });
});

describe('getFreshness', () => {
  it('returns "fresh" for ages within FRESH_MS', () => {
    expect(getFreshness(0)).toBe('fresh');
    expect(getFreshness(1000)).toBe('fresh');
    expect(getFreshness(FRESH_MS)).toBe('fresh');
  });

  it('returns "warm" for ages between FRESH and WARM thresholds', () => {
    expect(getFreshness(FRESH_MS + 1)).toBe('warm');
    expect(getFreshness(WARM_MS)).toBe('warm');
  });

  it('returns "stale" for ages between WARM and STALE thresholds', () => {
    expect(getFreshness(WARM_MS + 1)).toBe('stale');
    expect(getFreshness(STALE_MS)).toBe('stale');
  });

  it('returns "dead" for ages above STALE_MS', () => {
    expect(getFreshness(STALE_MS + 1)).toBe('dead');
    expect(getFreshness(60_000)).toBe('dead');
    expect(getFreshness(999_999)).toBe('dead');
  });

  it('handles edge case of zero age (just-received)', () => {
    expect(getFreshness(0)).toBe('fresh');
  });

  it('returns a known level for any non-negative input', () => {
    const validLevels = new Set<FreshnessLevel>(['fresh', 'warm', 'stale', 'dead']);
    [0, 1, 999, 10_000, 1e6, 1e9].forEach((age) => {
      expect(validLevels.has(getFreshness(age))).toBe(true);
    });
  });
});

describe('getFreshnessColor', () => {
  it('returns distinct Tailwind classes per level', () => {
    const fresh = getFreshnessColor('fresh');
    const warm = getFreshnessColor('warm');
    const stale = getFreshnessColor('stale');
    const dead = getFreshnessColor('dead');
    expect(fresh).not.toBe(warm);
    expect(stale).not.toBe(dead);
  });

  it('fresh is green (positive signal)', () => {
    expect(getFreshnessColor('fresh')).toContain('green');
  });

  it('stale/dead are red (warning signal)', () => {
    expect(getFreshnessColor('stale')).toContain('red');
    expect(getFreshnessColor('dead')).toContain('red');
  });

  it('returns a string for every level (no undefined returns)', () => {
    (['fresh', 'warm', 'stale', 'dead'] as FreshnessLevel[]).forEach((level) => {
      const out = getFreshnessColor(level);
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
    });
  });
});

describe('getFreshnessDotColor', () => {
  it('returns a Tailwind bg-* class for every level', () => {
    (['fresh', 'warm', 'stale', 'dead'] as FreshnessLevel[]).forEach((level) => {
      expect(getFreshnessDotColor(level)).toMatch(/^bg-/);
    });
  });

  it('fresh is green-400 (matches text color tone)', () => {
    expect(getFreshnessDotColor('fresh')).toContain('green');
  });
});

describe('getFreshnessOpacity', () => {
  it('returns empty string for fresh + warm (full opacity)', () => {
    expect(getFreshnessOpacity('fresh')).toBe('');
    expect(getFreshnessOpacity('warm')).toBe('');
  });

  it('returns opacity-* class for stale + dead (dimmed)', () => {
    expect(getFreshnessOpacity('stale')).toContain('opacity');
    expect(getFreshnessOpacity('dead')).toContain('opacity');
  });

  it('dead is dimmer than stale (deeper opacity reduction)', () => {
    const stale = getFreshnessOpacity('stale');
    const dead = getFreshnessOpacity('dead');
    // Extract the numeric value (e.g. opacity-35 → 35)
    const staleNum = parseInt(stale.match(/opacity-(\d+)/)?.[1] ?? '100', 10);
    const deadNum = parseInt(dead.match(/opacity-(\d+)/)?.[1] ?? '100', 10);
    expect(deadNum).toBeLessThan(staleNum);
  });
});
