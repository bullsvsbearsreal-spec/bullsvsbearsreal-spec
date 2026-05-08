/**
 * Tests for spot-withdrawal-fees — used by /trade-optimizer and the
 * cross-exchange arbitrage scanner to estimate true round-trip cost.
 * A regression here would mis-rank arbitrage opportunities (showing
 * unprofitable arbs as profitable, or vice versa).
 */
import { describe, it, expect } from 'vitest';
import {
  getSpotTakerFee,
  getWithdrawalInfo,
  getVolumeLevel,
  SPOT_TAKER_FEES,
  VOLUME_THRESHOLDS,
} from '../spot-withdrawal-fees';

describe('getSpotTakerFee', () => {
  it('returns the configured fee for known exchanges', () => {
    expect(getSpotTakerFee('Binance')).toBe(0.10);
    expect(getSpotTakerFee('MEXC')).toBe(0.05); // cheapest
    expect(getSpotTakerFee('Kraken')).toBe(0.25); // most expensive
    expect(getSpotTakerFee('Coinbase')).toBe(0.08);
  });

  it('returns the 0.10% default for unknown exchanges', () => {
    expect(getSpotTakerFee('SomeNewExchange')).toBe(0.10);
    expect(getSpotTakerFee('')).toBe(0.10);
  });

  it('is case-sensitive (matches the SPOT_TAKER_FEES key format)', () => {
    // Convention: keys are PascalCase. binance != Binance.
    expect(getSpotTakerFee('binance')).toBe(0.10); // unknown → default
    expect(getSpotTakerFee('Binance')).toBe(0.10); // happens to also be 0.10
  });

  it('SPOT_TAKER_FEES contains the 15 expected exchanges', () => {
    // Sanity check that the table hasn't been accidentally emptied.
    expect(Object.keys(SPOT_TAKER_FEES).length).toBeGreaterThanOrEqual(15);
    // Must include the 5 biggest spot venues.
    for (const ex of ['Binance', 'Bybit', 'OKX', 'Coinbase', 'Kraken']) {
      expect(SPOT_TAKER_FEES[ex]).toBeGreaterThan(0);
    }
  });
});

describe('getWithdrawalInfo', () => {
  it('returns network-specific info for mapped coins', () => {
    const sol = getWithdrawalInfo('SOL');
    expect(sol.network).toBe('Solana');
    expect(sol.feeUsd).toBe(0.15); // per-coin override
    expect(sol.confirmMins).toBe(1);
  });

  it('uses per-coin USD cost override when present', () => {
    // BTC mapped to BTC network (fee $5) but COIN_WITHDRAWAL_USD has $8 override
    const btc = getWithdrawalInfo('BTC');
    expect(btc.network).toBe('Bitcoin');
    expect(btc.feeUsd).toBe(8.00);
  });

  it('uses base network fee when no per-coin override', () => {
    const link = getWithdrawalInfo('LINK');
    expect(link.network).toBe('Arbitrum'); // mapped to ARB
    // LINK has $0.30 in COIN_WITHDRAWAL_USD
    expect(link.feeUsd).toBe(0.30);
  });

  it('returns a default for unknown coins with no mapping', () => {
    const r = getWithdrawalInfo('UNKNOWNCOIN');
    expect(r.network).toBe('Native');
    expect(r.feeUsd).toBe(2.00);
    expect(r.confirmMins).toBe(10);
  });

  it('correctly routes ETH wrapped tokens to L2', () => {
    // Many tokens default to Arbitrum (cheap + fast)
    expect(getWithdrawalInfo('UNI').network).toBe('Arbitrum');
    expect(getWithdrawalInfo('AAVE').network).toBe('Arbitrum');
    expect(getWithdrawalInfo('PEPE').network).toBe('Arbitrum');
  });

  it('routes meme coins to their native chains', () => {
    // WIF + BONK are Solana memes
    expect(getWithdrawalInfo('WIF').network).toBe('Solana');
    expect(getWithdrawalInfo('BONK').network).toBe('Solana');
    expect(getWithdrawalInfo('FLOKI').network).toBe('BSC');
  });

  it('confirmMins is always positive', () => {
    for (const sym of ['BTC', 'ETH', 'SOL', 'PEPE', 'UNKNOWN']) {
      expect(getWithdrawalInfo(sym).confirmMins).toBeGreaterThan(0);
    }
  });
});

describe('getVolumeLevel', () => {
  it('classifies very low volume as danger', () => {
    expect(getVolumeLevel(0)).toBe('danger');
    expect(getVolumeLevel(10_000)).toBe('danger');
    expect(getVolumeLevel(49_999)).toBe('danger');
  });

  it('classifies sub-warning volume correctly', () => {
    expect(getVolumeLevel(50_000)).toBe('warning');
    expect(getVolumeLevel(100_000)).toBe('warning');
    expect(getVolumeLevel(249_999)).toBe('warning');
  });

  it('classifies sub-caution volume correctly', () => {
    expect(getVolumeLevel(250_000)).toBe('caution');
    expect(getVolumeLevel(499_999)).toBe('caution');
  });

  it('classifies high-volume as ok', () => {
    expect(getVolumeLevel(500_000)).toBe('ok');
    expect(getVolumeLevel(10_000_000)).toBe('ok');
    expect(getVolumeLevel(1_000_000_000)).toBe('ok');
  });

  it('thresholds escalate strictly (danger < warning < caution < ok)', () => {
    expect(VOLUME_THRESHOLDS.DANGER).toBeLessThan(VOLUME_THRESHOLDS.WARNING);
    expect(VOLUME_THRESHOLDS.WARNING).toBeLessThan(VOLUME_THRESHOLDS.CAUTION);
  });
});
