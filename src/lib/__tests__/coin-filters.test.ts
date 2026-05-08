/**
 * Tests for coin-filters — used by altseason, outperformers, breakouts,
 * memecoin-radar to exclude stablecoins + BTC/ETH wrappers from
 * "alt outperformance" rankings. A regression that lets USDT or wBTC
 * through would put them at the top of altseason charts (because their
 * "outperformance vs BTC" is mathematically near-zero or near-perfect),
 * silently corrupting the page's signal.
 */
import { describe, it, expect } from 'vitest';
import {
  isExcludedFromAltLens,
  hasExcludedName,
  STABLE_SYMBOLS,
  BTC_PROXIES,
  ETH_PROXIES,
} from '../coin-filters';

describe('isExcludedFromAltLens — empty input', () => {
  it('treats null/undefined/empty as excluded (defensive)', () => {
    expect(isExcludedFromAltLens(null)).toBe(true);
    expect(isExcludedFromAltLens(undefined)).toBe(true);
    expect(isExcludedFromAltLens('')).toBe(true);
  });
});

describe('isExcludedFromAltLens — BTC + ETH themselves', () => {
  it('excludes BTC and ETH (the comparison anchors)', () => {
    expect(isExcludedFromAltLens('BTC')).toBe(true);
    expect(isExcludedFromAltLens('ETH')).toBe(true);
    expect(isExcludedFromAltLens('btc')).toBe(true);
    expect(isExcludedFromAltLens('eth')).toBe(true);
  });
});

describe('isExcludedFromAltLens — stablecoins', () => {
  it('excludes the major USD-pegged stablecoins', () => {
    for (const sym of ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'PYUSD', 'USDe', 'FDUSD']) {
      expect(isExcludedFromAltLens(sym)).toBe(true);
    }
  });

  it('excludes EUR-pegged + gold-pegged tokens', () => {
    expect(isExcludedFromAltLens('EURC')).toBe(true);
    expect(isExcludedFromAltLens('PAXG')).toBe(true);
    expect(isExcludedFromAltLens('XAUT')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isExcludedFromAltLens('UsDt')).toBe(true);
    expect(isExcludedFromAltLens('usdc')).toBe(true);
  });
});

describe('isExcludedFromAltLens — BTC + ETH wrappers', () => {
  it('excludes BTC wrappers (their PnL just mirrors BTC)', () => {
    for (const sym of ['WBTC', 'CBBTC', 'TBTC', 'HBTC', 'BTCB']) {
      expect(isExcludedFromAltLens(sym)).toBe(true);
    }
  });

  it('excludes ETH LSTs / wrappers (PnL mirrors ETH)', () => {
    for (const sym of ['STETH', 'WETH', 'CBETH', 'RETH', 'WSTETH', 'EETH']) {
      expect(isExcludedFromAltLens(sym)).toBe(true);
    }
  });
});

describe('isExcludedFromAltLens — legitimate altcoins pass through', () => {
  it('does NOT exclude real alts', () => {
    for (const sym of ['SOL', 'AVAX', 'DOGE', 'LINK', 'XRP', 'BNB', 'ADA', 'TRX', 'PEPE', 'WIF']) {
      expect(isExcludedFromAltLens(sym)).toBe(false);
    }
  });
});

describe('hasExcludedName — name-pattern exclusion', () => {
  it('returns false for empty/null name', () => {
    expect(hasExcludedName(null)).toBe(false);
    expect(hasExcludedName(undefined)).toBe(false);
    expect(hasExcludedName('')).toBe(false);
  });

  it('catches "Wrapped Bitcoin" name variants', () => {
    expect(hasExcludedName('Wrapped Bitcoin')).toBe(true);
    expect(hasExcludedName('wrapped bitcoin')).toBe(true);
    expect(hasExcludedName('TBTC Wrapped Bitcoin')).toBe(true);
  });

  it('catches "Wrapped Ether"', () => {
    expect(hasExcludedName('Wrapped Ether')).toBe(true);
    expect(hasExcludedName('wrapped ether')).toBe(true);
  });

  it('catches any "Liquid Staked X"', () => {
    expect(hasExcludedName('Liquid Staked Ether')).toBe(true);
    expect(hasExcludedName('liquid staked sol')).toBe(true);
    expect(hasExcludedName('Lido Liquid Staking')).toBe(true);
  });

  it('passes legitimate alt names through', () => {
    expect(hasExcludedName('Solana')).toBe(false);
    expect(hasExcludedName('Dogecoin')).toBe(false);
    expect(hasExcludedName('Avalanche')).toBe(false);
  });
});

describe('coin-filters — exported sets are non-empty', () => {
  // Catches a refactor that accidentally empties the sets — would let
  // every coin through and break altseason rankings.
  it('STABLE_SYMBOLS has > 20 entries', () => {
    expect(STABLE_SYMBOLS.size).toBeGreaterThan(20);
  });

  it('BTC_PROXIES contains the canonical wrapper', () => {
    expect(BTC_PROXIES.has('wbtc')).toBe(true);
  });

  it('ETH_PROXIES contains stETH', () => {
    expect(ETH_PROXIES.has('steth')).toBe(true);
  });
});
