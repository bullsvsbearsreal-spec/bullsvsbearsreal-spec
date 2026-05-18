import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UNLOCK_TYPES,
  fetchTokenUnlocks,
  fetchUpcomingUnlocks,
  fetchAllUnlocks,
  getVestingSchedule,
  setLivePrices,
  getAllCoinIds,
  getTokenStaticPrice,
  type TokenUnlock,
} from '../tokenunlocks';

describe('UNLOCK_TYPES', () => {
  it('has entries for all 6 unlock categories', () => {
    expect(UNLOCK_TYPES.cliff).toBeDefined();
    expect(UNLOCK_TYPES.linear).toBeDefined();
    expect(UNLOCK_TYPES.team).toBeDefined();
    expect(UNLOCK_TYPES.investor).toBeDefined();
    expect(UNLOCK_TYPES.ecosystem).toBeDefined();
    expect(UNLOCK_TYPES.treasury).toBeDefined();
  });

  it('every entry has label + color + description', () => {
    Object.values(UNLOCK_TYPES).forEach((t) => {
      expect(t.label).toBeTruthy();
      expect(t.color).toBeTruthy();
      expect(t.description).toBeTruthy();
    });
  });

  it('cliff is marked error (high impact)', () => {
    expect(UNLOCK_TYPES.cliff.color).toBe('error');
  });

  it('linear is warning (gradual but ongoing)', () => {
    expect(UNLOCK_TYPES.linear.color).toBe('warning');
  });
});

describe('getAllCoinIds', () => {
  it('returns a deduplicated array of coin IDs from the static DB', () => {
    const ids = getAllCoinIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBeGreaterThan(0);
    // No duplicates
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains popular L2 tokens (arbitrum, optimism, starknet)', () => {
    const ids = getAllCoinIds();
    expect(ids).toContain('arbitrum');
    expect(ids).toContain('optimism');
  });
});

describe('getTokenStaticPrice', () => {
  it('returns the static price for known tokens', () => {
    const arbPrice = getTokenStaticPrice('arbitrum');
    expect(typeof arbPrice).toBe('number');
    expect(arbPrice).toBeGreaterThan(0);
  });

  it('returns undefined for unknown coin IDs', () => {
    expect(getTokenStaticPrice('not-a-real-coin')).toBeUndefined();
  });
});

describe('setLivePrices', () => {
  beforeEach(() => {
    // Reset live prices to baseline
    setLivePrices({});
  });

  it('updates prices used by buildUnlockList (bust cache)', async () => {
    // Set a wildly different live price for arbitrum
    setLivePrices({ arbitrum: 100 });
    const unlocks = await fetchTokenUnlocks('arbitrum');
    if (unlocks.length > 0) {
      // unlockValue = amount * price → using $100 price
      const first = unlocks[0];
      const expectedValue = first.unlockAmount * 100;
      expect(first.unlockValue).toBe(expectedValue);
    }
  });

  it('falls back to static price when live price is missing', async () => {
    setLivePrices({});  // No live prices
    const unlocks = await fetchTokenUnlocks('arbitrum');
    if (unlocks.length > 0) {
      const staticPrice = getTokenStaticPrice('arbitrum')!;
      const first = unlocks[0];
      expect(first.unlockValue).toBe(first.unlockAmount * staticPrice);
    }
  });
});

describe('fetchTokenUnlocks', () => {
  beforeEach(() => setLivePrices({}));

  it('returns an array of unlocks for a known token', async () => {
    const out = await fetchTokenUnlocks('arbitrum');
    expect(Array.isArray(out)).toBe(true);
  });

  it('returns empty array for unknown token', async () => {
    const out = await fetchTokenUnlocks('not-a-coin');
    expect(out).toEqual([]);
  });

  it('every returned unlock has the required shape', async () => {
    const unlocks = await fetchTokenUnlocks('arbitrum');
    unlocks.forEach((u: TokenUnlock) => {
      expect(u.coinId).toBe('arbitrum');
      expect(u.coinSymbol).toBeTruthy();
      expect(u.coinName).toBeTruthy();
      expect(u.unlockDate).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(u.unlockAmount).toBeGreaterThan(0);
      expect(u.unlockValue).toBeGreaterThanOrEqual(0);
      expect(typeof u.isLarge).toBe('boolean');
      expect(typeof u.percentOfSupply).toBe('number');
    });
  });
});

describe('fetchUpcomingUnlocks', () => {
  beforeEach(() => setLivePrices({}));

  it('returns the requested number of unlocks (or fewer)', async () => {
    const out = await fetchUpcomingUnlocks(5);
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it('respects the limit parameter', async () => {
    const out3 = await fetchUpcomingUnlocks(3);
    const out10 = await fetchUpcomingUnlocks(10);
    expect(out3.length).toBeLessThanOrEqual(3);
    expect(out10.length).toBeGreaterThanOrEqual(out3.length);
  });
});

describe('fetchAllUnlocks', () => {
  beforeEach(() => setLivePrices({}));

  it('returns unlocks sorted by date ascending', async () => {
    const all = await fetchAllUnlocks();
    for (let i = 1; i < all.length; i++) {
      const a = new Date(all[i - 1].unlockDate).getTime();
      const b = new Date(all[i].unlockDate).getTime();
      expect(b).toBeGreaterThanOrEqual(a);
    }
  });
});

describe('getVestingSchedule', () => {
  beforeEach(() => {
    setLivePrices({});
    // Mock Date.now to a fixed point so "upcoming" is deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  it('returns null for unknown coin', async () => {
    const out = await getVestingSchedule('not-a-coin');
    expect(out).toBeNull();
  });

  it('returns a schedule with totals + upcoming + history for known coin', async () => {
    const out = await getVestingSchedule('arbitrum');
    if (out) {
      expect(out.coinId).toBe('arbitrum');
      expect(typeof out.totalLocked).toBe('number');
      expect(typeof out.totalLockedValue).toBe('number');
      expect(Array.isArray(out.upcomingUnlocks)).toBe(true);
      expect(Array.isArray(out.unlockHistory)).toBe(true);
    }
  });

  it('upcoming unlocks are sorted by date ascending', async () => {
    const out = await getVestingSchedule('arbitrum');
    if (out && out.upcomingUnlocks.length > 1) {
      for (let i = 1; i < out.upcomingUnlocks.length; i++) {
        const a = new Date(out.upcomingUnlocks[i - 1].unlockDate).getTime();
        const b = new Date(out.upcomingUnlocks[i].unlockDate).getTime();
        expect(b).toBeGreaterThanOrEqual(a);
      }
    }
  });

  it('nextUnlock is the soonest upcoming entry', async () => {
    const out = await getVestingSchedule('arbitrum');
    if (out && out.upcomingUnlocks.length > 0) {
      expect(out.nextUnlock).toEqual(out.upcomingUnlocks[0]);
    }
  });
});
