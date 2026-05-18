import { describe, it, expect } from 'vitest';
import { ASSET_FROM_SYMBOL } from '../validators-data';

describe('ASSET_FROM_SYMBOL', () => {
  it('classifies vanilla ETH', () => {
    expect(ASSET_FROM_SYMBOL('ETH')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('eth')).toBe('ETH');
  });

  it('classifies WETH as ETH', () => {
    expect(ASSET_FROM_SYMBOL('WETH')).toBe('ETH');
  });

  it('classifies LSTs as ETH (stETH, rETH, cbETH, wstETH)', () => {
    expect(ASSET_FROM_SYMBOL('stETH')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('STETH')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('rETH')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('cbETH')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('wstETH')).toBe('ETH');
  });

  it('classifies any *ETH suffix as ETH', () => {
    expect(ASSET_FROM_SYMBOL('weETH')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('osETH')).toBe('ETH');
    expect(ASSET_FROM_SYMBOL('SFRXETH')).toBe('ETH');
  });

  it('classifies vanilla SOL', () => {
    expect(ASSET_FROM_SYMBOL('SOL')).toBe('SOL');
  });

  it('classifies Solana LSTs (jitoSOL, mSOL, bSOL, jSOL)', () => {
    expect(ASSET_FROM_SYMBOL('jitoSOL')).toBe('SOL');
    expect(ASSET_FROM_SYMBOL('mSOL')).toBe('SOL');
    expect(ASSET_FROM_SYMBOL('bSOL')).toBe('SOL');
    expect(ASSET_FROM_SYMBOL('jSOL')).toBe('SOL');
  });

  it('classifies any *SOL suffix as SOL', () => {
    expect(ASSET_FROM_SYMBOL('xSOL')).toBe('SOL');
  });

  it('classifies BTC variants', () => {
    expect(ASSET_FROM_SYMBOL('BTC')).toBe('BTC');
    expect(ASSET_FROM_SYMBOL('WBTC')).toBe('BTC');
    expect(ASSET_FROM_SYMBOL('UNIBTC')).toBe('BTC');
    expect(ASSET_FROM_SYMBOL('cbBTC')).toBe('BTC');
  });

  it('classifies Polygon (MATIC + POL after rebrand)', () => {
    expect(ASSET_FROM_SYMBOL('MATIC')).toBe('POL');
    expect(ASSET_FROM_SYMBOL('POL')).toBe('POL');
  });

  it('classifies AVAX, ATOM, NEAR', () => {
    expect(ASSET_FROM_SYMBOL('AVAX')).toBe('AVAX');
    expect(ASSET_FROM_SYMBOL('sAVAX')).toBe('AVAX');
    expect(ASSET_FROM_SYMBOL('ATOM')).toBe('ATOM');
    expect(ASSET_FROM_SYMBOL('NEAR')).toBe('NEAR');
  });

  it('returns OTHER for unrecognized symbols', () => {
    expect(ASSET_FROM_SYMBOL('XYZ')).toBe('OTHER');
    expect(ASSET_FROM_SYMBOL('DOGE')).toBe('OTHER');
    expect(ASSET_FROM_SYMBOL('FOO')).toBe('OTHER');
  });

  it('handles empty input as OTHER', () => {
    expect(ASSET_FROM_SYMBOL('')).toBe('OTHER');
  });

  it('is case-insensitive', () => {
    expect(ASSET_FROM_SYMBOL('eth')).toBe(ASSET_FROM_SYMBOL('ETH'));
    expect(ASSET_FROM_SYMBOL('wbtc')).toBe(ASSET_FROM_SYMBOL('WBTC'));
    expect(ASSET_FROM_SYMBOL('msol')).toBe(ASSET_FROM_SYMBOL('MSOL'));
  });
});
