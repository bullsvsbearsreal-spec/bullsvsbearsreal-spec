/**
 * Tests for liquidation-parsers — the WebSocket message shape parsers
 * for 10+ exchanges. The aggregated liquidation feed (/liquidations,
 * /liquidation-heatmap) renders directly from these. A regression in any
 * parser would silently drop that exchange's events from the feed.
 *
 * Also tests the symbol-normaliser used to merge cross-exchange
 * liquidations under a single symbol bucket — wrong stripping = wrong
 * BTC totals on the dashboard.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeLiqSymbol,
  isLiqCryptoSymbol,
  parseBinanceLiq,
  parseBybitLiq,
  parseBybitLiqAll,
} from '../liquidation-parsers';

describe('normalizeLiqSymbol — quote suffix stripping', () => {
  it('strips USDT', () => {
    expect(normalizeLiqSymbol('BTCUSDT')).toBe('BTC');
    expect(normalizeLiqSymbol('ETHUSDT')).toBe('ETH');
  });

  it('strips USDC and plain USD', () => {
    expect(normalizeLiqSymbol('BTCUSDC')).toBe('BTC');
    expect(normalizeLiqSymbol('BTCUSD')).toBe('BTC');
  });

  it('strips OKX-style suffixes', () => {
    expect(normalizeLiqSymbol('BTC-USDT-SWAP')).toBe('BTC');
    expect(normalizeLiqSymbol('BTC-USDC-SWAP')).toBe('BTC');
    expect(normalizeLiqSymbol('BTC-USD-SWAP')).toBe('BTC');
  });

  it('strips Deribit -PERPETUAL suffix', () => {
    expect(normalizeLiqSymbol('BTC-PERPETUAL')).toBe('BTC');
  });

  it('strips Bitget _UMCBL suffix', () => {
    expect(normalizeLiqSymbol('BTCUSDT_UMCBL')).toBe('BTC');
  });

  it('strips Binance UM/UMCBL futures suffixes', () => {
    expect(normalizeLiqSymbol('BTCUSDUM')).toBe('BTC');
    expect(normalizeLiqSymbol('BTCUSD_UM')).toBe('BTC');
  });

  it('strips quarterly expiry dates', () => {
    expect(normalizeLiqSymbol('BTC260327')).toBe('BTC');
    expect(normalizeLiqSymbol('ETH260626')).toBe('ETH');
  });
});

describe('normalizeLiqSymbol — multiplier prefix stripping', () => {
  it('strips 1000 prefix from cheap memecoins', () => {
    expect(normalizeLiqSymbol('1000SHIBUSDT')).toBe('SHIB');
    expect(normalizeLiqSymbol('1000PEPEUSDT')).toBe('PEPE');
  });

  it('strips 10000 prefix', () => {
    expect(normalizeLiqSymbol('10000SATSUSDT')).toBe('SATS');
  });

  it('strips 1000000 prefix', () => {
    expect(normalizeLiqSymbol('1000000PEIPEIUSDT')).toBe('PEIPEI');
  });

  it('strips 1M alias', () => {
    expect(normalizeLiqSymbol('1MBABYDOGEUSDT')).toBe('BABYDOGE');
  });
});

describe('normalizeLiqSymbol — already-normalized symbols pass through', () => {
  it('passes BTC / ETH / SOL through unchanged', () => {
    expect(normalizeLiqSymbol('BTC')).toBe('BTC');
    expect(normalizeLiqSymbol('ETH')).toBe('ETH');
    expect(normalizeLiqSymbol('SOL')).toBe('SOL');
  });
});

describe('isLiqCryptoSymbol — accepts crypto, rejects junk', () => {
  it('accepts canonical crypto tickers', () => {
    expect(isLiqCryptoSymbol('BTC')).toBe(true);
    expect(isLiqCryptoSymbol('ETH')).toBe(true);
    expect(isLiqCryptoSymbol('SOL')).toBe(true);
    expect(isLiqCryptoSymbol('1000PEPE')).toBe(true);
  });

  it('rejects empty + null-ish input', () => {
    expect(isLiqCryptoSymbol('')).toBe(false);
    expect(isLiqCryptoSymbol(null as any)).toBe(false);
    expect(isLiqCryptoSymbol(undefined as any)).toBe(false);
  });

  it('rejects non-ASCII (Chinese, special chars)', () => {
    expect(isLiqCryptoSymbol('比特币')).toBe(false);
    expect(isLiqCryptoSymbol('BTC$')).toBe(false);
    expect(isLiqCryptoSymbol('BTC-USDT')).toBe(false); // dash rejected
  });
});

describe('parseBinanceLiq', () => {
  it('parses a valid Binance forceOrder message', () => {
    const msg = {
      e: 'forceOrder',
      o: {
        s: 'BTCUSDT',
        S: 'SELL', // SELL → long liquidated
        p: '80000.5',
        q: '1.5',
        T: 1700000000000,
      },
    };
    const liq = parseBinanceLiq(msg);
    expect(liq).not.toBeNull();
    expect(liq?.symbol).toBe('BTC');
    expect(liq?.side).toBe('long');
    expect(liq?.price).toBe(80000.5);
    expect(liq?.quantity).toBe(1.5);
    expect(liq?.value).toBeCloseTo(120000.75, 2);
    expect(liq?.exchange).toBe('Binance');
    expect(liq?.timestamp).toBe(1700000000000);
  });

  it('classifies BUY-side as short liquidation (counterintuitive — Binance encodes the LIQUIDATION direction as opposite of the position)', () => {
    const msg = {
      e: 'forceOrder',
      o: { s: 'ETHUSDT', S: 'BUY', p: '3000', q: '5', T: 1 },
    };
    expect(parseBinanceLiq(msg)?.side).toBe('short');
  });

  it('rejects non-forceOrder messages', () => {
    expect(parseBinanceLiq({ e: 'kline', o: {} })).toBeNull();
    expect(parseBinanceLiq({})).toBeNull();
  });

  it('rejects messages with invalid price or quantity', () => {
    expect(parseBinanceLiq({ e: 'forceOrder', o: { s: 'BTC', S: 'SELL', p: 'NaN', q: '1', T: 1 } })).toBeNull();
    expect(parseBinanceLiq({ e: 'forceOrder', o: { s: 'BTC', S: 'SELL', p: '0', q: '1', T: 1 } })).toBeNull();
    expect(parseBinanceLiq({ e: 'forceOrder', o: { s: 'BTC', S: 'SELL', p: '100', q: '0', T: 1 } })).toBeNull();
    expect(parseBinanceLiq({ e: 'forceOrder', o: { s: 'BTC', S: 'SELL', p: '-100', q: '1', T: 1 } })).toBeNull();
  });

  it('strips 1000-prefix from memecoin symbols', () => {
    const msg = { e: 'forceOrder', o: { s: '1000PEPEUSDT', S: 'SELL', p: '0.001', q: '1000000', T: 1 } };
    expect(parseBinanceLiq(msg)?.symbol).toBe('PEPE');
  });
});

describe('parseBybitLiqAll', () => {
  it('parses a single liquidation in allLiquidation format', () => {
    const msg = {
      topic: 'allLiquidation.BTCUSDT',
      data: { price: '80000', size: '0.5', symbol: 'BTCUSDT', side: 'Buy', updatedTime: 1700000000000 },
    };
    const liqs = parseBybitLiqAll(msg);
    expect(liqs).toHaveLength(1);
    expect(liqs[0].symbol).toBe('BTC');
    expect(liqs[0].side).toBe('short'); // Buy → short liquidated
    expect(liqs[0].price).toBe(80000);
    expect(liqs[0].quantity).toBe(0.5);
    expect(liqs[0].exchange).toBe('Bybit');
  });

  it('parses a batched array of liquidations', () => {
    const msg = {
      topic: 'allLiquidation.BTCUSDT',
      data: [
        { price: '80000', size: '0.5', symbol: 'BTCUSDT', side: 'Sell', updatedTime: 1 },
        { price: '80100', size: '0.3', symbol: 'BTCUSDT', side: 'Buy', updatedTime: 2 },
      ],
    };
    const liqs = parseBybitLiqAll(msg);
    expect(liqs).toHaveLength(2);
    expect(liqs[0].side).toBe('long');  // Sell → long liquidated
    expect(liqs[1].side).toBe('short'); // Buy → short liquidated
  });

  it('rejects messages from wrong topics', () => {
    expect(parseBybitLiqAll({ topic: 'orderbook.50.BTCUSDT', data: {} })).toEqual([]);
    expect(parseBybitLiqAll({})).toEqual([]);
  });

  it('skips invalid items in a batch but returns valid ones', () => {
    const msg = {
      topic: 'allLiquidation.BTCUSDT',
      data: [
        { price: '0', size: '0.5', symbol: 'BTCUSDT', side: 'Buy', updatedTime: 1 }, // invalid
        { price: '80100', size: '0.3', symbol: 'BTCUSDT', side: 'Sell', updatedTime: 2 },
      ],
    };
    const liqs = parseBybitLiqAll(msg);
    expect(liqs).toHaveLength(1);
    expect(liqs[0].price).toBe(80100);
  });
});

describe('parseBybitLiq (single-result wrapper)', () => {
  it('returns the first parsed liquidation when given a valid message', () => {
    const msg = {
      topic: 'allLiquidation.BTCUSDT',
      data: { price: '80000', size: '0.5', symbol: 'BTCUSDT', side: 'Sell', updatedTime: 1 },
    };
    const liq = parseBybitLiq(msg);
    expect(liq).not.toBeNull();
    expect(liq?.symbol).toBe('BTC');
  });

  it('returns null when no parseable items', () => {
    expect(parseBybitLiq({})).toBeNull();
    expect(parseBybitLiq({ topic: 'wrong-topic', data: {} })).toBeNull();
  });
});
