import { describe, it, expect } from 'vitest';
import { classifyAssetClass } from '../asset-class';

describe('classifyAssetClass', () => {
  it('defaults unknown symbols to crypto', () => {
    expect(classifyAssetClass('BTC')).toBe('crypto');
    expect(classifyAssetClass('ETH')).toBe('crypto');
    expect(classifyAssetClass('SOL')).toBe('crypto');
    expect(classifyAssetClass('PEPE')).toBe('crypto');
    expect(classifyAssetClass('ALLO')).toBe('crypto'); // real microcap gainer
  });

  it('tags bare tokenized equities as stocks', () => {
    expect(classifyAssetClass('AAPL')).toBe('stocks');
    expect(classifyAssetClass('DELL')).toBe('stocks');
    expect(classifyAssetClass('TSLA')).toBe('stocks');
    expect(classifyAssetClass('NVDA')).toBe('stocks');
    expect(classifyAssetClass('COIN')).toBe('stocks');
    expect(classifyAssetClass('MSTR')).toBe('stocks');
  });

  it('tags the *STOCK suffix family as stocks', () => {
    expect(classifyAssetClass('AAPLSTOCK')).toBe('stocks');
    expect(classifyAssetClass('DELLSTOCK')).toBe('stocks');
    expect(classifyAssetClass('CSTOCK')).toBe('stocks');   // Citi
    expect(classifyAssetClass('BASTOCK')).toBe('stocks');  // Boeing
  });

  it('tags xStocks (…X) only when base is a ≥4-char known equity', () => {
    expect(classifyAssetClass('AAPLX')).toBe('stocks');
    expect(classifyAssetClass('TSLAX')).toBe('stocks');
    expect(classifyAssetClass('COINX')).toBe('stocks');
    expect(classifyAssetClass('GOOGLX')).toBe('stocks');
    expect(classifyAssetClass('MSTRX')).toBe('stocks');
  });

  // The whole point of the guard rails — these MUST remain crypto.
  it('never misclassifies real coins that collide with equity names', () => {
    expect(classifyAssetClass('AVAX')).toBe('crypto');  // ends in X, AVA not equity
    expect(classifyAssetClass('DYDX')).toBe('crypto');
    expect(classifyAssetClass('FLUX')).toBe('crypto');
    expect(classifyAssetClass('FRAX')).toBe('crypto');
    expect(classifyAssetClass('GMX')).toBe('crypto');   // GM+X but base <4
    expect(classifyAssetClass('MUX')).toBe('crypto');   // MU+X but base <4
    expect(classifyAssetClass('VRTX')).toBe('crypto');  // VRT+X but base <4
    expect(classifyAssetClass('QNT')).toBe('crypto');   // Quant — scrubbed from equity set
    expect(classifyAssetClass('QNTX')).toBe('crypto');
    expect(classifyAssetClass('T')).toBe('crypto');     // Threshold — scrubbed
    expect(classifyAssetClass('CAT')).toBe('crypto');   // meme cats — scrubbed
    expect(classifyAssetClass('XAUT')).toBe('crypto');  // Tether Gold, not bare XAU
    expect(classifyAssetClass('PAXG')).toBe('crypto');  // Pax Gold
  });

  it('tags FX pairs and bare metals', () => {
    expect(classifyAssetClass('EURUSD')).toBe('forex');
    expect(classifyAssetClass('GBPUSD')).toBe('forex');
    expect(classifyAssetClass('USDJPY')).toBe('forex');
    expect(classifyAssetClass('XAU')).toBe('commodities');
    expect(classifyAssetClass('XAG')).toBe('commodities');
  });

  it('is case-insensitive and null-safe', () => {
    expect(classifyAssetClass('aapl')).toBe('stocks');
    expect(classifyAssetClass('btc')).toBe('crypto');
    expect(classifyAssetClass('')).toBe('crypto');
    expect(classifyAssetClass(null)).toBe('crypto');
    expect(classifyAssetClass(undefined)).toBe('crypto');
  });
});
