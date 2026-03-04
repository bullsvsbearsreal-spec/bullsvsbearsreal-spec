import { describe, it, expect } from 'vitest';
import { isCryptoSymbol, normalizeSymbol, isTop500Symbol } from '../fetch';

// ─── isCryptoSymbol ─────────────────────────────────────────────────────────

describe('isCryptoSymbol', () => {
  it('returns true for normal crypto symbols', () => {
    expect(isCryptoSymbol('BTC')).toBe(true);
    expect(isCryptoSymbol('ETH')).toBe(true);
    expect(isCryptoSymbol('SOL')).toBe(true);
    expect(isCryptoSymbol('DOGE')).toBe(true);
    expect(isCryptoSymbol('PEPE')).toBe(true);
  });

  it('filters out NCSK tokenized stock symbols (BingX)', () => {
    expect(isCryptoSymbol('NCSKAAPL')).toBe(false);
    expect(isCryptoSymbol('NCSKNVDA')).toBe(false);
    expect(isCryptoSymbol('NCSKTSLA')).toBe(false);
  });

  it('filters out NCCO/NCFX/NCSI/ACNSTOCK prefix patterns', () => {
    expect(isCryptoSymbol('NCCO_TEST')).toBe(false);
    expect(isCryptoSymbol('NCFX_USD')).toBe(false);
    expect(isCryptoSymbol('NCSI_INDEX')).toBe(false);
    expect(isCryptoSymbol('ACNSTOCK_FOO')).toBe(false);
  });

  it('filters out *X stock suffix symbols (Kraken)', () => {
    expect(isCryptoSymbol('AAPLX')).toBe(false);
    expect(isCryptoSymbol('NVDAX')).toBe(false);
    expect(isCryptoSymbol('SPYX')).toBe(false);
    expect(isCryptoSymbol('TSLAX')).toBe(false);
    expect(isCryptoSymbol('COINX')).toBe(false);
    expect(isCryptoSymbol('MSFTX')).toBe(false);
  });

  it('does NOT filter crypto symbols ending in X', () => {
    // These are real crypto symbols, not in the stock set
    expect(isCryptoSymbol('IMX')).toBe(true);
    expect(isCryptoSymbol('STX')).toBe(true);
    expect(isCryptoSymbol('GMX')).toBe(true);
    expect(isCryptoSymbol('FLX')).toBe(true);
  });
});

// ─── normalizeSymbol ────────────────────────────────────────────────────────

describe('normalizeSymbol', () => {
  describe('quantity prefix stripping', () => {
    it('strips 1000000 prefix (Aevo style — 7 chars)', () => {
      expect(normalizeSymbol('1000000PEPE')).toBe('PEPE');
    });

    it('strips 10000 prefix (Aevo style — 5 chars)', () => {
      expect(normalizeSymbol('10000SATS')).toBe('SATS');
    });

    it('strips 1000 prefix (Bybit/OKX/Bitget style — 4 chars)', () => {
      expect(normalizeSymbol('1000SHIB')).toBe('SHIB');
      expect(normalizeSymbol('1000BONK')).toBe('BONK');
      expect(normalizeSymbol('1000PEPE')).toBe('PEPE');
      expect(normalizeSymbol('1000LUNC')).toBe('LUNC');
      expect(normalizeSymbol('1000FLOKI')).toBe('FLOKI');
    });

    it('strips 1M prefix (Drift style — 2 chars)', () => {
      expect(normalizeSymbol('1MBONK')).toBe('BONK');
      expect(normalizeSymbol('1MPEPE')).toBe('PEPE');
    });

    it('does NOT strip partial prefix matches', () => {
      // "100" should not be stripped (only 1000, 10000, 1000000, 1M)
      expect(normalizeSymbol('100X')).toBe('100X');
    });

    it('passes through normal symbols unchanged', () => {
      expect(normalizeSymbol('BTC')).toBe('BTC');
      expect(normalizeSymbol('ETH')).toBe('ETH');
      expect(normalizeSymbol('SOL')).toBe('SOL');
    });
  });

  describe('symbol aliases (token rebrands)', () => {
    it('maps RNDR → RENDER', () => {
      expect(normalizeSymbol('RNDR')).toBe('RENDER');
    });

    it('maps MATIC → POL', () => {
      expect(normalizeSymbol('MATIC')).toBe('POL');
    });

    it('does not alias unknown symbols', () => {
      expect(normalizeSymbol('BTC')).toBe('BTC');
      expect(normalizeSymbol('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('combined prefix + alias', () => {
    it('strips prefix then applies alias', () => {
      // If an exchange listed 1000MATIC, it should normalize to POL
      expect(normalizeSymbol('1000MATIC')).toBe('POL');
    });
  });
});

// ─── isTop500Symbol ─────────────────────────────────────────────────────────

describe('isTop500Symbol', () => {
  it('returns true for symbols in the set', () => {
    const top500 = new Set(['BTC', 'ETH', 'SOL', 'DOGE']);
    expect(isTop500Symbol('BTC', top500)).toBe(true);
    expect(isTop500Symbol('ETH', top500)).toBe(true);
  });

  it('returns false for symbols not in the set', () => {
    const top500 = new Set(['BTC', 'ETH', 'SOL']);
    expect(isTop500Symbol('UNKNOWN', top500)).toBe(false);
    expect(isTop500Symbol('SCAM', top500)).toBe(false);
  });

  it('is case-insensitive (uppercases input)', () => {
    const top500 = new Set(['BTC', 'ETH']);
    expect(isTop500Symbol('btc', top500)).toBe(true);
    expect(isTop500Symbol('Eth', top500)).toBe(true);
  });

  it('returns true for ALL symbols when set is empty (graceful degradation)', () => {
    const empty = new Set<string>();
    expect(isTop500Symbol('BTC', empty)).toBe(true);
    expect(isTop500Symbol('RANDOM', empty)).toBe(true);
    expect(isTop500Symbol('ANYCOIN', empty)).toBe(true);
  });
});
