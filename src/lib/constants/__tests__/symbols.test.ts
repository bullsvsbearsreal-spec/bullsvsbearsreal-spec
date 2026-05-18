import { describe, it, expect } from 'vitest';
import {
  PRIORITY_SYMBOLS,
  STOCK_PRIORITY_SYMBOLS,
  FOREX_PRIORITY_SYMBOLS,
  COMMODITY_PRIORITY_SYMBOLS,
  CATEGORIES,
  STOCK_CATEGORIES,
  FOREX_CATEGORIES,
  COMMODITY_CATEGORIES,
  getCategoriesForAssetClass,
} from '../symbols';

describe('PRIORITY_SYMBOLS', () => {
  it('starts with BTC and ETH (the most-watched majors)', () => {
    expect(PRIORITY_SYMBOLS[0]).toBe('BTC');
    expect(PRIORITY_SYMBOLS[1]).toBe('ETH');
  });

  it('has no duplicates', () => {
    const unique = new Set(PRIORITY_SYMBOLS);
    expect(unique.size).toBe(PRIORITY_SYMBOLS.length);
  });

  it('all entries are uppercase strings', () => {
    PRIORITY_SYMBOLS.forEach((s) => {
      expect(s).toBe(s.toUpperCase());
      expect(typeof s).toBe('string');
    });
  });
});

describe('STOCK_PRIORITY_SYMBOLS', () => {
  it('contains the FAANG-era mega-caps', () => {
    expect(STOCK_PRIORITY_SYMBOLS).toContain('AAPL');
    expect(STOCK_PRIORITY_SYMBOLS).toContain('TSLA');
    expect(STOCK_PRIORITY_SYMBOLS).toContain('NVDA');
    expect(STOCK_PRIORITY_SYMBOLS).toContain('META');
  });

  it('contains crypto-adjacent stocks (COIN, MSTR, HOOD)', () => {
    expect(STOCK_PRIORITY_SYMBOLS).toContain('COIN');
    expect(STOCK_PRIORITY_SYMBOLS).toContain('MSTR');
    expect(STOCK_PRIORITY_SYMBOLS).toContain('HOOD');
  });

  it('has no duplicates', () => {
    const unique = new Set(STOCK_PRIORITY_SYMBOLS);
    expect(unique.size).toBe(STOCK_PRIORITY_SYMBOLS.length);
  });
});

describe('FOREX_PRIORITY_SYMBOLS', () => {
  it('contains the G7 majors', () => {
    expect(FOREX_PRIORITY_SYMBOLS).toContain('EURUSD');
    expect(FOREX_PRIORITY_SYMBOLS).toContain('GBPUSD');
    expect(FOREX_PRIORITY_SYMBOLS).toContain('USDJPY');
  });

  it('entries are 6-letter currency pairs', () => {
    FOREX_PRIORITY_SYMBOLS.forEach((s) => {
      expect(s).toMatch(/^[A-Z]{6}$/);
    });
  });
});

describe('COMMODITY_PRIORITY_SYMBOLS', () => {
  it('contains gold (XAU) and silver (XAG)', () => {
    expect(COMMODITY_PRIORITY_SYMBOLS).toContain('XAU');
    expect(COMMODITY_PRIORITY_SYMBOLS).toContain('XAG');
  });

  it('contains energy products', () => {
    expect(COMMODITY_PRIORITY_SYMBOLS).toContain('WTI');
    expect(COMMODITY_PRIORITY_SYMBOLS).toContain('BRENT');
  });
});

describe('CATEGORIES (crypto)', () => {
  it('has all expected category keys', () => {
    expect(CATEGORIES.all).toBeDefined();
    expect(CATEGORIES.tops).toBeDefined();
    expect(CATEGORIES.alts).toBeDefined();
    expect(CATEGORIES.memes).toBeDefined();
    expect(CATEGORIES.layer2).toBeDefined();
    expect(CATEGORIES.defi).toBeDefined();
    expect(CATEGORIES.ai).toBeDefined();
    expect(CATEGORIES.gaming).toBeDefined();
    expect(CATEGORIES.rwa).toBeDefined();
    expect(CATEGORIES.infra).toBeDefined();
    expect(CATEGORIES.highest).toBeDefined();
    expect(CATEGORIES.lowest).toBeDefined();
  });

  it('"all" has empty symbol list (means no filter)', () => {
    expect(CATEGORIES.all.symbols).toEqual([]);
  });

  it('dynamic categories (highest/lowest) have empty symbols + dynamic flag', () => {
    expect(CATEGORIES.highest.symbols).toEqual([]);
    expect(CATEGORIES.highest.dynamic).toBe('highest');
    expect(CATEGORIES.lowest.dynamic).toBe('lowest');
  });

  it('"tops" contains BTC + ETH (sanity)', () => {
    expect(CATEGORIES.tops.symbols).toContain('BTC');
    expect(CATEGORIES.tops.symbols).toContain('ETH');
  });

  it('"memes" excludes BTC (smoke check — not a meme)', () => {
    expect(CATEGORIES.memes.symbols).not.toContain('BTC');
    expect(CATEGORIES.memes.symbols).toContain('DOGE');
    expect(CATEGORIES.memes.symbols).toContain('SHIB');
  });

  it('"ai" includes RENDER + TAO + WLD (the ai-coin canon)', () => {
    expect(CATEGORIES.ai.symbols).toContain('RENDER');
    expect(CATEGORIES.ai.symbols).toContain('TAO');
    expect(CATEGORIES.ai.symbols).toContain('WLD');
  });

  it('every non-dynamic category has at least 1 symbol (except "all")', () => {
    Object.entries(CATEGORIES).forEach(([key, cat]) => {
      if (key === 'all') return;
      if (cat.dynamic) return;
      expect(cat.symbols.length).toBeGreaterThan(0);
    });
  });
});

describe('STOCK_CATEGORIES', () => {
  it('has tech, crypto, mega cap, indices', () => {
    expect(STOCK_CATEGORIES.tech).toBeDefined();
    expect(STOCK_CATEGORIES.crypto_adjacent).toBeDefined();
    expect(STOCK_CATEGORIES.mega_cap).toBeDefined();
    expect(STOCK_CATEGORIES.indices).toBeDefined();
  });

  it('"crypto_adjacent" contains COIN + MSTR + HOOD', () => {
    expect(STOCK_CATEGORIES.crypto_adjacent.symbols).toContain('COIN');
    expect(STOCK_CATEGORIES.crypto_adjacent.symbols).toContain('MSTR');
    expect(STOCK_CATEGORIES.crypto_adjacent.symbols).toContain('HOOD');
  });
});

describe('FOREX_CATEGORIES', () => {
  it('"majors" contains EURUSD and USDJPY', () => {
    expect(FOREX_CATEGORIES.majors.symbols).toContain('EURUSD');
    expect(FOREX_CATEGORIES.majors.symbols).toContain('USDJPY');
  });

  it('"emerging" contains TRY pairs (Turkey)', () => {
    expect(FOREX_CATEGORIES.emerging.symbols.some((s) => s.includes('TRY'))).toBe(true);
  });
});

describe('COMMODITY_CATEGORIES', () => {
  it('"metals" contains gold + silver + platinum + palladium', () => {
    expect(COMMODITY_CATEGORIES.metals.symbols).toContain('XAU');
    expect(COMMODITY_CATEGORIES.metals.symbols).toContain('XAG');
    expect(COMMODITY_CATEGORIES.metals.symbols).toContain('XPT');
    expect(COMMODITY_CATEGORIES.metals.symbols).toContain('XPD');
  });

  it('"energy" contains WTI + Brent + nat gas', () => {
    expect(COMMODITY_CATEGORIES.energy.symbols).toContain('WTI');
    expect(COMMODITY_CATEGORIES.energy.symbols).toContain('BRENT');
    expect(COMMODITY_CATEGORIES.energy.symbols).toContain('NATGAS');
  });
});

describe('getCategoriesForAssetClass', () => {
  it('returns crypto categories for "crypto"', () => {
    const { categories, prioritySymbols } = getCategoriesForAssetClass('crypto');
    expect(categories).toBe(CATEGORIES);
    expect(prioritySymbols).toBe(PRIORITY_SYMBOLS);
  });

  it('returns stock categories for "stocks"', () => {
    const { categories, prioritySymbols } = getCategoriesForAssetClass('stocks');
    expect(categories).toBe(STOCK_CATEGORIES);
    expect(prioritySymbols).toBe(STOCK_PRIORITY_SYMBOLS);
  });

  it('returns forex categories for "forex"', () => {
    const { categories } = getCategoriesForAssetClass('forex');
    expect(categories).toBe(FOREX_CATEGORIES);
  });

  it('returns commodity categories for "commodities"', () => {
    const { categories } = getCategoriesForAssetClass('commodities');
    expect(categories).toBe(COMMODITY_CATEGORIES);
  });

  it('"all" returns merged crypto + stocks/forex/commodities dynamic entries', () => {
    const { categories, prioritySymbols } = getCategoriesForAssetClass('all');
    expect(categories.stocks?.dynamic).toBe('stocks');
    expect(categories.forex?.dynamic).toBe('forex');
    expect(categories.commodities?.dynamic).toBe('commodities');
    // Priority symbols become the union
    expect(prioritySymbols.length).toBe(
      PRIORITY_SYMBOLS.length + STOCK_PRIORITY_SYMBOLS.length +
      FOREX_PRIORITY_SYMBOLS.length + COMMODITY_PRIORITY_SYMBOLS.length,
    );
  });

  it('always returns an icons map with "all" key', () => {
    (['crypto', 'stocks', 'forex', 'commodities', 'all'] as const).forEach((ac) => {
      const { icons } = getCategoriesForAssetClass(ac);
      expect(icons.all).toBeDefined();
    });
  });
});
