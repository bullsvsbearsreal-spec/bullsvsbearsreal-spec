/**
 * Tests for ASSET_FROM_SYMBOL — the bucket-by-underlying classifier the
 * /validators page uses to group LSTs/LRTs into per-asset columns
 * (ETH / SOL / BTC / POL / AVAX / ATOM / NEAR / OTHER).
 *
 * A regression here splits the same asset across multiple columns
 * (e.g. WSTETH suddenly grouped under OTHER instead of ETH) or merges
 * unrelated assets. Both are silently wrong — the page still renders,
 * just with subtly broken groupings.
 */
import { describe, it, expect } from 'vitest';
import { ASSET_FROM_SYMBOL } from '../validators-data';

describe('ASSET_FROM_SYMBOL — ETH bucket', () => {
  it('groups major ETH LSTs under ETH', () => {
    expect(ASSET_FROM_SYMBOL('STETH')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('WSTETH')).toBe('ETH'); // most-staked ETH-LST
    expect(ASSET_FROM_SYMBOL('RETH')).toBe('ETH');   // Rocket Pool
    expect(ASSET_FROM_SYMBOL('CBETH')).toBe('ETH');  // Coinbase
    expect(ASSET_FROM_SYMBOL('WETH')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('ETH')).toBe('ETH');
  });

  it('groups LRT tokens under ETH (they all back ETH)', () => {
    expect(ASSET_FROM_SYMBOL('EZETH')).toBe('ETH');   // Renzo
    expect(ASSET_FROM_SYMBOL('WEETH')).toBe('ETH');   // EtherFi
    expect(ASSET_FROM_SYMBOL('RSETH')).toBe('ETH');   // Kelp
    expect(ASSET_FROM_SYMBOL('PUFETH')).toBe('ETH');  // Puffer
    expect(ASSET_FROM_SYMBOL('SWETH')).toBe('ETH');   // Swell
  });

  it('is case-insensitive', () => {
    expect(ASSET_FROM_SYMBOL('steth')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('Eth')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('wEth')).toBe('ETH');
  });
});

describe('ASSET_FROM_SYMBOL — SOL bucket', () => {
  it('groups Solana LSTs under SOL', () => {
    expect(ASSET_FROM_SYMBOL('JITOSOL')).toBe('SOL'); // Jito
    expect(ASSET_FROM_SYMBOL('MSOL')).toBe('SOL');    // Marinade
    expect(ASSET_FROM_SYMBOL('BSOL')).toBe('SOL');    // Blaze
    expect(ASSET_FROM_SYMBOL('JSOL')).toBe('SOL');    // JPool
    expect(ASSET_FROM_SYMBOL('SOL')).toBe('SOL');
  });

  it('groups any *SOL-suffixed LST under SOL', () => {
    // The endsWith('SOL') rule catches future LSTs we haven't enumerated.
    expect(ASSET_FROM_SYMBOL('CGNTSOL')).toBe('SOL');
    expect(ASSET_FROM_SYMBOL('LAINESOL')).toBe('SOL');
  });
});

describe('ASSET_FROM_SYMBOL — BTC bucket', () => {
  it('groups BTC wrappers under BTC', () => {
    expect(ASSET_FROM_SYMBOL('WBTC')).toBe('BTC');
    expect(ASSET_FROM_SYMBOL('CBBTC')).toBe('BTC');
    expect(ASSET_FROM_SYMBOL('TBTC')).toBe('BTC');
    expect(ASSET_FROM_SYMBOL('BTC')).toBe('BTC');
  });
});

describe('ASSET_FROM_SYMBOL — other chains', () => {
  it('classifies POL/MATIC variants', () => {
    expect(ASSET_FROM_SYMBOL('POL')).toBe('POL');
    expect(ASSET_FROM_SYMBOL('MATIC')).toBe('POL');   // Polygon's old ticker
    expect(ASSET_FROM_SYMBOL('STMATIC')).toBe('POL'); // staked MATIC
  });

  it('classifies AVAX', () => {
    expect(ASSET_FROM_SYMBOL('AVAX')).toBe('AVAX');
    expect(ASSET_FROM_SYMBOL('SAVAX')).toBe('AVAX'); // BENQI sAVAX
  });

  it('classifies ATOM', () => {
    expect(ASSET_FROM_SYMBOL('ATOM')).toBe('ATOM');
    expect(ASSET_FROM_SYMBOL('STATOM')).toBe('ATOM'); // Stride
  });

  it('classifies NEAR', () => {
    expect(ASSET_FROM_SYMBOL('NEAR')).toBe('NEAR');
    expect(ASSET_FROM_SYMBOL('STNEAR')).toBe('NEAR'); // Meta Pool
  });
});

describe('ASSET_FROM_SYMBOL — fallback', () => {
  it('returns OTHER for unrecognised symbols', () => {
    expect(ASSET_FROM_SYMBOL('UNKNOWNCOIN')).toBe('OTHER');
    expect(ASSET_FROM_SYMBOL('XYZ')).toBe('OTHER');
    expect(ASSET_FROM_SYMBOL('')).toBe('OTHER');
  });

  it('does not silently misclassify foreign tickers as ETH/BTC', () => {
    // Sanity guards: tickers that don't share a substring with our
    // anchors should NOT end up in ETH or BTC.
    expect(ASSET_FROM_SYMBOL('USDC')).toBe('OTHER');
    expect(ASSET_FROM_SYMBOL('USDT')).toBe('OTHER');
    expect(ASSET_FROM_SYMBOL('LINK')).toBe('OTHER');
    expect(ASSET_FROM_SYMBOL('DOGE')).toBe('OTHER');
  });
});

describe('ASSET_FROM_SYMBOL — ordering / specificity', () => {
  it('ETH/SOL checks win over later, less specific buckets', () => {
    // CBETH contains "ETH" which would also match endsWith('ETH').
    // The order should keep it firmly in ETH (not OTHER).
    expect(ASSET_FROM_SYMBOL('CBETH')).toBe('ETH');
    // JITOSOL contains both JITOSOL and SOL substrings — must end in SOL.
    expect(ASSET_FROM_SYMBOL('JITOSOL')).toBe('SOL');
  });
});
