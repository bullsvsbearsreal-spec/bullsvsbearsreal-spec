import { describe, it, expect } from 'vitest';
import {
  renderStars, renderIdea, renderBasket, renderMorningBrief, renderInvalidationClose,
} from '../idea-renderer';
import type { ScoredIdea } from '../idea-scorer';

const IDEA: ScoredIdea = {
  symbol: 'BTC',
  side: 'long',
  setupType: 'squeeze',
  score: 78,
  stars: 3,
  signals: [
    { label: 'Funding', slug: 'funding', points: 28, detail: 'Funding -0.040% (98th pctile)' },
    { label: 'Whales', slug: 'whales', points: 18, detail: '3 whales added $42M / 4h' },
    { label: 'OI + Cluster', slug: 'oi_cluster', points: 12, detail: 'OI +9.0% / 4h, cluster 1.5% away' },
    { label: 'Basis', slug: 'basis', points: 8, detail: 'Cross-venue funding spread 0.025%' },
  ],
  invalidation: 109_500,
  horizonH: 24,
};

describe('idea-renderer', () => {
  describe('renderStars', () => {
    it('returns 4 stars for stars=4', () => expect(renderStars(4)).toBe('★★★★'));
    it('returns 3 stars for stars=3', () => expect(renderStars(3)).toBe('★★★'));
    it('returns empty for stars=0', () => expect(renderStars(0)).toBe(''));
  });

  describe('renderIdea', () => {
    it('uses the sharp-trader voice (header, signals, invalidation, footer)', () => {
      const out = renderIdea(IDEA);
      expect(out).toContain('<b>BTC — long bias, ★★★</b>');
      expect(out).toContain('Funding -0.040% (98th pctile)');
      expect(out).toContain('3 whales added $42M / 4h');
      expect(out).toContain('coiled');
      expect(out).toContain('Stay above 109,500');
      expect(out).toContain('nfa · your risk');
    });

    it('renders "short bias" for short side ideas', () => {
      const short: ScoredIdea = { ...IDEA, side: 'short', invalidation: 115_000 };
      const out = renderIdea(short);
      expect(out).toContain('short bias');
      expect(out).toContain('Stay below 115,000');
    });

    it('adds push header when asPush=true', () => {
      const out = renderIdea(IDEA, { asPush: true });
      expect(out).toContain('🎯');
      expect(out).toContain('Setup forming');
    });

    it('inserts position warning when supplied', () => {
      const out = renderIdea(IDEA, { positionWarning: "You're already long $42k BTC" });
      expect(out).toContain('⚠');
      expect(out).toContain("You're already long");
    });

    it('skips invalidation line when null', () => {
      const noInval: ScoredIdea = { ...IDEA, invalidation: null };
      const out = renderIdea(noInval);
      expect(out).not.toContain('Stay above');
      expect(out).not.toContain('Stay below');
    });

    it('keeps the top-4 signals only (ignores 5th)', () => {
      const fiveSignals: ScoredIdea = {
        ...IDEA,
        signals: [
          ...IDEA.signals,
          { label: 'L/S', slug: 'long_short', points: 4, detail: 'L/S 1.5 (90th pctile)' },
        ],
      };
      const out = renderIdea(fiveSignals);
      // Lowest-points signal should be dropped (5th item, just 4 points)
      expect(out).not.toContain('L/S 1.5');
    });
  });

  describe('renderBasket', () => {
    it('adds an alt-list line when alts are non-empty', () => {
      const alts: ScoredIdea[] = [
        { ...IDEA, symbol: 'ETH', stars: 3, score: 72 },
        { ...IDEA, symbol: 'SOL', stars: 2, score: 60 },
      ];
      const out = renderBasket(IDEA, alts);
      expect(out).toContain('Same setup forming on:');
      expect(out).toContain('ETH ★★★');
      expect(out).toContain('SOL ★★');
    });

    it('falls through to plain renderIdea with no alts', () => {
      const out = renderBasket(IDEA, []);
      expect(out).not.toContain('Same setup');
    });
  });

  describe('renderMorningBrief', () => {
    it('shows top setups + regime', () => {
      const out = renderMorningBrief({
        date: new Date('2026-05-24T08:00:00Z'),
        ideas: [IDEA, { ...IDEA, symbol: 'ETH', score: 71, stars: 3 }],
        regime: 'risk-on · funding median +0.012%',
      });
      expect(out).toContain('Morning Brief');
      expect(out).toContain('Top setups');
      expect(out).toContain('1. BTC long');
      expect(out).toContain('2. ETH long');
      expect(out).toContain('Regime: risk-on');
      expect(out).toContain('nfa');
    });

    it('renders a quiet morning when no ideas', () => {
      const out = renderMorningBrief({
        date: new Date(),
        ideas: [],
        regime: 'balanced',
      });
      expect(out).toContain('No high-conviction setups');
    });
  });

  describe('renderInvalidationClose', () => {
    it('produces the close-out message format', () => {
      const out = renderInvalidationClose('BTC', 'long', 109_500);
      expect(out).toContain('BTC long invalidated');
      expect(out).toContain('109,500');
      expect(out).toContain('Closing');
    });
  });
});
