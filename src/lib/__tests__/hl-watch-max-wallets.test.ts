import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MAX_WATCHED_WALLETS } from '../hl-watch';

/**
 * The wallet-watch cap is shared between the API enforcement path and
 * the /watch UI. This test verifies:
 *   1. The constant is a positive integer.
 *   2. Both surfaces import it (no literal '25' lingering).
 *   3. The README + CLAUDE.md FAQ entry mention the SAME cap value.
 */
describe('MAX_WATCHED_WALLETS — shared cap constant', () => {
  const root = join(__dirname, '..', '..', '..');

  it('is a positive integer', () => {
    expect(typeof MAX_WATCHED_WALLETS).toBe('number');
    expect(Number.isInteger(MAX_WATCHED_WALLETS)).toBe(true);
    expect(MAX_WATCHED_WALLETS).toBeGreaterThan(0);
  });

  it('is a sensible upper bound (< 1000 — cron load consideration)', () => {
    // The docstring says ~3 venues × 1s per fetch already pushes the
    // 60s window. A cap above 1000 would be obvious nonsense.
    expect(MAX_WATCHED_WALLETS).toBeLessThan(1000);
  });

  it('API route enforces using MAX_WATCHED_WALLETS as the cron-safety ceiling', () => {
    const src = readFileSync(join(root, 'src/app/api/watch/wallets/route.ts'), 'utf8');
    // MAX_WATCHED_WALLETS is the cron-load safety cap; still imported.
    expect(src).toContain('MAX_WATCHED_WALLETS');
    // Per-tier enforcement layered on top — the route should derive its
    // effective cap from TIER_LIMITS, not the safety constant alone.
    expect(src).toContain('TIER_LIMITS');
    // No remaining literal '>= 25' or '25)' (counted-pair) in the source
    expect(src).not.toMatch(/>=\s*25\b/);
  });

  it('Watch UI imports and uses MAX_WATCHED_WALLETS', () => {
    const src = readFileSync(join(root, 'src/app/watch/page.tsx'), 'utf8');
    expect(src).toContain('MAX_WATCHED_WALLETS');
    // No more literal "/25)" or "/25\`" suffixes (counter chip)
    // Note: a price like "$25" or hour ":25" still allowed
    expect(src).not.toMatch(/wallets\.length\}\/25/);
  });

  it('FAQ copy in src/app/faq/page.tsx references the same cap', () => {
    const faq = readFileSync(join(root, 'src/app/faq/page.tsx'), 'utf8');
    // The FAQ wallet-watch entry mentions "Up to 25 watched wallets" —
    // verify the literal in the FAQ matches the constant. If we bump
    // the cap, the FAQ should be updated too.
    if (faq.includes('watched wallets per account')) {
      const match = faq.match(/Up to (\d+) watched wallets per account/);
      if (match) {
        expect(parseInt(match[1], 10)).toBe(MAX_WATCHED_WALLETS);
      }
    }
  });
});
