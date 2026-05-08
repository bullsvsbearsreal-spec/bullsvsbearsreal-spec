/**
 * Tests for pipClass + deltaBadgeClass — used everywhere a percentage
 * delta is rendered in the UI (funding heatmap cells, OI delta column,
 * ticker tape, etc). A regression here would silently turn the entire
 * site's color-coding wrong (greens become reds, neutral disappears).
 */
import { describe, it, expect } from 'vitest';
import { pipClass, deltaBadgeClass } from '../pip';

describe('pipClass', () => {
  it('returns pip-up for positive numbers', () => {
    expect(pipClass(0.1)).toBe('pip-up');
    expect(pipClass(100)).toBe('pip-up');
    expect(pipClass(0.0001)).toBe('pip-up');
  });

  it('returns pip-down for negative numbers', () => {
    expect(pipClass(-0.1)).toBe('pip-down');
    expect(pipClass(-100)).toBe('pip-down');
    expect(pipClass(-0.0001)).toBe('pip-down');
  });

  it('returns pip-neutral for zero', () => {
    expect(pipClass(0)).toBe('pip-neutral');
    expect(pipClass(-0)).toBe('pip-neutral'); // -0 === 0 in JS
  });

  it('returns pip-neutral for null and undefined', () => {
    expect(pipClass(null)).toBe('pip-neutral');
    expect(pipClass(undefined)).toBe('pip-neutral');
  });
});

describe('deltaBadgeClass', () => {
  it('returns empty string when value is null', () => {
    expect(deltaBadgeClass(null)).toBe('');
    expect(deltaBadgeClass(undefined)).toBe('');
  });

  it('classes positive small move as delta-badge-up + pip-up', () => {
    const c = deltaBadgeClass(2);
    expect(c).toContain('delta-badge-up');
    expect(c).not.toContain('extreme');
    expect(c).toContain('pip-up');
  });

  it('classes negative small move as delta-badge-down + pip-down', () => {
    const c = deltaBadgeClass(-3);
    expect(c).toContain('delta-badge-down');
    expect(c).not.toContain('extreme');
    expect(c).toContain('pip-down');
  });

  it('classes zero as neutral pip but down badge (>=0 is up)', () => {
    // Implementation: direction = value >= 0 ? 'up' : 'down', so 0 → up
    // pip = value === 0 → pip-neutral
    const c = deltaBadgeClass(0);
    expect(c).toContain('delta-badge-up');
    expect(c).toContain('pip-neutral');
  });

  it('classes >= +15 as extreme-up', () => {
    expect(deltaBadgeClass(15)).toContain('delta-badge-extreme-up');
    expect(deltaBadgeClass(50)).toContain('delta-badge-extreme-up');
  });

  it('classes <= -15 as extreme-down', () => {
    expect(deltaBadgeClass(-15)).toContain('delta-badge-extreme-down');
    expect(deltaBadgeClass(-99)).toContain('delta-badge-extreme-down');
  });

  it('respects custom extreme threshold', () => {
    expect(deltaBadgeClass(10, 5)).toContain('extreme-up');
    expect(deltaBadgeClass(10, 20)).not.toContain('extreme');
  });

  it('always starts with the base delta-badge class', () => {
    expect(deltaBadgeClass(1).split(' ')[0]).toBe('delta-badge');
    expect(deltaBadgeClass(-1).split(' ')[0]).toBe('delta-badge');
    expect(deltaBadgeClass(50).split(' ')[0]).toBe('delta-badge');
  });
});
