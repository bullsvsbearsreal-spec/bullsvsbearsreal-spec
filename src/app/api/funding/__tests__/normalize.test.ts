import { describe, it, expect } from 'vitest';
import {
  normalizeSymbol,
  classifySymbol,
  KNOWN_STOCKS,
  KNOWN_FOREX,
  KNOWN_COMMODITIES,
  GTRADE_GROUP_ASSET_CLASS,
} from '../normalize';

// ─── classifySymbol (generic) ───────────────────────────────────

describe('classifySymbol', () => {
  it('classifies known stocks', () => {
    expect(classifySymbol('AAPL')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
    expect(classifySymbol('TSLA')).toEqual({ symbol: 'TSLA', assetClass: 'stocks' });
    expect(classifySymbol('NVDA')).toEqual({ symbol: 'NVDA', assetClass: 'stocks' });
  });

  it('classifies known forex pairs', () => {
    expect(classifySymbol('EURUSD')).toEqual({ symbol: 'EURUSD', assetClass: 'forex' });
    expect(classifySymbol('USDJPY')).toEqual({ symbol: 'USDJPY', assetClass: 'forex' });
  });

  it('classifies known commodities', () => {
    expect(classifySymbol('XAU')).toEqual({ symbol: 'XAU', assetClass: 'commodities' });
    expect(classifySymbol('WTI')).toEqual({ symbol: 'WTI', assetClass: 'commodities' });
    expect(classifySymbol('PAXG')).toEqual({ symbol: 'PAXG', assetClass: 'commodities' });
  });

  it('defaults unknown symbols to crypto', () => {
    expect(classifySymbol('BTC')).toEqual({ symbol: 'BTC', assetClass: 'crypto' });
    expect(classifySymbol('ETH')).toEqual({ symbol: 'ETH', assetClass: 'crypto' });
    expect(classifySymbol('SOL')).toEqual({ symbol: 'SOL', assetClass: 'crypto' });
    expect(classifySymbol('DOGE')).toEqual({ symbol: 'DOGE', assetClass: 'crypto' });
  });
});

// ─── Gate.io normalization ──────────────────────────────────────

describe('normalizeSymbol — Gate.io', () => {
  it('strips X suffix from known stocks', () => {
    expect(normalizeSymbol('AAPLX', 'Gate.io')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
    expect(normalizeSymbol('TSLAX', 'Gate.io')).toEqual({ symbol: 'TSLA', assetClass: 'stocks' });
    expect(normalizeSymbol('SPYX', 'Gate.io')).toEqual({ symbol: 'SPY', assetClass: 'stocks' });
  });

  it('handles _USDT suffix', () => {
    expect(normalizeSymbol('AAPLX_USDT', 'Gate.io')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
  });

  it('handles case-insensitive exchange name', () => {
    expect(normalizeSymbol('AAPLX', 'gateio')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
  });

  it('keeps unknown X-suffix symbols as crypto', () => {
    // DYDX ends in X but DYDX is not a known stock (DYD is not a stock)
    expect(normalizeSymbol('DYDX', 'Gate.io').assetClass).toBe('crypto');
  });

  it('classifies crypto normally', () => {
    expect(normalizeSymbol('BTC', 'Gate.io')).toEqual({ symbol: 'BTC', assetClass: 'crypto' });
  });

  it('classifies known stock without X suffix', () => {
    expect(normalizeSymbol('NVDA', 'Gate.io')).toEqual({ symbol: 'NVDA', assetClass: 'stocks' });
  });
});

// ─── Aster normalization ────────────────────────────────────────

describe('normalizeSymbol — Aster', () => {
  it('strips USDT and classifies stocks', () => {
    expect(normalizeSymbol('TSLAUSDT', 'Aster')).toEqual({ symbol: 'TSLA', assetClass: 'stocks' });
    expect(normalizeSymbol('AAPLUSDT', 'Aster')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
  });

  it('strips SHIELD prefix', () => {
    expect(normalizeSymbol('SHIELDTSLAUSDT', 'Aster')).toEqual({ symbol: 'TSLA', assetClass: 'stocks' });
    expect(normalizeSymbol('SHIELDAAPLUSDT', 'Aster')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
  });

  it('classifies forex pairs', () => {
    expect(normalizeSymbol('EURUSDUSDT', 'Aster')).toEqual({ symbol: 'EURUSD', assetClass: 'forex' });
  });

  it('classifies forex from base currency', () => {
    expect(normalizeSymbol('JPYUSDUSDT', 'Aster')).toEqual({ symbol: 'JPYUSD', assetClass: 'forex' });
  });

  it('classifies commodities', () => {
    expect(normalizeSymbol('XAUUSDT', 'Aster')).toEqual({ symbol: 'XAU', assetClass: 'commodities' });
  });

  it('SHIELD crypto remains crypto', () => {
    expect(normalizeSymbol('SHIELDADAUSDT', 'Aster')).toEqual({ symbol: 'ADA', assetClass: 'crypto' });
  });

  it('strips USDC suffix', () => {
    expect(normalizeSymbol('TSLAUSDC', 'Aster')).toEqual({ symbol: 'TSLA', assetClass: 'stocks' });
  });
});

// ─── Lighter normalization ──────────────────────────────────────

describe('normalizeSymbol — Lighter', () => {
  it('classifies pre-normalized symbols', () => {
    expect(normalizeSymbol('BTC', 'Lighter')).toEqual({ symbol: 'BTC', assetClass: 'crypto' });
    expect(normalizeSymbol('AAPL', 'Lighter')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
    expect(normalizeSymbol('EURUSD', 'Lighter')).toEqual({ symbol: 'EURUSD', assetClass: 'forex' });
    expect(normalizeSymbol('XAU', 'Lighter')).toEqual({ symbol: 'XAU', assetClass: 'commodities' });
  });
});

// ─── Phemex normalization ───────────────────────────────────────

describe('normalizeSymbol — Phemex', () => {
  it('strips USDT and classifies', () => {
    expect(normalizeSymbol('TSLAUSDT', 'Phemex')).toEqual({ symbol: 'TSLA', assetClass: 'stocks' });
    expect(normalizeSymbol('XAUUSDT', 'Phemex')).toEqual({ symbol: 'XAU', assetClass: 'commodities' });
    expect(normalizeSymbol('EURUSDUSDT', 'Phemex')).toEqual({ symbol: 'EURUSD', assetClass: 'forex' });
    expect(normalizeSymbol('BTCUSDT', 'Phemex')).toEqual({ symbol: 'BTC', assetClass: 'crypto' });
  });
});

// ─── dYdX normalization ─────────────────────────────────────────

describe('normalizeSymbol — dYdX', () => {
  it('strips -USD suffix', () => {
    expect(normalizeSymbol('BTC-USD', 'dYdX')).toEqual({ symbol: 'BTC', assetClass: 'crypto' });
    expect(normalizeSymbol('ETH-USD', 'dYdX')).toEqual({ symbol: 'ETH', assetClass: 'crypto' });
  });

  it('constructs forex pair from base currency', () => {
    expect(normalizeSymbol('EUR-USD', 'dYdX')).toEqual({ symbol: 'EURUSD', assetClass: 'forex' });
    expect(normalizeSymbol('GBP-USD', 'dYdX')).toEqual({ symbol: 'GBPUSD', assetClass: 'forex' });
    expect(normalizeSymbol('JPY-USD', 'dYdX')).toEqual({ symbol: 'JPYUSD', assetClass: 'forex' });
  });

  it('classifies commodities', () => {
    expect(normalizeSymbol('PAXG-USD', 'dYdX')).toEqual({ symbol: 'PAXG', assetClass: 'commodities' });
  });

  it('does NOT classify CVX as stock (crypto token on dYdX)', () => {
    expect(normalizeSymbol('CVX-USD', 'dYdX')).toEqual({ symbol: 'CVX', assetClass: 'crypto' });
  });
});

// ─── BingX normalization ────────────────────────────────────────

describe('normalizeSymbol — BingX', () => {
  it('handles NCSK stock prefix', () => {
    expect(normalizeSymbol('NCSKTSLA2USD', 'BingX')).toEqual({ symbol: 'TSLA', assetClass: 'stocks' });
    expect(normalizeSymbol('NCSKAAPL2USD', 'BingX')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
  });

  it('handles NCCO commodity prefix', () => {
    expect(normalizeSymbol('NCCOGOLD2USD', 'BingX')).toEqual({ symbol: 'XAU', assetClass: 'commodities' });
    expect(normalizeSymbol('NCCOSILVER2USD', 'BingX')).toEqual({ symbol: 'XAG', assetClass: 'commodities' });
    expect(normalizeSymbol('NCCOOILWTI2USD', 'BingX')).toEqual({ symbol: 'WTI', assetClass: 'commodities' });
    expect(normalizeSymbol('NCCONATURALGAS2USD', 'BingX')).toEqual({ symbol: 'NATGAS', assetClass: 'commodities' });
  });

  it('handles NCFX forex prefix', () => {
    expect(normalizeSymbol('NCFXEUR2USD', 'BingX')).toEqual({ symbol: 'EURUSD', assetClass: 'forex' });
    expect(normalizeSymbol('NCFXGBP2USD', 'BingX')).toEqual({ symbol: 'GBPUSD', assetClass: 'forex' });
  });

  it('handles NCFX cross pairs with 2 separator', () => {
    expect(normalizeSymbol('NCFXEUR2JPY', 'BingX')).toEqual({ symbol: 'EURJPY', assetClass: 'forex' });
  });

  it('handles NCSI index prefix', () => {
    expect(normalizeSymbol('NCSISP5002USD', 'BingX')).toEqual({ symbol: 'SPX', assetClass: 'stocks' });
    expect(normalizeSymbol('NCSINASDAQ1002USD', 'BingX')).toEqual({ symbol: 'QQQ', assetClass: 'stocks' });
  });

  it('handles plain 2USD suffix stocks', () => {
    expect(normalizeSymbol('TSLA2USD', 'BingX')).toEqual({ symbol: 'TSLA', assetClass: 'stocks' });
  });

  it('handles X suffix stocks', () => {
    expect(normalizeSymbol('AAPLX', 'BingX')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
  });

  it('strips -USDT and classifies crypto', () => {
    expect(normalizeSymbol('BTC-USDT', 'BingX')).toEqual({ symbol: 'BTC', assetClass: 'crypto' });
  });

  it('classifies known commodity without prefix', () => {
    expect(normalizeSymbol('XAU', 'BingX')).toEqual({ symbol: 'XAU', assetClass: 'commodities' });
  });
});

// ─── Default exchange (fallthrough to classifySymbol) ───────────

describe('normalizeSymbol — default exchange', () => {
  it('falls through to classifySymbol for unknown exchanges', () => {
    expect(normalizeSymbol('BTC', 'Binance')).toEqual({ symbol: 'BTC', assetClass: 'crypto' });
    expect(normalizeSymbol('AAPL', 'Binance')).toEqual({ symbol: 'AAPL', assetClass: 'stocks' });
    expect(normalizeSymbol('EURUSD', 'Binance')).toEqual({ symbol: 'EURUSD', assetClass: 'forex' });
  });
});

// ─── Known sets sanity checks ───────────────────────────────────

describe('Known symbol sets', () => {
  it('KNOWN_STOCKS has major stocks', () => {
    for (const s of ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'META', 'AMZN']) {
      expect(KNOWN_STOCKS.has(s)).toBe(true);
    }
  });

  it('KNOWN_FOREX has major pairs', () => {
    for (const s of ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD']) {
      expect(KNOWN_FOREX.has(s)).toBe(true);
    }
  });

  it('KNOWN_COMMODITIES has precious metals', () => {
    for (const s of ['XAU', 'XAG', 'WTI', 'NATGAS']) {
      expect(KNOWN_COMMODITIES.has(s)).toBe(true);
    }
  });

  it('GTRADE_GROUP_ASSET_CLASS covers groups 0-11', () => {
    for (let i = 0; i <= 11; i++) {
      expect(GTRADE_GROUP_ASSET_CLASS[i]).toBeDefined();
    }
    expect(GTRADE_GROUP_ASSET_CLASS[0]).toBe('crypto');
    expect(GTRADE_GROUP_ASSET_CLASS[1]).toBe('forex');
    expect(GTRADE_GROUP_ASSET_CLASS[2]).toBe('stocks');
    expect(GTRADE_GROUP_ASSET_CLASS[6]).toBe('commodities');
  });
});
