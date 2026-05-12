/**
 * Tests for the auto-tweet event detectors. These are pure threshold
 * functions — the runner stays uncovered (DB + network) but the math
 * that decides what's tweet-worthy is locked down here.
 */

import { describe, it, expect } from 'vitest';
import {
  detectFundingExtremes, detectOISpikes, detectLiqCascades, THRESHOLDS,
} from '../events';

const NOW = 1_700_000_000_000;

describe('detectFundingExtremes', () => {
  it('emits when 8h-normalized rate exceeds +threshold', () => {
    const out = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'Binance', rate: THRESHOLDS.fundingExtreme + 0.0001, fundingInterval: '8h', ts: NOW },
    ], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('funding-extreme');
    expect(out[0].symbol).toBe('BTC');
    expect(out[0].venue).toBe('Binance');
    expect(out[0].metadata.direction).toBe('longs-pay');
  });

  it('emits when rate is below -threshold (shorts-pay)', () => {
    const out = detectFundingExtremes([
      { symbol: 'ETH', exchange: 'Bybit', rate: -(THRESHOLDS.fundingExtreme + 0.0001), fundingInterval: '8h', ts: NOW },
    ], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].metadata.direction).toBe('shorts-pay');
  });

  it('does NOT emit when below threshold', () => {
    const out = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'Binance', rate: 0.0005, fundingInterval: '8h', ts: NOW },
    ], NOW);
    expect(out).toEqual([]);
  });

  it('does NOT emit for non-major symbols', () => {
    const out = detectFundingExtremes([
      { symbol: 'WAGMI', exchange: 'Binance', rate: 0.005, fundingInterval: '8h', ts: NOW },
    ], NOW);
    expect(out).toEqual([]);
  });

  it('does NOT emit for non-major venues', () => {
    const out = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'WhiteBit', rate: 0.005, fundingInterval: '8h', ts: NOW },
    ], NOW);
    expect(out).toEqual([]);
  });

  it('normalises 1h funding to 8h before threshold check', () => {
    // 0.0002 per hour = 0.0016 per 8h = above threshold
    const out = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'Hyperliquid', rate: 0.0002, fundingInterval: '1h', ts: NOW },
    ], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBeCloseTo(0.0016, 6);
  });

  it('normalises 4h funding to 8h', () => {
    // 0.001 per 4h = 0.002 per 8h
    const out = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'Binance', rate: 0.001, fundingInterval: '4h', ts: NOW },
    ], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBeCloseTo(0.002, 6);
  });

  it('uses an 8h-bucketed eventId so reruns dedup', () => {
    const a = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'Binance', rate: 0.002, fundingInterval: '8h', ts: NOW },
    ], NOW);
    const b = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'Binance', rate: 0.002, fundingInterval: '8h', ts: NOW + 60_000 },
    ], NOW + 60_000); // 1 min later, same 8h window
    expect(a[0].eventId).toBe(b[0].eventId);
  });

  it('separate eventIds across longs-pay / shorts-pay direction', () => {
    const longs = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'Binance', rate: 0.002, fundingInterval: '8h', ts: NOW },
    ], NOW);
    const shorts = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'Binance', rate: -0.002, fundingInterval: '8h', ts: NOW },
    ], NOW);
    expect(longs[0].eventId).not.toBe(shorts[0].eventId);
  });

  it('skips non-finite rates without throwing', () => {
    const out = detectFundingExtremes([
      { symbol: 'BTC', exchange: 'Binance', rate: NaN, fundingInterval: '8h', ts: NOW },
      { symbol: 'BTC', exchange: 'Binance', rate: Infinity, fundingInterval: '8h', ts: NOW },
    ], NOW);
    expect(out).toEqual([]);
  });
});

describe('detectOISpikes', () => {
  const major = THRESHOLDS.oiSpikeMinUsd;

  it('emits build event when OI grows >threshold % on a major', () => {
    const out = detectOISpikes(
      [{ symbol: 'BTC', oiUsd: major * 1.1, ts: NOW }],
      [{ symbol: 'BTC', oiUsd: major, ts: NOW - 3600_000 }],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('oi-spike');
    expect(out[0].metadata.direction).toBe('build');
    expect(out[0].value).toBeCloseTo(10, 1);
  });

  it('emits unwind event when OI shrinks', () => {
    const out = detectOISpikes(
      [{ symbol: 'BTC', oiUsd: major, ts: NOW }],
      [{ symbol: 'BTC', oiUsd: major * 1.10, ts: NOW - 3600_000 }],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].metadata.direction).toBe('unwind');
    expect(out[0].value).toBeCloseTo(-9.09, 1);
  });

  it('skips symbols below the OI minimum (no shitcoin spam)', () => {
    const tiny = THRESHOLDS.oiSpikeMinUsd / 10;
    const out = detectOISpikes(
      [{ symbol: 'WAGMI', oiUsd: tiny * 2, ts: NOW }],
      [{ symbol: 'WAGMI', oiUsd: tiny, ts: NOW - 3600_000 }],
      NOW,
    );
    expect(out).toEqual([]);
  });

  it('skips when no prior datapoint for symbol', () => {
    const out = detectOISpikes(
      [{ symbol: 'BTC', oiUsd: major * 2, ts: NOW }],
      [],
      NOW,
    );
    expect(out).toEqual([]);
  });

  it('does NOT emit when pct change below threshold', () => {
    const out = detectOISpikes(
      [{ symbol: 'BTC', oiUsd: major * 1.01, ts: NOW }],
      [{ symbol: 'BTC', oiUsd: major, ts: NOW - 3600_000 }],
      NOW,
    );
    expect(out).toEqual([]);
  });
});

describe('detectLiqCascades', () => {
  const u = THRESHOLDS.liqCascadeUsd;

  it('emits when total liquidations in 5-min window exceeds threshold', () => {
    const out = detectLiqCascades([
      { symbol: 'BTC', side: 'long', valueUsd: u * 0.5, ts: NOW - 60_000 },
      { symbol: 'BTC', side: 'long', valueUsd: u * 0.6, ts: NOW - 120_000 },
    ], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('liq-cascade');
    expect(out[0].symbol).toBe('BTC');
    expect(out[0].value).toBeCloseTo(u * 1.1, 0);
  });

  it('does NOT emit when liquidations are outside the 5-min window', () => {
    const out = detectLiqCascades([
      { symbol: 'BTC', side: 'long', valueUsd: u * 2, ts: NOW - 10 * 60_000 },
    ], NOW);
    expect(out).toEqual([]);
  });

  it('classifies dominant side correctly', () => {
    const out = detectLiqCascades([
      { symbol: 'BTC', side: 'long',  valueUsd: u * 0.95, ts: NOW - 60_000 },
      { symbol: 'BTC', side: 'short', valueUsd: u * 0.15, ts: NOW - 30_000 },
    ], NOW);
    expect(out[0].metadata.dominantSide).toBe('long');
    expect(out[0].metadata.longSharePct as number).toBeGreaterThan(80);
  });

  it('classifies mixed when neither side dominates', () => {
    const out = detectLiqCascades([
      { symbol: 'BTC', side: 'long',  valueUsd: u * 0.55, ts: NOW - 60_000 },
      { symbol: 'BTC', side: 'short', valueUsd: u * 0.55, ts: NOW - 30_000 },
    ], NOW);
    expect(out[0].metadata.dominantSide).toBe('mixed');
  });

  it('groups separate symbols into separate events', () => {
    const out = detectLiqCascades([
      { symbol: 'BTC', side: 'long', valueUsd: u * 1.5, ts: NOW - 60_000 },
      { symbol: 'ETH', side: 'long', valueUsd: u * 1.5, ts: NOW - 60_000 },
    ], NOW);
    expect(out).toHaveLength(2);
    expect(new Set(out.map(e => e.symbol))).toEqual(new Set(['BTC', 'ETH']));
  });

  it('does NOT emit when single symbol total is below threshold', () => {
    const out = detectLiqCascades([
      { symbol: 'BTC', side: 'long', valueUsd: u * 0.4, ts: NOW - 60_000 },
      { symbol: 'BTC', side: 'long', valueUsd: u * 0.4, ts: NOW - 120_000 },
    ], NOW);
    expect(out).toEqual([]);
  });

  it('skips non-finite or non-positive value rows', () => {
    const out = detectLiqCascades([
      { symbol: 'BTC', side: 'long', valueUsd: NaN,    ts: NOW - 60_000 },
      { symbol: 'BTC', side: 'long', valueUsd: -1e9,   ts: NOW - 60_000 },
      { symbol: 'BTC', side: 'long', valueUsd: u * 2,  ts: NOW - 60_000 },
    ], NOW);
    // Only the valid row counts → total > threshold → 1 event
    expect(out).toHaveLength(1);
    expect(out[0].value).toBeCloseTo(u * 2, 0);
  });
});
