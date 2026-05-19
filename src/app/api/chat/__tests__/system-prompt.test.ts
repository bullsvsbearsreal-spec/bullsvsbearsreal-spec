import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../system-prompt';

describe('buildSystemPrompt', () => {
  it('includes today\'s date', () => {
    const prompt = buildSystemPrompt({});
    const year = String(new Date().getFullYear());
    expect(prompt).toContain(year);
  });

  it('introduces Hub as the assistant identity', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('Hub');
    expect(prompt).toContain('InfoHub');
  });

  it('mentions the exchange count (drives trust signal)', () => {
    const prompt = buildSystemPrompt({});
    // ALL_EXCHANGES is a non-trivial set — should be at least 30
    expect(prompt).toMatch(/\d+ exchanges/);
  });

  it('CEX + DEX counts in the prompt sum to the total exchange count', async () => {
    // Regression guard against the bug we just fixed (was 18+15 hardcoded
    // when actual is 14 DEX — total of 32 with 18 CEX). Parse the literal
    // numbers from the prompt and verify the math.
    const prompt = buildSystemPrompt({});
    const match = prompt.match(/(\d+) exchanges \((\d+) CEX \+ (\d+) DEX\)/);
    expect(match).not.toBeNull();
    if (match) {
      const [, total, cex, dex] = match.map(Number);
      expect(cex + dex).toBe(total);
      // ALL_EXCHANGES.length should match what the prompt reports
      const { ALL_EXCHANGES, DEX_EXCHANGES } = await import('@/lib/constants');
      expect(total).toBe(ALL_EXCHANGES.length);
      expect(dex).toBe(DEX_EXCHANGES.size);
    }
  });

  it('lists the banned filler phrases (preamble suppression)', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('BANNED');
    expect(prompt).toContain('Great question');
    expect(prompt).toContain('Let me explain');
    expect(prompt).toContain('Let\'s dive in');
  });

  it('includes the response-length rules (3-6 sentences max for analysis)', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('3-6 sentences');
  });

  it('declares the trade-setup contract (direction, entry, stop, target, R:R)', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('direction');
    expect(prompt).toContain('entry');
    expect(prompt).toContain('stop');
    expect(prompt).toContain('target');
    expect(prompt).toMatch(/R:R/);
  });

  it('contains tool strategy guidance', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('TOOL STRATEGY');
    // References specific tools — these MUST match tools.ts names
    expect(prompt).toContain('get_tickers');
    expect(prompt).toContain('get_funding_rates');
  });

  it('includes tool limitations (avoid overpromising)', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('TOOL LIMITATIONS');
    // The OKX-only constraint should be flagged
    expect(prompt).toMatch(/OKX (exchange )?only/);
  });

  describe('with context', () => {
    it('appends BTC price + change when provided', () => {
      const prompt = buildSystemPrompt({ btcPrice: 65000, btcChange: 2.5 });
      expect(prompt).toContain('BTC');
      expect(prompt).toContain('$65,000');
      expect(prompt).toContain('+2.50%');
    });

    it('formats negative BTC change with - sign (no double sign)', () => {
      const prompt = buildSystemPrompt({ btcPrice: 65000, btcChange: -3.2 });
      expect(prompt).toContain('-3.20%');
      expect(prompt).not.toContain('+-');
    });

    it('formats BTC OI in $B', () => {
      const prompt = buildSystemPrompt({ btcOI: 25.5e9 });
      expect(prompt).toContain('$25.50B');
    });

    it('appends Fear & Greed value + classification', () => {
      const prompt = buildSystemPrompt({
        fearGreed: { value: 72, classification: 'Greed' },
      });
      expect(prompt).toContain('72');
      expect(prompt).toContain('Greed');
    });

    it('appends user portfolio when present', () => {
      const prompt = buildSystemPrompt({
        portfolio: [
          { symbol: 'BTC', quantity: 0.5, avgPrice: 50000 },
          { symbol: 'ETH', quantity: 10, avgPrice: 3000 },
        ],
      });
      expect(prompt).toContain('USER PORTFOLIO');
      expect(prompt).toContain('0.5 BTC');
      expect(prompt).toContain('10 ETH');
    });

    it('appends user watchlist when present', () => {
      const prompt = buildSystemPrompt({ watchlist: ['BTC', 'ETH', 'SOL'] });
      expect(prompt).toContain('USER WATCHLIST');
      expect(prompt).toContain('BTC, ETH, SOL');
    });

    it('omits portfolio block when portfolio array is empty', () => {
      const prompt = buildSystemPrompt({ portfolio: [] });
      expect(prompt).not.toContain('USER PORTFOLIO');
    });

    it('omits watchlist block when watchlist array is empty', () => {
      const prompt = buildSystemPrompt({ watchlist: [] });
      expect(prompt).not.toContain('USER WATCHLIST');
    });

    it('omits MARKET NOW line when no live context is provided', () => {
      const prompt = buildSystemPrompt({});
      expect(prompt).not.toContain('MARKET NOW');
    });
  });

  it('mentions /chart deep-link URL params (s, tf, ac)', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('/chart');
    expect(prompt).toContain('s=');
    expect(prompt).toContain('tf=');
    expect(prompt).toContain('ac=');
  });
});
