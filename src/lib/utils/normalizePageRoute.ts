/**
 * Page-route normalizer for the /api/track-page-view beacon.
 *
 * Extracted from the route handler so the cardinality-control logic
 * (the most error-prone part — see the /bounce regression in commit
 * 977b710c → 8e5ade6f for why) can be unit-tested without spinning
 * up the route handler.
 *
 * Strategy:
 *   1. Strip query + hash, reject paths > 200 chars, drop API/internal
 *      paths (we never want them in page_views).
 *   2. Segment-level normalization: any segment shaped like a 0x...
 *      address, a long alphanumeric ID, or a 4+ digit number gets
 *      collapsed to a placeholder.
 *   3. Parent-path normalization: known dynamic routes like
 *      /symbol/[symbol], /coin/[id], /funding/[symbol] get their final
 *      segment replaced regardless of shape (the segment normalizer
 *      misses dictionary-word params like "bitcoin", "BTC", etc.).
 *
 * Routes that have fixed sub-pages alongside dynamic segments (like
 * /bounce, which has /bounce/leaderboard / /check / /claim AND
 * /bounce/0xAddr) are deliberately NOT in the parent-path collapse —
 * their 0x addresses get caught by the segment normalizer; their
 * fixed sub-pages stay distinct.
 *
 * Returns the normalized route or `null` if the input is invalid /
 * filtered out.
 */
export function normalizePageRoute(raw: string): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  // Strip query + hash
  const path = raw.split('?')[0].split('#')[0];
  if (path.length > 200) return null;
  // Drop API + internal Next paths
  if (path.startsWith('/api/') || path.startsWith('/_next/')) return null;

  // Segment-level normalization
  const segs = path.split('/').map(s => {
    if (!s) return s;
    if (/^0x[a-fA-F0-9]{6,}$/.test(s)) return '[address]';
    if (/^[a-zA-Z0-9]{20,}$/.test(s))  return '[id]';      // long ids
    if (/^[0-9]+$/.test(s) && s.length >= 4) return '[id]';  // numeric ids
    return s;
  });

  const norm = segs.join('/');
  // Parent-path normalization
  return norm
    .replace(/^\/symbol\/[^/]+$/,        '/symbol/[symbol]')
    .replace(/^\/trader\/[^/]+$/,        '/trader/[address]')
    .replace(/^\/wallet\/[^/]+$/,        '/wallet/[address]')
    .replace(/^\/u\/[^/]+$/,             '/u/[id]')
    .replace(/^\/coin\/[^/]+$/,          '/coin/[id]')
    .replace(/^\/funding\/[^/]+$/,       '/funding/[symbol]');
}
