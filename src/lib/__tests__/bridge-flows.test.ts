import { describe, it, expect } from 'vitest';
import { chainName, WORMHOLE_CHAINS } from '../bridge-flows';

describe('chainName', () => {
  it('returns the canonical name for known chain IDs', () => {
    // Sanity-check a few well-known ones — actual id ↔ name pairs
    // come from the lib's WORMHOLE_CHAINS map
    const allIds = Object.keys(WORMHOLE_CHAINS).map(Number);
    for (const id of allIds) {
      const name = chainName(id);
      expect(name).toBe(WORMHOLE_CHAINS[id]);
      // Names should be human-readable, not just numbers
      expect(name).not.toMatch(/^Chain /);
    }
  });

  it('returns "Chain N" for unknown ids (graceful fallback)', () => {
    expect(chainName(999_999)).toBe('Chain 999999');
    expect(chainName(-1)).toBe('Chain -1');
  });

  it('handles id=0 specifically (often used as null sentinel)', () => {
    // If 0 is in the map, return its name; otherwise the fallback
    const name = chainName(0);
    if (0 in WORMHOLE_CHAINS) {
      expect(name).toBe(WORMHOLE_CHAINS[0]);
    } else {
      expect(name).toBe('Chain 0');
    }
  });

  it('has at least 10 chains registered (sanity check on the map)', () => {
    expect(Object.keys(WORMHOLE_CHAINS).length).toBeGreaterThan(10);
  });

  it('includes the major chains we care about', () => {
    const names = new Set(Object.values(WORMHOLE_CHAINS));
    // We've explicitly added these — break-glass if a name renames
    expect(names.has('Ethereum')).toBe(true);
    expect(names.has('Solana')).toBe(true);
  });

  it('all map values are non-empty strings', () => {
    for (const [, name] of Object.entries(WORMHOLE_CHAINS)) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
