/**
 * Regression tests for the field-name mapping that broke /earnings-calendar
 * (commit 0a5758bd). The page rendered 117/118 events as "unknown" with
 * usdImpact=null because the upstream /api/token-unlocks returns
 * coinSymbol/coinName/unlockAmount/unlockValue/source — not the
 * symbol/name/tokensUnlocked/priceUsd/url the lib was reading.
 */
import { describe, it, expect } from 'vitest';
import { mapUnlockToEvent } from '../earnings-calendar';

describe('mapUnlockToEvent — current /api/token-unlocks shape', () => {
  it('reads coinSymbol/coinName/unlockAmount/unlockValue correctly', () => {
    const raw = {
      id: 'arb-1',
      coinId: 'arbitrum',
      coinSymbol: 'ARB',
      coinName: 'Arbitrum',
      unlockDate: '2026-12-31T00:00:00.000Z',
      unlockAmount: 92_650_000,
      unlockValue: 11_834_555.1,
      percentOfSupply: 0.93,
      unlockType: 'investor',
      description: 'Series B investor vesting release',
      source: 'https://docs.arbitrum.foundation/airdrop-eligibility-distribution',
      isLarge: false,
    };

    const ev = mapUnlockToEvent(raw);

    expect(ev.type).toBe('unlock');
    expect(ev.symbol).toBe('ARB');
    expect(ev.name).toBe('Arbitrum');
    expect(ev.usdImpact).toBe(11_834_555.1);
    expect(ev.description).toBe('Series B investor vesting release');
    expect(ev.url).toMatch(/^https:\/\/docs\.arbitrum/);
    expect(ev.id).toBe('unlock-arbitrum-2026-12-31T00:00:00.000Z');
    expect(ev.source).toBe('TokenUnlocks');
  });

  it('falls back to legacy field names when modern ones are absent', () => {
    // Defensive — keeps the lib working if the upstream renames back.
    const raw = {
      coinId: 'old-format',
      symbol: 'OLD',
      name: 'Old Format',
      unlockDate: '2026-12-31',
      tokensUnlocked: 1000,
      priceUsd: 50,
      url: 'https://example.com/old',
    };

    const ev = mapUnlockToEvent(raw);

    expect(ev.symbol).toBe('OLD');
    expect(ev.name).toBe('Old Format');
    // 1000 tokens * $50 = $50k computed when unlockValue is missing
    expect(ev.usdImpact).toBe(50_000);
    expect(ev.url).toBe('https://example.com/old');
  });

  it('shows "unknown" only when both coinName and symbol are missing', () => {
    const raw = {
      coinId: 'mystery',
      unlockDate: '2026-06-15',
    };

    const ev = mapUnlockToEvent(raw);

    expect(ev.symbol).toBeNull();
    expect(ev.name).toBe('unknown');
    expect(ev.usdImpact).toBeNull();
  });

  it('uses symbol as name fallback before "unknown"', () => {
    const raw = {
      coinId: 'with-symbol-only',
      coinSymbol: 'XYZ',
      unlockDate: '2026-06-15',
    };

    const ev = mapUnlockToEvent(raw);

    expect(ev.symbol).toBe('XYZ');
    expect(ev.name).toBe('XYZ'); // not "unknown"
  });

  it('truncates date to YYYY-MM-DD', () => {
    const raw = {
      coinSymbol: 'ETH',
      unlockDate: '2026-05-08T14:30:45.000Z',
    };

    const ev = mapUnlockToEvent(raw);

    expect(ev.date).toBe('2026-05-08');
  });

  it('only treats source as url when it starts with http', () => {
    // Bug: earlier this used u.url which doesn't exist in the upstream.
    // Now reads u.source if it's a URL, falls back to u.url for legacy.
    const httpsSource = mapUnlockToEvent({
      coinSymbol: 'A',
      unlockDate: '2026-06-15',
      source: 'https://example.com/page',
    });
    expect(httpsSource.url).toBe('https://example.com/page');

    const labelSource = mapUnlockToEvent({
      coinSymbol: 'B',
      unlockDate: '2026-06-15',
      source: 'TokenUnlocks',
      url: 'https://fallback.com',
    });
    expect(labelSource.url).toBe('https://fallback.com');
  });
});
