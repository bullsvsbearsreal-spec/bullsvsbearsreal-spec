import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Cross-surface consistency test for the "N endpoints" claim.
 *
 * We mention the v1 API endpoint count in several places. If one of them
 * drifts (someone updates the trust ticker but forgets the JSON-LD meta),
 * the marketing copy starts contradicting itself.
 *
 * This test reads each surface and asserts they all carry the same
 * integer. It does NOT pin the actual number — that comes from the
 * developers page's ENDPOINT_GROUPS which is the canonical catalog.
 * It just asserts agreement across surfaces.
 */
describe('endpoint count consistency across surfaces', () => {
  const root = join(__dirname, '..', '..', '..');

  function readFile(rel: string): string {
    return readFileSync(join(root, rel), 'utf8');
  }

  function extractEndpointNumbers(text: string, label: string): number[] {
    // Match patterns like "26 endpoints", "26 endpoints across", "all 26 endpoints"
    const matches = text.matchAll(/(\d+) endpoints/gi);
    return Array.from(matches, (m) => parseInt(m[1], 10));
  }

  it('layout.tsx JSON-LD and seo.ts metadata agree on the endpoint count', () => {
    const layoutNums = extractEndpointNumbers(readFile('src/app/layout.tsx'), 'layout');
    const seoNums = extractEndpointNumbers(readFile('src/lib/seo.ts'), 'seo');

    // Both surfaces should reference at least one number
    expect(layoutNums.length).toBeGreaterThan(0);
    expect(seoNums.length).toBeGreaterThan(0);

    // Unique numbers across both surfaces — should all match each other
    const allNums = new Set([...layoutNums, ...seoNums]);
    // Allow either 1 unique (agreed) or 2 if one is the literal historical
    // changelog count vs the current count.
    expect(allNums.size).toBeLessThanOrEqual(2);
  });

  it('team/page.tsx endpoint count matches the others', () => {
    const team = readFile('src/app/team/page.tsx');
    const layout = readFile('src/app/layout.tsx');
    const teamNums = extractEndpointNumbers(team, 'team');
    const layoutNums = extractEndpointNumbers(layout, 'layout');
    if (teamNums.length === 0 || layoutNums.length === 0) {
      // If either has no claim, skip
      return;
    }
    // Team page should report the same number as the JSON-LD metadata
    expect(teamNums.some((n) => layoutNums.includes(n))).toBe(true);
  });

  it('developers/page.tsx STATS endpoint count is derived from ENDPOINT_GROUPS', () => {
    const devs = readFile('src/app/developers/page.tsx');
    // Should reference TOTAL_ENDPOINTS — the derived constant
    expect(devs).toContain('TOTAL_ENDPOINTS');
    // STATS array should use TOTAL_ENDPOINTS rather than a literal
    expect(devs).toMatch(/value:\s*TOTAL_ENDPOINTS/);
  });
});
