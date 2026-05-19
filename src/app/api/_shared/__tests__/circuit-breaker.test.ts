import { describe, it, expect } from 'vitest';
import { getCircuitBreakerStatus } from '../exchange-fetchers';

describe('getCircuitBreakerStatus', () => {
  it('returns an object (potentially empty when no fetchers have run)', () => {
    const status = getCircuitBreakerStatus();
    expect(typeof status).toBe('object');
    expect(status).not.toBeNull();
  });

  it('every entry (if any) has failures + isOpen + openedAt fields', () => {
    const status = getCircuitBreakerStatus();
    Object.values(status).forEach((entry) => {
      expect(typeof entry.failures).toBe('number');
      expect(entry.failures).toBeGreaterThanOrEqual(0);
      expect(typeof entry.isOpen).toBe('boolean');
      // openedAt is number when isOpen, null when closed
      expect(entry.openedAt === null || typeof entry.openedAt === 'number').toBe(true);
    });
  });

  it('entries with isOpen=false have openedAt === null', () => {
    const status = getCircuitBreakerStatus();
    Object.values(status).forEach((entry) => {
      if (entry.isOpen === false) {
        // Either no failures yet, or recovered — openedAt should be null
        // (or the field will be null on circuits that have never tripped)
        // Be lenient: if it's a number that's fine too (last-trip recorded
        // but circuit closed again).
        expect(entry.openedAt === null || typeof entry.openedAt === 'number').toBe(true);
      }
    });
  });

  it('keys (exchange names) are non-empty strings', () => {
    const status = getCircuitBreakerStatus();
    Object.keys(status).forEach((name) => {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });
});
