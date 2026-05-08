/**
 * Tests for isRestakingPool — the issuer-allowlist filter that drives
 * /restaking and /restaking-delta yields.
 *
 * Earlier this used a heuristic where any pool with an LRT-like symbol
 * prefix (EZ/RS/WE/...) counted as restaking, which swept up 2870
 * Uniswap/Balancer/Aerodrome/Sushi/Morpho LP pools whose paired token
 * happened to be an LRT — 90% irrelevant. The fix (commit 10ab937e
 * earlier this session) restricted to a strict issuer allowlist.
 *
 * A regression here would either:
 *   - re-flood the page with thousands of LP pools (the original bug)
 *   - drop a real protocol the page should show
 */
import { describe, it, expect } from 'vitest';
import { isRestakingPool } from '../restaking';

describe('isRestakingPool — issuer-allowlist matches', () => {
  it('accepts EigenLayer pools', () => {
    expect(isRestakingPool({ project: 'eigenlayer' })).toBe(true);
    expect(isRestakingPool({ project: 'eigenlayer-lst' })).toBe(true);
    expect(isRestakingPool({ project: 'EigenLayer' })).toBe(true); // case-insensitive
  });

  it('accepts Symbiotic, Karak, Babylon (other major issuers)', () => {
    expect(isRestakingPool({ project: 'symbiotic' })).toBe(true);
    expect(isRestakingPool({ project: 'karak' })).toBe(true);
    expect(isRestakingPool({ project: 'babylon' })).toBe(true);
  });

  it('accepts the LRT issuers: Renzo, EtherFi, Kelp, Puffer, Swell', () => {
    expect(isRestakingPool({ project: 'renzo' })).toBe(true);
    expect(isRestakingPool({ project: 'etherfi' })).toBe(true);
    expect(isRestakingPool({ project: 'kelp' })).toBe(true);
    expect(isRestakingPool({ project: 'puffer' })).toBe(true);
    expect(isRestakingPool({ project: 'puffer-finance' })).toBe(true);
    expect(isRestakingPool({ project: 'swell' })).toBe(true);
  });

  it('accepts EtherFi DefiLlama slug variants (hyphen-separated)', () => {
    // DefiLlama uses hyphens, not spaces. Verified against the live
    // /pools snapshot May 2026.
    expect(isRestakingPool({ project: 'ether.fi-stake' })).toBe(true);
    expect(isRestakingPool({ project: 'ether.fi-liquid' })).toBe(true);
    expect(isRestakingPool({ project: 'ether.fi liquid restaking' })).toBe(true);
  });

  it('accepts Swell DefiLlama slug variants', () => {
    expect(isRestakingPool({ project: 'swell-earn' })).toBe(true);
    expect(isRestakingPool({ project: 'swell-liquid-restaking' })).toBe(true);
    expect(isRestakingPool({ project: 'swell-liquid-staking' })).toBe(true);
  });

  it('accepts Puffer slug variants', () => {
    expect(isRestakingPool({ project: 'puffer-stake' })).toBe(true);
  });

  it('accepts other allowlisted protocols (SSV, Rio, Mellow, Bedrock)', () => {
    expect(isRestakingPool({ project: 'ssvnetwork' })).toBe(true);
    expect(isRestakingPool({ project: 'rio-network' })).toBe(true);
    expect(isRestakingPool({ project: 'mellow' })).toBe(true);
    expect(isRestakingPool({ project: 'mellow-protocol' })).toBe(true);
    expect(isRestakingPool({ project: 'bedrock' })).toBe(true);
    expect(isRestakingPool({ project: 'bedrock-unieth' })).toBe(true);
    expect(isRestakingPool({ project: 'eigenpie' })).toBe(true);
  });

  it('does NOT accept fluid-* slugs (Fluid is a DEX + lending, not restaking)', () => {
    // Fluid was incorrectly in the allowlist; fluid-dex / fluid-lending
    // / fluid-lite would have leaked lending pools onto /restaking.
    expect(isRestakingPool({ project: 'fluid-dex' })).toBe(false);
    expect(isRestakingPool({ project: 'fluid-lending' })).toBe(false);
    expect(isRestakingPool({ project: 'fluid-lite' })).toBe(false);
  });
});

describe('isRestakingPool — DefiLlama category fallback', () => {
  it('accepts pools with category "liquid restaking" (case-insensitive)', () => {
    expect(isRestakingPool({ project: 'unknown', category: 'Liquid Restaking' })).toBe(true);
    expect(isRestakingPool({ project: 'whatever', category: 'liquid restaking' })).toBe(true);
    expect(isRestakingPool({ project: 'foo', category: 'LIQUID RESTAKING' })).toBe(true);
  });

  it('does NOT accept "Liquid Staking" (vanilla, not re-staked)', () => {
    // CRITICAL: Lido stETH is "Liquid Staking" not "Liquid Restaking".
    // Letting these in would dilute the page with vanilla ETH staking.
    expect(isRestakingPool({ project: 'lido', category: 'Liquid Staking' })).toBe(false);
    expect(isRestakingPool({ project: 'rocketpool', category: 'Liquid Staking' })).toBe(false);
  });

  it('does NOT accept partial matches (must be exact "liquid restaking")', () => {
    expect(isRestakingPool({ project: 'foo', category: 'Yield' })).toBe(false);
    expect(isRestakingPool({ project: 'foo', category: 'Restaking' })).toBe(false);
    expect(isRestakingPool({ project: 'foo', category: 'LST' })).toBe(false);
  });
});

describe('isRestakingPool — rejection (the original 2870-pool bug)', () => {
  it('rejects Uniswap V2/V3/V4 LP pools even with LRT collateral', () => {
    expect(isRestakingPool({ project: 'uniswap-v2', symbol: 'EZETH-WETH' })).toBe(false);
    expect(isRestakingPool({ project: 'uniswap-v3', symbol: 'WEETH-USDC' })).toBe(false);
    expect(isRestakingPool({ project: 'uniswap-v4', symbol: 'RSETH-WETH' })).toBe(false);
  });

  it('rejects Balancer / Aerodrome / Sushi / Morpho LP pools', () => {
    expect(isRestakingPool({ project: 'balancer-v2', symbol: 'EZETH-WSTETH' })).toBe(false);
    expect(isRestakingPool({ project: 'aerodrome', symbol: 'WEETH-WETH' })).toBe(false);
    expect(isRestakingPool({ project: 'sushi', symbol: 'RSETH-USDC' })).toBe(false);
    expect(isRestakingPool({ project: 'morpho-blue', symbol: 'EZETH-USDT' })).toBe(false);
  });

  it('rejects general lending / stablecoin protocols', () => {
    expect(isRestakingPool({ project: 'aave-v3', category: 'Lending' })).toBe(false);
    expect(isRestakingPool({ project: 'compound-v3', category: 'Lending' })).toBe(false);
    expect(isRestakingPool({ project: 'curve-dex', category: 'Dexes' })).toBe(false);
  });

  it('rejects pools with no project field', () => {
    expect(isRestakingPool({})).toBe(false);
    expect(isRestakingPool({ symbol: 'BTC' })).toBe(false);
  });

  it('rejects pools with null/undefined project', () => {
    expect(isRestakingPool({ project: null })).toBe(false);
    expect(isRestakingPool({ project: undefined })).toBe(false);
    expect(isRestakingPool({ project: '' })).toBe(false);
  });
});
