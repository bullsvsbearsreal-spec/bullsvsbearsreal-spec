/**
 * Unit tests for the pure helpers behind <ChartPositionStrip>.
 *
 * Locks in:
 *   - fmtPrice: tiered decimal handling + non-finite fallback
 *   - fmtSize: K/M suffix bucketing
 *   - fmtUsd: B/M/K + optional sign prefix
 *   - normalizeSymbol / matchesSymbol: case + suffix-stripping
 *   - liquidationDistance: severity buckets + null on bad inputs
 *   - pnlPercentage: divide-by-zero + null propagation
 */

import { describe, it, expect } from 'vitest';
import {
  fmtPrice, fmtSize, fmtUsd,
  normalizeSymbol, matchesSymbol,
  liquidationDistance, pnlPercentage,
} from '../positionHelpers';

describe('fmtPrice', () => {
  it('returns — for null / undefined / NaN / Infinity', () => {
    expect(fmtPrice(null)).toBe('—');
    expect(fmtPrice(undefined)).toBe('—');
    expect(fmtPrice(NaN)).toBe('—');
    expect(fmtPrice(Infinity)).toBe('—');
    expect(fmtPrice(-Infinity)).toBe('—');
  });

  it('uses thousands separator for >=1000 (no decimals)', () => {
    expect(fmtPrice(1000)).toMatch(/^1[,.\s]?000$/); // locale-tolerant
    expect(fmtPrice(62431)).toMatch(/^62[,.\s]?431$/);
  });

  it('2 decimals for >=1 < 1000', () => {
    expect(fmtPrice(1)).toBe('1.00');
    expect(fmtPrice(42.5)).toBe('42.50');
    // Branch picks 2-decimal path on 999.999 (since <1000) — toFixed
    // rounds the display up to 1000.00 but no thousand separator
    // is applied (only the >=1000 branch uses toLocaleString).
    expect(fmtPrice(999.999)).toBe('1000.00');
  });

  it('4 decimals for >=0.01 < 1', () => {
    expect(fmtPrice(0.01)).toBe('0.0100');
    expect(fmtPrice(0.5)).toBe('0.5000');
  });

  it('6 decimals below 0.01', () => {
    expect(fmtPrice(0.000123)).toBe('0.000123');
    expect(fmtPrice(0)).toBe('0.000000');
  });

  it('handles negatives by magnitude', () => {
    expect(fmtPrice(-5000)).toMatch(/^-5[,.\s]?000$/);
    expect(fmtPrice(-0.5)).toBe('-0.5000');
  });
});

describe('fmtSize', () => {
  it('uses M suffix at >=1e6', () => {
    expect(fmtSize(1_000_000)).toBe('1.00M');
    expect(fmtSize(5_500_000)).toBe('5.50M');
  });

  it('uses K suffix at >=1e3', () => {
    expect(fmtSize(1000)).toBe('1.0K');
    expect(fmtSize(5500)).toBe('5.5K');
  });

  it('3 decimals at >=1', () => {
    expect(fmtSize(1)).toBe('1.000');
    expect(fmtSize(42.5)).toBe('42.500');
  });

  it('6 decimals below 1', () => {
    expect(fmtSize(0.001)).toBe('0.001000');
    expect(fmtSize(0)).toBe('0.000000');
  });

  it('handles negatives', () => {
    expect(fmtSize(-5_500_000)).toBe('-5.50M');
    expect(fmtSize(-1000)).toBe('-1.0K');
  });

  it('returns — on non-finite', () => {
    expect(fmtSize(NaN)).toBe('—');
    expect(fmtSize(Infinity)).toBe('—');
  });
});

describe('fmtUsd', () => {
  it('returns — for null / undefined / non-finite', () => {
    expect(fmtUsd(null)).toBe('—');
    expect(fmtUsd(undefined)).toBe('—');
    expect(fmtUsd(NaN)).toBe('—');
  });

  it('B suffix at >=1e9', () => {
    expect(fmtUsd(1_000_000_000)).toBe('$1.00B');
    expect(fmtUsd(2_500_000_000)).toBe('$2.50B');
  });

  it('M suffix at >=1e6', () => {
    expect(fmtUsd(1_000_000)).toBe('$1.00M');
    expect(fmtUsd(42_500_000)).toBe('$42.50M');
  });

  it('K suffix at >=1e3', () => {
    expect(fmtUsd(1000)).toBe('$1.0K');
    expect(fmtUsd(5500)).toBe('$5.5K');
  });

  it('plain dollars below 1k', () => {
    expect(fmtUsd(0)).toBe('$0.00');
    expect(fmtUsd(42.50)).toBe('$42.50');
  });

  it('opts.sign=true prefixes + on positive', () => {
    expect(fmtUsd(100, { sign: true })).toBe('+$100.00');
    expect(fmtUsd(2_000_000, { sign: true })).toBe('+$2.00M');
  });

  it('opts.sign=true does NOT double-prefix on negative', () => {
    expect(fmtUsd(-100, { sign: true })).toBe('$-100.00');
    // The function emits the natural '-' from the number itself,
    // without adding a '+'. Confirms no '+' on negatives.
    expect(fmtUsd(-100, { sign: true })).not.toContain('+');
  });

  it('opts.sign=true on zero does not add +', () => {
    expect(fmtUsd(0, { sign: true })).toBe('$0.00');
  });
});

describe('normalizeSymbol', () => {
  it('strips USDT suffix', () => {
    expect(normalizeSymbol('BTCUSDT')).toBe('BTC');
    expect(normalizeSymbol('ethusdt')).toBe('ETH');
  });

  it('strips USD suffix', () => {
    expect(normalizeSymbol('BTCUSD')).toBe('BTC');
  });

  it('strips -PERP suffix', () => {
    expect(normalizeSymbol('BTC-PERP')).toBe('BTC');
  });

  it('strips bare PERP suffix', () => {
    expect(normalizeSymbol('BTCPERP')).toBe('BTC');
  });

  it('uppercases', () => {
    expect(normalizeSymbol('btc')).toBe('BTC');
  });

  it('leaves clean base symbols alone', () => {
    expect(normalizeSymbol('BTC')).toBe('BTC');
    expect(normalizeSymbol('SOL')).toBe('SOL');
  });

  it('strips just the trailing suffix (does not touch interior)', () => {
    expect(normalizeSymbol('USDTUSDT')).toBe('USDT');
  });
});

describe('matchesSymbol', () => {
  it('cross-matches BTC with BTCUSDT', () => {
    expect(matchesSymbol('BTC', 'BTCUSDT')).toBe(true);
    expect(matchesSymbol('BTCUSDT', 'BTC')).toBe(true);
  });

  it('cross-matches BTCUSDT with BTC-PERP', () => {
    expect(matchesSymbol('BTCUSDT', 'BTC-PERP')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(matchesSymbol('btcusdt', 'BTC')).toBe(true);
  });

  it('rejects different bases', () => {
    expect(matchesSymbol('BTC', 'ETH')).toBe(false);
    expect(matchesSymbol('BTCUSDT', 'ETHUSDT')).toBe(false);
  });
});

describe('liquidationDistance', () => {
  it('returns null when either price is null/undefined', () => {
    expect(liquidationDistance(null, 100)).toBeNull();
    expect(liquidationDistance(100, null)).toBeNull();
    expect(liquidationDistance(undefined, undefined)).toBeNull();
  });

  it('returns null when markPrice is zero or negative', () => {
    expect(liquidationDistance(0, 50)).toBeNull();
    expect(liquidationDistance(-100, 50)).toBeNull();
  });

  it('returns null when either input is non-finite', () => {
    expect(liquidationDistance(NaN, 50)).toBeNull();
    expect(liquidationDistance(100, Infinity)).toBeNull();
  });

  it('classifies as danger when distance <2%', () => {
    const r = liquidationDistance(100, 99);
    expect(r!.pct).toBeCloseTo(1, 5);
    expect(r!.severity).toBe('danger');
  });

  it('classifies as caution at 2% <= dist < 5%', () => {
    const r = liquidationDistance(100, 97);
    expect(r!.pct).toBeCloseTo(3, 5);
    expect(r!.severity).toBe('caution');
  });

  it('classifies as safe at >=5%', () => {
    const r = liquidationDistance(100, 90);
    expect(r!.pct).toBeCloseTo(10, 5);
    expect(r!.severity).toBe('safe');
  });

  it('boundary at exactly 2% promotes from danger → caution', () => {
    const r = liquidationDistance(100, 98);
    expect(r!.severity).toBe('caution');
  });

  it('boundary at exactly 5% promotes from caution → safe', () => {
    const r = liquidationDistance(100, 95);
    expect(r!.severity).toBe('safe');
  });

  it('handles short positions (liq above mark)', () => {
    const r = liquidationDistance(100, 105);
    expect(r!.pct).toBeCloseTo(5, 5);
    expect(r!.severity).toBe('safe');
  });
});

describe('pnlPercentage', () => {
  it('returns null on missing inputs', () => {
    expect(pnlPercentage(null, 100)).toBeNull();
    expect(pnlPercentage(50, null)).toBeNull();
    expect(pnlPercentage(undefined, undefined)).toBeNull();
  });

  it('returns null when positionValue is zero (avoid div-by-zero)', () => {
    expect(pnlPercentage(100, 0)).toBeNull();
  });

  it('returns null on non-finite inputs', () => {
    expect(pnlPercentage(NaN, 100)).toBeNull();
    expect(pnlPercentage(100, NaN)).toBeNull();
    expect(pnlPercentage(Infinity, 100)).toBeNull();
  });

  it('computes positive pnl% on long position', () => {
    expect(pnlPercentage(10, 100)).toBeCloseTo(10, 5);
  });

  it('computes negative pnl% on losing position', () => {
    expect(pnlPercentage(-25, 100)).toBeCloseTo(-25, 5);
  });

  it('uses absolute position value (short positions ok)', () => {
    // A short with positionValue = -100 (some venues sign-flip)
    // and pnl = +10 should still report +10% gain
    expect(pnlPercentage(10, -100)).toBeCloseTo(10, 5);
  });
});
