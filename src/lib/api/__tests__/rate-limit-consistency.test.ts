import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FREE_TIER_PER_MINUTE,
  PRO_TIER_PER_MINUTE,
  FREE_TIER_PER_DAY,
} from '../rate-limit';

/**
 * Asserts marketing copy across the site matches the actual enforced
 * rate limits. If anyone bumps a tier in rate-limit.ts and forgets to
 * update the FAQ / developers page / README, this test breaks.
 */
describe('rate-limit constants — cross-surface consistency', () => {
  const root = join(__dirname, '..', '..', '..', '..');

  function readFile(rel: string): string {
    return readFileSync(join(root, rel), 'utf8');
  }

  it('constants are positive integers with sensible ordering', () => {
    expect(Number.isInteger(FREE_TIER_PER_MINUTE)).toBe(true);
    expect(Number.isInteger(PRO_TIER_PER_MINUTE)).toBe(true);
    expect(Number.isInteger(FREE_TIER_PER_DAY)).toBe(true);
    expect(FREE_TIER_PER_MINUTE).toBeGreaterThan(0);
    expect(PRO_TIER_PER_MINUTE).toBeGreaterThan(0);
    expect(FREE_TIER_PER_DAY).toBeGreaterThan(0);
    // Pro should be strictly higher than free
    expect(PRO_TIER_PER_MINUTE).toBeGreaterThan(FREE_TIER_PER_MINUTE);
    // Daily should be > per-minute (else there's no point in a daily cap)
    expect(FREE_TIER_PER_DAY).toBeGreaterThan(FREE_TIER_PER_MINUTE);
  });

  it('developers/page.tsx FAQ mentions the same free-tier numbers', () => {
    const devs = readFile('src/app/developers/page.tsx');
    // The FAQ entry should mention "100 requests per minute and 5,000 per day"
    // — both values should match the constants.
    expect(devs).toContain(`${FREE_TIER_PER_MINUTE} requests per minute`);
    expect(devs).toContain(`${FREE_TIER_PER_DAY.toLocaleString()} per day`);
  });

  it('README.md mentions the same free-tier numbers', () => {
    const readme = readFile('README.md');
    // README description format: "free tier (100 req/min, 5,000/day)"
    expect(readme).toMatch(new RegExp(`${FREE_TIER_PER_MINUTE} req/min`));
    expect(readme).toContain(`${FREE_TIER_PER_DAY.toLocaleString()}/day`);
  });

  it('FAQ entry mentions both tier numbers', () => {
    const faq = readFile('src/app/faq/page.tsx');
    if (faq.includes('Rate limits')) {
      // FAQ entry mentions "100 req/min (free) and 500 req/min (Pro)"
      expect(faq).toMatch(new RegExp(`${FREE_TIER_PER_MINUTE} req/min`));
      expect(faq).toMatch(new RegExp(`${PRO_TIER_PER_MINUTE} req/min`));
    }
  });

  it('layout.tsx JSON-LD references the rate-limit constants (literal or var)', () => {
    const layout = readFile('src/app/layout.tsx');
    if (!layout.includes('Free tier')) return;
    // Accept either the hardcoded literal OR the imported constant —
    // derivation is preferred but a stable literal would also be valid.
    const hasMinuteLiteral = layout.includes(`${FREE_TIER_PER_MINUTE} req/min`);
    const hasMinuteVar = layout.includes('FREE_TIER_PER_MINUTE');
    expect(hasMinuteLiteral || hasMinuteVar).toBe(true);

    const hasDailyLiteral = layout.includes(FREE_TIER_PER_DAY.toLocaleString());
    const hasDailyVar = layout.includes('FREE_TIER_PER_DAY');
    expect(hasDailyLiteral || hasDailyVar).toBe(true);
  });
});
