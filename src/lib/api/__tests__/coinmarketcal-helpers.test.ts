import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EVENT_CATEGORIES,
  getCategoryIcon,
  formatEventDate,
  formatTimeAgo,
} from '../coinmarketcal';

describe('EVENT_CATEGORIES', () => {
  it('has 17 categories defined (matches coinmarketcal API spec)', () => {
    expect(Object.keys(EVENT_CATEGORIES)).toHaveLength(17);
  });

  it('every category has id + name + icon', () => {
    Object.values(EVENT_CATEGORIES).forEach((c) => {
      expect(typeof c.id).toBe('number');
      expect(c.id).toBeGreaterThan(0);
      expect(c.name).toBeTruthy();
      expect(c.icon).toBeTruthy();
    });
  });

  it('every category id is unique', () => {
    const ids = Object.values(EVENT_CATEGORIES).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains the major event types', () => {
    expect(EVENT_CATEGORIES.AIRDROP).toBeDefined();
    expect(EVENT_CATEGORIES.UNLOCK).toBeDefined();
    expect(EVENT_CATEGORIES.PARTNERSHIP).toBeDefined();
    expect(EVENT_CATEGORIES.HARDFORK).toBeDefined();
  });
});

describe('getCategoryIcon', () => {
  it('returns the icon for a known category (case-insensitive)', () => {
    expect(getCategoryIcon('Airdrop')).toBe('🎁');
    expect(getCategoryIcon('airdrop')).toBe('🎁');
    expect(getCategoryIcon('AIRDROP')).toBe('🎁');
  });

  it('returns the calendar emoji fallback for unknown categories', () => {
    expect(getCategoryIcon('NotACategory')).toBe('📅');
    expect(getCategoryIcon('')).toBe('📅');
  });

  it('matches category names with spaces (e.g. "Hard Fork")', () => {
    expect(getCategoryIcon('Hard Fork')).toBe('🍴');
    expect(getCategoryIcon('Token Unlock')).toBe('🔓');
  });
});

describe('formatEventDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Today" for sub-1h-from-now (Math.ceil rounds 0 → 0)', () => {
    // Math.ceil(diffMs / 1day) → 0 when diff < 0, else round up
    // For "today" we need diffDays === 0 — i.e. (event - now) / 86400000 = 0
    // after ceiling. That's only true for the exact same instant or
    // microseconds ahead. Use exactly "now".
    expect(formatEventDate('2026-05-19T12:00:00Z')).toBe('Today');
  });

  it('returns "Tomorrow" for tomorrow (any time 0-24h ahead rounds to 1)', () => {
    expect(formatEventDate('2026-05-20T12:00:00Z')).toBe('Tomorrow');
    expect(formatEventDate('2026-05-19T18:00:00Z')).toBe('Tomorrow');  // +6h → ceil 0.25 → 1
  });

  it('returns "Yesterday" for yesterday', () => {
    expect(formatEventDate('2026-05-18T08:00:00Z')).toBe('Yesterday');
  });

  it('returns "N days ago" for events 2-6 days in the past', () => {
    expect(formatEventDate('2026-05-15T12:00:00Z')).toMatch(/days ago/);
  });

  it('returns "In N days" for events 2-7 days in the future', () => {
    const out = formatEventDate('2026-05-23T12:00:00Z');
    expect(out).toMatch(/In \d days/);
  });

  it('falls back to "Mon D" for events beyond +7 days', () => {
    const out = formatEventDate('2026-07-15T12:00:00Z');
    // Format depends on locale, but should NOT include "In X days"
    expect(out).not.toMatch(/In \d/);
  });

  it('falls back to "Mon D" for events beyond -7 days', () => {
    const out = formatEventDate('2026-04-15T12:00:00Z');
    expect(out).not.toMatch(/days ago/);
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Xm ago" for sub-hour ages (timestamp in seconds)', () => {
    const fiveMinAgo = Math.floor((Date.now() - 5 * 60_000) / 1000);
    expect(formatTimeAgo(fiveMinAgo)).toBe('5m ago');
  });

  it('returns "Xh ago" for sub-day ages', () => {
    const threeHoursAgo = Math.floor((Date.now() - 3 * 60 * 60_000) / 1000);
    expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('returns "Xd ago" for sub-week ages', () => {
    const twoDaysAgo = Math.floor((Date.now() - 2 * 24 * 60 * 60_000) / 1000);
    expect(formatTimeAgo(twoDaysAgo)).toBe('2d ago');
  });

  it('falls back to "Mon D" for ages beyond a week', () => {
    const fiftyDaysAgo = Math.floor((Date.now() - 50 * 24 * 60 * 60_000) / 1000);
    const out = formatTimeAgo(fiftyDaysAgo);
    expect(out).not.toMatch(/ago$/);
  });
});
