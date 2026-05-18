import { describe, it, expect } from 'vitest';
import { isRestakingPool } from '../restaking';

describe('isRestakingPool', () => {
  it('returns true for projects on the allowlist (case-insensitive)', () => {
    expect(isRestakingPool({ project: 'eigenlayer' })).toBe(true);
    expect(isRestakingPool({ project: 'EigenLayer' })).toBe(true);
    expect(isRestakingPool({ project: 'EIGENLAYER' })).toBe(true);
  });

  it('returns true for LRT issuers: renzo, kelp, puffer, ether.fi', () => {
    expect(isRestakingPool({ project: 'renzo' })).toBe(true);
    expect(isRestakingPool({ project: 'kelp' })).toBe(true);
    expect(isRestakingPool({ project: 'puffer' })).toBe(true);
    expect(isRestakingPool({ project: 'ether.fi-liquid' })).toBe(true);
  });

  it('returns true for symbiotic, karak, babylon (multi-asset restaking)', () => {
    expect(isRestakingPool({ project: 'symbiotic' })).toBe(true);
    expect(isRestakingPool({ project: 'karak' })).toBe(true);
    expect(isRestakingPool({ project: 'babylon' })).toBe(true);
  });

  it('returns true when category is "Liquid Restaking" even if project is unknown', () => {
    expect(isRestakingPool({ project: 'newcomer-protocol', category: 'Liquid Restaking' })).toBe(true);
    // Case-insensitive
    expect(isRestakingPool({ project: 'foo', category: 'LIQUID RESTAKING' })).toBe(true);
  });

  it('returns FALSE for "Liquid Staking" category (vanilla, not restaking)', () => {
    // This is the critical distinction the comments call out — Lido /
    // Rocket Pool / Coinbase staked ETH are Liquid Staking, NOT Liquid
    // Restaking. They should not appear on /staking?tab=restaking.
    expect(isRestakingPool({ project: 'lido', category: 'Liquid Staking' })).toBe(false);
    expect(isRestakingPool({ project: 'rocket-pool', category: 'Liquid Staking' })).toBe(false);
  });

  it('returns false for AMMs / lenders that just hold LRT collateral', () => {
    // Excluding these is the whole point — LP yield is not restaking.
    expect(isRestakingPool({ project: 'aave-v3', category: 'Lending' })).toBe(false);
    expect(isRestakingPool({ project: 'curve-dex', category: 'Dexes' })).toBe(false);
    expect(isRestakingPool({ project: 'uniswap-v3', category: 'Dexes' })).toBe(false);
  });

  it('returns false for missing project + missing category (defensive)', () => {
    expect(isRestakingPool({})).toBe(false);
    expect(isRestakingPool({ project: undefined, category: undefined })).toBe(false);
    expect(isRestakingPool({ project: null })).toBe(false);
  });

  it('returns false for empty-string project + empty-string category', () => {
    expect(isRestakingPool({ project: '', category: '' })).toBe(false);
  });

  it('handles project + category both being non-strings gracefully', () => {
    // Defensive: in case DeFiLlama ever returns weird shapes
    expect(isRestakingPool({ project: 123, category: 456 })).toBe(false);
  });
});
