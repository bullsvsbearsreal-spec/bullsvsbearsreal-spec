import { describe, it, expect } from 'vitest';
import {
  SYMBOLS,
  CEX_EXCHANGES,
  DEX_EXCHANGES,
  ALL_EXCHANGES,
  DEFAULT_SELECTED,
  getAssetClass,
  getCategoryForSymbol,
  getAllDefaultSymbols,
} from '../symbols';

describe('SYMBOLS', () => {
  it('contains the canonical crypto categories', () => {
    expect(SYMBOLS.Majors).toBeDefined();
    expect(SYMBOLS['Layer 2']).toBeDefined();
    expect(SYMBOLS.AI).toBeDefined();
    expect(SYMBOLS.DeFi).toBeDefined();
    expect(SYMBOLS.Memes).toBeDefined();
  });

  it('contains non-crypto categories (commodities, forex, stocks, indices)', () => {
    expect(SYMBOLS['Precious Metals']).toBeDefined();
    expect(SYMBOLS.Energy).toBeDefined();
    expect(SYMBOLS['Forex Majors']).toBeDefined();
    expect(SYMBOLS['Mega Cap Stocks']).toBeDefined();
    expect(SYMBOLS.Indices).toBeDefined();
  });

  it('every category has at least one symbol', () => {
    Object.values(SYMBOLS).forEach((list) => {
      expect(list.length).toBeGreaterThan(0);
    });
  });

  it('Majors starts with BTC, ETH', () => {
    expect(SYMBOLS.Majors[0]).toBe('BTC');
    expect(SYMBOLS.Majors[1]).toBe('ETH');
  });

  it('Forex Majors contains EURUSD + USDJPY + GBPUSD', () => {
    expect(SYMBOLS['Forex Majors']).toContain('EURUSD');
    expect(SYMBOLS['Forex Majors']).toContain('USDJPY');
    expect(SYMBOLS['Forex Majors']).toContain('GBPUSD');
  });

  it('Precious Metals contains XAU (gold) + XAG (silver)', () => {
    expect(SYMBOLS['Precious Metals']).toContain('XAU');
    expect(SYMBOLS['Precious Metals']).toContain('XAG');
  });
});

describe('CEX_EXCHANGES', () => {
  it('contains the top CEX venues', () => {
    expect(CEX_EXCHANGES).toContain('Binance');
    expect(CEX_EXCHANGES).toContain('OKX');
    expect(CEX_EXCHANGES).toContain('Bybit');
  });

  it('has no duplicates', () => {
    const unique = new Set(CEX_EXCHANGES);
    expect(unique.size).toBe(CEX_EXCHANGES.length);
  });

  it('does NOT contain Hyperliquid (that is a DEX)', () => {
    expect(CEX_EXCHANGES).not.toContain('Hyperliquid');
  });
});

describe('DEX_EXCHANGES', () => {
  it('contains the top DEX venues', () => {
    expect(DEX_EXCHANGES).toContain('Hyperliquid');
    expect(DEX_EXCHANGES).toContain('dYdX');
    expect(DEX_EXCHANGES).toContain('Aster');
  });

  it('has no duplicates', () => {
    const unique = new Set(DEX_EXCHANGES);
    expect(unique.size).toBe(DEX_EXCHANGES.length);
  });

  it('does NOT contain Binance (that is a CEX)', () => {
    expect(DEX_EXCHANGES).not.toContain('Binance');
  });
});

describe('ALL_EXCHANGES', () => {
  it('equals CEX + DEX with no overlap (each venue is one or the other)', () => {
    expect(ALL_EXCHANGES.length).toBe(CEX_EXCHANGES.length + DEX_EXCHANGES.length);
  });

  it('has no duplicates', () => {
    const unique = new Set(ALL_EXCHANGES);
    expect(unique.size).toBe(ALL_EXCHANGES.length);
  });
});

describe('DEFAULT_SELECTED', () => {
  it('is non-empty (some venues are selected by default for first paint)', () => {
    expect(DEFAULT_SELECTED.length).toBeGreaterThan(0);
  });

  it('every default is in ALL_EXCHANGES', () => {
    DEFAULT_SELECTED.forEach((ex) => {
      expect(ALL_EXCHANGES).toContain(ex);
    });
  });

  it('contains Binance (highest-traffic exchange)', () => {
    expect(DEFAULT_SELECTED).toContain('Binance');
  });
});

describe('getAssetClass', () => {
  it('returns "crypto" for crypto symbols', () => {
    expect(getAssetClass('BTC')).toBe('crypto');
    expect(getAssetClass('ETH')).toBe('crypto');
    expect(getAssetClass('PEPE')).toBe('crypto');
  });

  it('returns "commodities" for metals + energy', () => {
    expect(getAssetClass('XAU')).toBe('commodities');
    expect(getAssetClass('XAG')).toBe('commodities');
    expect(getAssetClass('WTI')).toBe('commodities');
    expect(getAssetClass('NATGAS')).toBe('commodities');
  });

  it('returns "forex" for forex pairs', () => {
    expect(getAssetClass('EURUSD')).toBe('forex');
    expect(getAssetClass('USDJPY')).toBe('forex');
    expect(getAssetClass('EURGBP')).toBe('forex');
  });

  it('returns "stocks" for equities', () => {
    expect(getAssetClass('AAPL')).toBe('stocks');
    expect(getAssetClass('TSLA')).toBe('stocks');
    expect(getAssetClass('COIN')).toBe('stocks');
    expect(getAssetClass('MSTR')).toBe('stocks');
  });

  it('returns "indices" for indices', () => {
    expect(getAssetClass('SPX')).toBe('indices');
    expect(getAssetClass('QQQ')).toBe('indices');
  });

  it('defaults to "crypto" for unknown symbols', () => {
    expect(getAssetClass('UNKNOWN_SYMBOL')).toBe('crypto');
  });
});

describe('getCategoryForSymbol', () => {
  it('returns the category for a known symbol', () => {
    expect(getCategoryForSymbol('BTC')).toBe('Majors');
    expect(getCategoryForSymbol('PEPE')).toBe('Memes');
    expect(getCategoryForSymbol('AAPL')).toBe('Mega Cap Stocks');
    expect(getCategoryForSymbol('XAU')).toBe('Precious Metals');
  });

  it('returns null for unknown symbols', () => {
    expect(getCategoryForSymbol('NOTACOIN')).toBeNull();
    expect(getCategoryForSymbol('')).toBeNull();
  });
});

describe('getAllDefaultSymbols', () => {
  it('returns a flat list of every category union', () => {
    const flat = getAllDefaultSymbols();
    expect(flat.length).toBeGreaterThan(0);
    // Each category contributes
    expect(flat).toContain('BTC');     // Majors
    expect(flat).toContain('AAPL');    // Mega Cap Stocks
    expect(flat).toContain('XAU');     // Precious Metals
    expect(flat).toContain('EURUSD');  // Forex Majors
    expect(flat).toContain('SPX');     // Indices
  });

  it('length equals the sum of all category lengths (no de-dup)', () => {
    const flat = getAllDefaultSymbols();
    const total = Object.values(SYMBOLS).reduce((a, l) => a + l.length, 0);
    expect(flat.length).toBe(total);
  });
});
