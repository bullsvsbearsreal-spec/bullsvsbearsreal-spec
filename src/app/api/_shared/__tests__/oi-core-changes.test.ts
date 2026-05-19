import { describe, it, expect, beforeEach, vi } from 'vitest';

// oi-core has module-level singletons (l1Cache + oiSnapshots). Use
// vi.resetModules() between tests so each starts fresh.

describe('getOIChanges — module-level state shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns empty changes + snapshotCount=0 when no cache is populated', async () => {
    const { getOIChanges } = await import('../oi-core');
    const { changes, snapshotCount } = getOIChanges();
    expect(changes.size).toBe(0);
    expect(snapshotCount).toBe(0);
  });

  it('returns a Map (not a plain object) for changes', async () => {
    const { getOIChanges } = await import('../oi-core');
    const { changes } = getOIChanges();
    expect(changes).toBeInstanceOf(Map);
  });

  it('snapshotCount field is a non-negative integer', async () => {
    const { getOIChanges } = await import('../oi-core');
    const { snapshotCount } = getOIChanges();
    expect(typeof snapshotCount).toBe('number');
    expect(Number.isInteger(snapshotCount)).toBe(true);
    expect(snapshotCount).toBeGreaterThanOrEqual(0);
  });
});
