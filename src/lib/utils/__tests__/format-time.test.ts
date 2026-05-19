import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime, formatTime, formatTimeAgo } from '../format';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for sub-60s ages', () => {
    const now = Date.now();
    expect(formatRelativeTime(now)).toBe('Just now');
    expect(formatRelativeTime(now - 30_000)).toBe('Just now');
    expect(formatRelativeTime(now - 59_999)).toBe('Just now');
  });

  it('returns "Xm ago" for sub-hour ages', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60_000)).toBe('1m ago');
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('5m ago');
    expect(formatRelativeTime(now - 59 * 60_000)).toBe('59m ago');
  });

  it('returns "Xh ago" for sub-day ages', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60 * 60_000)).toBe('1h ago');
    expect(formatRelativeTime(now - 5 * 60 * 60_000)).toBe('5h ago');
    expect(formatRelativeTime(now - 23 * 60 * 60_000)).toBe('23h ago');
  });

  it('returns "Xd ago" for day+ ages', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 24 * 60 * 60_000)).toBe('1d ago');
    expect(formatRelativeTime(now - 30 * 24 * 60 * 60_000)).toBe('30d ago');
  });
});

describe('formatTime', () => {
  it('returns a HH:MM time string', () => {
    const out = formatTime(new Date('2026-05-19T14:35:00').getTime());
    // Format depends on locale, but should match HH:MM pattern
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  it('uses 2-digit minutes (zero-padded)', () => {
    const out = formatTime(new Date('2026-05-19T14:05:00').getTime());
    expect(out).toMatch(/:05/);
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

  it('returns "just now" for <1 minute ago', () => {
    expect(formatTimeAgo('2026-05-19T11:59:30Z')).toBe('just now');
    expect(formatTimeAgo('2026-05-19T12:00:00Z')).toBe('just now');
  });

  it('returns "just now" for future timestamps (clock skew)', () => {
    // ms < 0 path
    expect(formatTimeAgo('2026-05-19T12:05:00Z')).toBe('just now');
  });

  it('returns "Xm ago" for sub-hour ages', () => {
    expect(formatTimeAgo('2026-05-19T11:55:00Z')).toBe('5m ago');
    expect(formatTimeAgo('2026-05-19T11:01:00Z')).toBe('59m ago');
  });

  it('returns "Xh ago" for sub-day ages', () => {
    expect(formatTimeAgo('2026-05-19T09:00:00Z')).toBe('3h ago');
    expect(formatTimeAgo('2026-05-18T13:00:00Z')).toBe('23h ago');
  });

  it('returns "Xd ago" for sub-month ages', () => {
    expect(formatTimeAgo('2026-05-18T12:00:00Z')).toBe('1d ago');
    expect(formatTimeAgo('2026-05-09T12:00:00Z')).toBe('10d ago');
  });

  it('returns "Xmo ago" for month+ ages', () => {
    expect(formatTimeAgo('2026-04-09T12:00:00Z')).toMatch(/1mo ago/);
    expect(formatTimeAgo('2025-11-19T12:00:00Z')).toMatch(/6mo ago/);
  });

  it('returns "unknown" for invalid date strings', () => {
    expect(formatTimeAgo('not-a-date')).toBe('unknown');
    expect(formatTimeAgo('')).toBe('unknown');
  });
});
