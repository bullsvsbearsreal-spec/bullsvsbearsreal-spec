/**
 * Tests for the GMX market metadata parsers — they translate raw on-chain
 * data into the labels + USD prices on /gmx and /wallet (when GMX positions
 * are detected). The two riskiest pure functions:
 *
 *   parseMarketName: parses GMX's idiosyncratic naming
 *     ("BTC/USD [WBTC.b-USDC]") into symbol / pair / collateralPair /
 *     isDeprecated. A regression here mis-labels markets in the UI.
 *
 *   inferDecimals: GMX stores prices as `usd_price * 1e30 / 10^decimals`
 *     with decimals ∈ {6, 8, 9, 18}. The function picks the decimals
 *     that yield a price in a plausible crypto range. A regression
 *     would give the wrong magnitude (BTC at $74 instead of $74k or
 *     $740k instead of $74k).
 */
import { describe, it, expect } from 'vitest';
import { parseMarketName, inferDecimals } from '../markets';

describe('parseMarketName', () => {
  it('parses a typical "TOKEN/USD [COLLAT-USDC]" name', () => {
    const r = parseMarketName('BTC/USD [WBTC.b-USDC]');
    expect(r.symbol).toBe('BTC');
    expect(r.pair).toBe('BTC-USD');
    expect(r.collateralPair).toBe('WBTC.b-USDC');
    expect(r.isDeprecated).toBe(false);
  });

  it('parses ETH and SOL markets', () => {
    expect(parseMarketName('ETH/USD [WETH-USDC]')).toEqual({
      symbol: 'ETH', pair: 'ETH-USD', collateralPair: 'WETH-USDC', isDeprecated: false,
    });
    expect(parseMarketName('SOL/USD [SOL-USDC]')).toEqual({
      symbol: 'SOL', pair: 'SOL-USD', collateralPair: 'SOL-USDC', isDeprecated: false,
    });
  });

  it('detects "deprecated" tag (case-insensitive)', () => {
    expect(parseMarketName('XRP/USD [WBTC.b-USDC] deprecated').isDeprecated).toBe(true);
    expect(parseMarketName('XRP/USD [WBTC.b-USDC] DEPRECATED').isDeprecated).toBe(true);
    expect(parseMarketName('XRP/USD [WBTC.b-USDC] (Deprecated)').isDeprecated).toBe(true);
  });

  it('handles names without a bracket section (returns empty collateralPair)', () => {
    const r = parseMarketName('BTC/USD');
    expect(r.symbol).toBe('BTC');
    expect(r.pair).toBe('BTC-USD');
    expect(r.collateralPair).toBe('');
  });

  it('handles names without a slash', () => {
    // Some swap-only markets are just "WETH-USDC" without a "/USD" pair.
    const r = parseMarketName('WETH-USDC');
    // No slash → primary stays as-is, symbol is the whole primary, pair has dash already
    expect(r.symbol).toBe('WETH-USDC');
    expect(r.pair).toBe('WETH-USDC');
  });
});

describe('inferDecimals — picks the highest-magnitude plausible price', () => {
  it('infers 8 decimals for BTC at ~$74,000', () => {
    // BTC raw on GMX: priceUsd × (1e30 / 1e8) = priceUsd × 1e22.
    // For $74,000 → raw = 74000 * 1e22 = "740000000000000000000000000".
    const raw = '740000000000000000000000000'; // 74000 * 1e22
    const r = inferDecimals(raw);
    expect(r.decimals).toBe(8);
    expect(r.priceUsd).toBeCloseTo(74_000, 0);
  });

  it('infers 18 decimals for ETH at ~$3,500', () => {
    // ETH on GMX uses 18 decimals: raw = priceUsd × 1e12.
    const raw = '3500000000000000'; // 3500 * 1e12
    const r = inferDecimals(raw);
    expect(r.decimals).toBe(18);
    expect(r.priceUsd).toBeCloseTo(3_500, 0);
  });

  it('always picks the higher-magnitude reading when ambiguous', () => {
    // raw 1e24 is genuinely ambiguous between $1@6dec, $100@8dec,
    // $1000@9dec, $1e12@18dec. The function's documented behaviour is
    // "highest plausible magnitude wins" so it returns $1000 (9 dec).
    // Stablecoin price recovery has to come from a different source —
    // do NOT rely on inferDecimals to identify stables.
    const raw = '1000000000000000000000000'; // 1 * 1e24
    const r = inferDecimals(raw);
    expect(r.decimals).toBe(9);
    expect(r.priceUsd).toBeCloseTo(1000, 0);
  });

  it('returns priceUsd=0 for invalid raw input', () => {
    expect(inferDecimals('not-a-number').priceUsd).toBe(0);
    expect(inferDecimals('').priceUsd).toBe(0);
    expect(inferDecimals('0').priceUsd).toBe(0);
    expect(inferDecimals('-100').priceUsd).toBe(0); // negative bigint
  });

  it('rejects implausibly large inferred prices (out-of-range)', () => {
    // A raw value too big for any of the 4 decimal sets to land < $500k.
    // Should fall through to default (decimals=18, priceUsd=0).
    const r = inferDecimals('999999999999999999999999999999999999999');
    // No candidate yields a price in range → priceUsd stays 0.
    expect(r.priceUsd).toBe(0);
  });
});
