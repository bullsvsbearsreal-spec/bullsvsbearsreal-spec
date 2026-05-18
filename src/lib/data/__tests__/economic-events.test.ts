import { describe, it, expect } from 'vitest';
import {
  ECONOMIC_EVENTS,
  EVENT_CATEGORIES,
  IMPACT_COLORS,
  type EconomicEvent,
} from '../economic-events';

describe('ECONOMIC_EVENTS', () => {
  it('is non-empty', () => {
    expect(ECONOMIC_EVENTS.length).toBeGreaterThan(0);
  });

  it('every event has all required fields', () => {
    ECONOMIC_EVENTS.forEach((e) => {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(e.date).toBeTruthy();
      expect(e.impact).toBeTruthy();
      expect(e.category).toBeTruthy();
      expect(e.country).toBeTruthy();
    });
  });

  it('every date is ISO-formatted (YYYY-MM-DD)', () => {
    ECONOMIC_EVENTS.forEach((e) => {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Ensure it parses to a real date
      expect(Number.isNaN(new Date(e.date).getTime())).toBe(false);
    });
  });

  it('event IDs are unique', () => {
    const ids = ECONOMIC_EVENTS.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every impact is one of high/medium/low', () => {
    const valid = new Set(['high', 'medium', 'low']);
    ECONOMIC_EVENTS.forEach((e) => {
      expect(valid.has(e.impact)).toBe(true);
    });
  });

  it('every category is one of 6 known categories', () => {
    const valid = new Set(['monetary', 'employment', 'inflation', 'growth', 'crypto', 'other']);
    ECONOMIC_EVENTS.forEach((e) => {
      expect(valid.has(e.category)).toBe(true);
    });
  });

  it('contains the 2026 FOMC schedule (8 high-impact monetary events)', () => {
    const fomc2026 = ECONOMIC_EVENTS.filter((e) =>
      e.id.startsWith('fomc-2026') && e.impact === 'high' && e.category === 'monetary',
    );
    // Federal Reserve has 8 FOMC meetings per year
    expect(fomc2026.length).toBe(8);
  });

  it('every FOMC entry has time = 14:00 ET (Fed convention)', () => {
    const fomc = ECONOMIC_EVENTS.filter((e) => e.id.startsWith('fomc-'));
    fomc.forEach((e) => {
      expect(e.time).toBe('14:00 ET');
    });
  });

  it('country codes look reasonable (mostly short uppercase)', () => {
    ECONOMIC_EVENTS.forEach((e) => {
      // Allow "US", "EU", "Global", "UK", etc.
      expect(e.country.length).toBeGreaterThan(0);
      expect(e.country.length).toBeLessThan(20);
    });
  });

  it('high-impact events are present (e.g. CPI / NFP / FOMC)', () => {
    const highImpact = ECONOMIC_EVENTS.filter((e) => e.impact === 'high');
    expect(highImpact.length).toBeGreaterThan(0);
  });
});

describe('EVENT_CATEGORIES', () => {
  it('has entries for all 6 categories', () => {
    expect(EVENT_CATEGORIES.monetary).toBeDefined();
    expect(EVENT_CATEGORIES.employment).toBeDefined();
    expect(EVENT_CATEGORIES.inflation).toBeDefined();
    expect(EVENT_CATEGORIES.growth).toBeDefined();
    expect(EVENT_CATEGORIES.crypto).toBeDefined();
    expect(EVENT_CATEGORIES.other).toBeDefined();
  });

  it('every category has a label and a valid hex color', () => {
    Object.values(EVENT_CATEGORIES).forEach((cat) => {
      expect(cat.label).toBeTruthy();
      expect(cat.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('colors are unique across categories (no accidental dupes in legend)', () => {
    const colors = Object.values(EVENT_CATEGORIES).map((c) => c.color);
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });
});

describe('IMPACT_COLORS', () => {
  it('has entries for all 3 impact levels', () => {
    expect(IMPACT_COLORS.high).toBeDefined();
    expect(IMPACT_COLORS.medium).toBeDefined();
    expect(IMPACT_COLORS.low).toBeDefined();
  });

  it('every color is a valid hex', () => {
    Object.values(IMPACT_COLORS).forEach((c) => {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('high is red-ish (impact priority signal)', () => {
    // Red shade — start with #ef which the source uses
    expect(IMPACT_COLORS.high.toLowerCase()).toBe('#ef4444');
  });
});
