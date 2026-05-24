import { describe, it, expect } from 'vitest';
import {
  scoreIdea,
  starsForScore,
  isPushable,
  isSurfaceable,
  defaultHorizonForSetup,
  SIGNAL_WEIGHTS,
  type SignalInputs,
} from '../idea-scorer';

// Baseline = no signals firing. Every test layers signals on top of this.
const NEUTRAL: SignalInputs = {
  fundingPct: 0.005,
  fundingPctileAbs: 50,
  fundingSignFlipped4h: false,
  whaleNetUsd4h: 0,
  whaleCount4h: 0,
  oiDelta4hPct: 1,
  liqClusterDistPct: 999,
  basisSpreadMaxPct: 0,
  longShortRatio: 1.0,
  longShortPctileAbs: 50,
};

describe('idea-scorer', () => {
  describe('starsForScore', () => {
    it('maps 85+ → ★★★★', () => {
      expect(starsForScore(85)).toBe(4);
      expect(starsForScore(100)).toBe(4);
    });
    it('maps 70-84 → ★★★', () => {
      expect(starsForScore(70)).toBe(3);
      expect(starsForScore(84)).toBe(3);
    });
    it('maps 55-69 → ★★', () => {
      expect(starsForScore(55)).toBe(2);
      expect(starsForScore(69)).toBe(2);
    });
    it('maps <55 → hidden (0)', () => {
      expect(starsForScore(54)).toBe(0);
      expect(starsForScore(0)).toBe(0);
    });
  });

  describe('isPushable', () => {
    it('returns true at exactly 75 (the design-doc threshold)', () => {
      expect(isPushable(75)).toBe(true);
      expect(isPushable(74)).toBe(false);
    });
  });

  describe('isSurfaceable', () => {
    it('returns true at exactly 55', () => {
      expect(isSurfaceable(55)).toBe(true);
      expect(isSurfaceable(54)).toBe(false);
    });
  });

  describe('defaultHorizonForSetup', () => {
    it('funding_arb is 8h (one funding cycle)', () => {
      expect(defaultHorizonForSetup('funding_arb')).toBe(8);
    });
    it('liq_hunt is shorter than squeeze', () => {
      expect(defaultHorizonForSetup('liq_hunt')).toBeLessThan(defaultHorizonForSetup('squeeze'));
    });
    it('directional is the longest', () => {
      expect(defaultHorizonForSetup('directional')).toBeGreaterThan(
        defaultHorizonForSetup('squeeze'),
      );
    });
  });

  describe('scoreIdea — neutral inputs', () => {
    it('scores 0 when nothing fires', () => {
      const idea = scoreIdea('BTC', 'directional', 'long', NEUTRAL);
      expect(idea.score).toBe(0);
      expect(idea.signals).toEqual([]);
      expect(idea.stars).toBe(0);
    });
  });

  describe('funding signal', () => {
    it('rewards a long bias when funding is deeply negative (longs paid)', () => {
      const idea = scoreIdea('BTC', 'squeeze', 'long', {
        ...NEUTRAL,
        fundingPct: -0.04,
        fundingPctileAbs: 99,
      });
      expect(idea.signals.find(s => s.slug === 'funding')).toBeTruthy();
      expect(idea.score).toBeGreaterThan(0);
    });

    it('ignores funding when direction is wrong (long bias + positive funding)', () => {
      const idea = scoreIdea('BTC', 'squeeze', 'long', {
        ...NEUTRAL,
        fundingPct: 0.04,
        fundingPctileAbs: 99,
      });
      // Long bias + funding paid to longs (positive) shouldn't contribute
      expect(idea.signals.find(s => s.slug === 'funding')).toBeUndefined();
    });

    it('rewards sign-flip even at moderate percentile', () => {
      const idea = scoreIdea('BTC', 'squeeze', 'long', {
        ...NEUTRAL,
        fundingPct: -0.01,
        fundingPctileAbs: 60, // below 85 pctile floor
        fundingSignFlipped4h: true,
      });
      expect(idea.signals.find(s => s.slug === 'funding')).toBeTruthy();
    });

    it('caps funding contribution at SIGNAL_WEIGHTS.funding', () => {
      const idea = scoreIdea('BTC', 'squeeze', 'long', {
        ...NEUTRAL,
        fundingPct: -0.5,
        fundingPctileAbs: 100,
        fundingSignFlipped4h: true,
      });
      const fund = idea.signals.find(s => s.slug === 'funding')!;
      expect(fund.points).toBeLessThanOrEqual(SIGNAL_WEIGHTS.funding);
    });
  });

  describe('whale signal', () => {
    it('rewards long bias when whales added longs ≥ $20M with ≥ 2 wallets', () => {
      const idea = scoreIdea('ETH', 'directional', 'long', {
        ...NEUTRAL,
        whaleNetUsd4h: 42_000_000,
        whaleCount4h: 2,
      });
      expect(idea.signals.find(s => s.slug === 'whales')).toBeTruthy();
    });

    it('ignores whales when only 1 wallet contributed', () => {
      const idea = scoreIdea('ETH', 'directional', 'long', {
        ...NEUTRAL,
        whaleNetUsd4h: 100_000_000,
        whaleCount4h: 1,
      });
      expect(idea.signals.find(s => s.slug === 'whales')).toBeUndefined();
    });

    it('ignores whales when net flow under $20M', () => {
      const idea = scoreIdea('ETH', 'directional', 'long', {
        ...NEUTRAL,
        whaleNetUsd4h: 15_000_000,
        whaleCount4h: 5,
      });
      expect(idea.signals.find(s => s.slug === 'whales')).toBeUndefined();
    });

    it('rewards short bias when whales cut longs ≥ $20M', () => {
      const idea = scoreIdea('ETH', 'squeeze', 'short', {
        ...NEUTRAL,
        whaleNetUsd4h: -42_000_000,
        whaleCount4h: 3,
      });
      expect(idea.signals.find(s => s.slug === 'whales')).toBeTruthy();
    });
  });

  describe('OI + cluster signal', () => {
    it('requires BOTH OI ≥ 8% AND cluster within 3% to fire', () => {
      // OI only
      let idea = scoreIdea('BTC', 'liq_hunt', 'long', {
        ...NEUTRAL,
        oiDelta4hPct: 10,
        liqClusterDistPct: 5, // > 3% threshold
      });
      expect(idea.signals.find(s => s.slug === 'oi_cluster')).toBeUndefined();

      // Cluster only
      idea = scoreIdea('BTC', 'liq_hunt', 'long', {
        ...NEUTRAL,
        oiDelta4hPct: 2,
        liqClusterDistPct: 1,
      });
      expect(idea.signals.find(s => s.slug === 'oi_cluster')).toBeUndefined();

      // Both
      idea = scoreIdea('BTC', 'liq_hunt', 'long', {
        ...NEUTRAL,
        oiDelta4hPct: 10,
        liqClusterDistPct: 1,
      });
      expect(idea.signals.find(s => s.slug === 'oi_cluster')).toBeTruthy();
    });
  });

  describe('basis signal', () => {
    it('fires at 0.02% spread threshold', () => {
      let idea = scoreIdea('BTC', 'funding_arb', 'long', {
        ...NEUTRAL,
        basisSpreadMaxPct: 0.019,
      });
      expect(idea.signals.find(s => s.slug === 'basis')).toBeUndefined();
      idea = scoreIdea('BTC', 'funding_arb', 'long', {
        ...NEUTRAL,
        basisSpreadMaxPct: 0.025,
      });
      expect(idea.signals.find(s => s.slug === 'basis')).toBeTruthy();
    });
  });

  describe('L/S ratio (contrarian)', () => {
    it('rewards short bias when long-side is extremely long', () => {
      const idea = scoreIdea('BTC', 'directional', 'short', {
        ...NEUTRAL,
        longShortRatio: 1.8,
        longShortPctileAbs: 96,
      });
      expect(idea.signals.find(s => s.slug === 'long_short')).toBeTruthy();
    });

    it('does NOT reward long bias when long-side is extremely long (same-direction)', () => {
      const idea = scoreIdea('BTC', 'directional', 'long', {
        ...NEUTRAL,
        longShortRatio: 1.8,
        longShortPctileAbs: 96,
      });
      expect(idea.signals.find(s => s.slug === 'long_short')).toBeUndefined();
    });
  });

  describe('full stack — high conviction setup', () => {
    it('a fully-aligned extreme long setup scores ≥ 75 (push-eligible)', () => {
      // High-conviction = ALL signals at the deep-extreme end:
      //   funding -0.06% at 100th pctile + flipped
      //   $150M whale inflow / 4 wallets
      //   OI +20% / 4h with cluster 0.5% away
      //   basis 0.05% blowout
      //   L/S extremely short → contrarian long
      const idea = scoreIdea('BTC', 'squeeze', 'long', {
        ...NEUTRAL,
        fundingPct: -0.06,
        fundingPctileAbs: 100,
        fundingSignFlipped4h: true,
        whaleNetUsd4h: 150_000_000,
        whaleCount4h: 4,
        oiDelta4hPct: 20,
        liqClusterDistPct: 0.5,
        basisSpreadMaxPct: 0.05,
        longShortRatio: 0.55,        // shorts crowded → contrarian long
        longShortPctileAbs: 98,
      });
      expect(idea.score).toBeGreaterThanOrEqual(75);
      expect(isPushable(idea.score)).toBe(true);
    });

    it('a moderate 4-signal alignment scores ★★ (55-69) — not push-eligible', () => {
      // Tests the calibration: 4 signals at modest strengths shouldn't
      // trip the push threshold. Pinning this so a future scorer tweak
      // that raises floors gets caught.
      const idea = scoreIdea('BTC', 'squeeze', 'long', {
        ...NEUTRAL,
        fundingPct: -0.04,
        fundingPctileAbs: 99,
        fundingSignFlipped4h: true,
        whaleNetUsd4h: 50_000_000,
        whaleCount4h: 3,
        oiDelta4hPct: 12,
        liqClusterDistPct: 1.5,
        basisSpreadMaxPct: 0.025,
      });
      expect(idea.score).toBeGreaterThanOrEqual(55);
      expect(idea.score).toBeLessThan(75);
      expect(isPushable(idea.score)).toBe(false);
    });
  });

  describe('invalidation level', () => {
    it('is set when a cluster is nearby AND currentPrice is supplied', () => {
      const idea = scoreIdea('BTC', 'liq_hunt', 'long', {
        ...NEUTRAL,
        oiDelta4hPct: 10,
        liqClusterDistPct: 2,
      }, { currentPrice: 113_000 });
      expect(idea.invalidation).not.toBeNull();
      // Long-side invalidation is below price
      expect(idea.invalidation!).toBeLessThan(113_000);
    });

    it('is null when no cluster within 10%', () => {
      const idea = scoreIdea('BTC', 'liq_hunt', 'long', NEUTRAL, { currentPrice: 113_000 });
      expect(idea.invalidation).toBeNull();
    });
  });

  describe('deterministic', () => {
    it('same inputs produce same score every time', () => {
      const inputs: SignalInputs = {
        ...NEUTRAL,
        fundingPct: -0.03,
        fundingPctileAbs: 95,
        whaleNetUsd4h: 30_000_000,
        whaleCount4h: 2,
        oiDelta4hPct: 9,
        liqClusterDistPct: 2.5,
      };
      const a = scoreIdea('SOL', 'squeeze', 'long', inputs);
      const b = scoreIdea('SOL', 'squeeze', 'long', inputs);
      expect(a.score).toBe(b.score);
      expect(a.signals.length).toBe(b.signals.length);
    });
  });
});
