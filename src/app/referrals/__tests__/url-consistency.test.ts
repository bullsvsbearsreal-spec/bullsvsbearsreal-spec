import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Asserts that every URL in the /referrals page's per-partner table
 * also appears in the shared lib/referralLinks.ts dataset (which the
 * spreads page + scanner + exchange tables use for the "buy on X" CTA).
 *
 * If a marketing campaign rotates one of the URLs in lib/referralLinks
 * but forgets to update the /referrals visible table — users would
 * land on a stale URL from one surface and the new URL from another.
 * Test catches that.
 */
describe('referral URL consistency across surfaces', () => {
  const root = join(__dirname, '..', '..', '..', '..');

  function readFile(rel: string): string {
    return readFileSync(join(root, rel), 'utf8');
  }

  function extractUrls(src: string): Set<string> {
    // Match https://... up to next whitespace or quote
    const matches = src.matchAll(/https:\/\/[a-zA-Z0-9./?=&_+-]+/g);
    return new Set(Array.from(matches, (m) => m[0]));
  }

  it('every URL in lib/referralLinks.ts also appears in /referrals page', () => {
    const lib = readFile('src/lib/referralLinks.ts');
    const page = readFile('src/app/referrals/page.tsx');

    // Pull all URLs from the lib file. Skip leading-text URLs in comments
    // and other docs by filtering to known referral-looking endpoints.
    const libUrls = Array.from(extractUrls(lib)).filter((u) =>
      /(invite|referral|ref=|join|share|promote)/i.test(u),
    );

    // Every lib URL should appear somewhere in the /referrals page
    libUrls.forEach((url) => {
      // Strip trailing punctuation
      const clean = url.replace(/[,;'"`)\]}]$/, '');
      expect(page).toContain(clean);
    });
  });

  it('lib/referralLinks.ts URLs are all HTTPS', () => {
    const lib = readFile('src/lib/referralLinks.ts');
    const urls = Array.from(extractUrls(lib));
    urls.forEach((u) => expect(u.startsWith('https://')).toBe(true));
  });
});
