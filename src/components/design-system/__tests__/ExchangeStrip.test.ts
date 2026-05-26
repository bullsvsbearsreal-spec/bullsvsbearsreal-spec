import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ALL_EXCHANGES } from '@/lib/constants/exchanges';

/**
 * Drift guard for the static EXCHANGES array inside ExchangeStrip.tsx.
 *
 * Background: the component renders one logo per slug from a hardcoded
 * array, because logo filenames don't map 1:1 to the display names in
 * ALL_EXCHANGES (case + dots + dashes). When a new exchange ships and
 * gets added to ALL_EXCHANGES, the strip silently shows one fewer
 * logo — caught only when someone visually counts the strip against
 * the "N venues" pill.
 *
 * Blofin shipped in May 2026 + was added to ALL_EXCHANGES but not the
 * strip. Strip showed 32 logos while the rest of the site said "33
 * venues". Fixed manually + locked in by this test.
 *
 * If you intentionally want to exclude an exchange from the brand
 * strip (e.g. because we don't have a logo asset for it), document
 * the exception below and bump the expected delta.
 */
describe('ExchangeStrip · brand logo array drift guard', () => {
  it('renders exactly ALL_EXCHANGES.length logos', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/design-system/ExchangeStrip.tsx'),
      'utf8',
    );
    // Pull every single-quoted lowercase slug inside the EXCHANGES = [ ... ] block.
    const match = src.match(/const EXCHANGES = \[([\s\S]*?)\]/);
    expect(match, 'EXCHANGES array not found — did the variable rename?').toBeTruthy();
    const block = match![1];
    const slugs = (block.match(/'[a-z0-9.-]+'/g) || []).map(s => s.slice(1, -1));
    expect(slugs.length).toBe(ALL_EXCHANGES.length);
  });
});
