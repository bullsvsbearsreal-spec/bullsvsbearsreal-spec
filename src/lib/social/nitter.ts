/**
 * Nitter RSS fetcher with multi-instance failover.
 *
 * Why multi-instance: nitter.net has been intermittently rate-limiting
 * datacenter IPs (incl. our droplet) since late 2025. Hitting a single
 * mirror means the feed silently goes empty. We rotate through several
 * known-good public mirrors and accept the first one that returns items.
 *
 * Override the order via env:
 *   NITTER_INSTANCES=https://a.example,https://b.example,...
 *
 * Or swap the whole fetcher in the cron handler to RSSHub / rss.app / X API.
 */
import type { SocialFetcher, SocialPost } from './types';

// Default instance list, ordered by reliability (May 2026 snapshot).
// xcancel.com and nitter.privacydev.net have been the most stable for
// datacenter IPs; nitter.net and nitter.poast.org as backups.
const DEFAULT_INSTANCES = [
  'https://xcancel.com',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.net',
];

const NITTER_INSTANCES: string[] = (() => {
  const raw = process.env.NITTER_INSTANCES;
  if (raw && raw.trim()) {
    return raw.split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  }
  return DEFAULT_INSTANCES.map(u => u.replace(/\/$/, ''));
})();

// Browser UA — many mirrors block obvious bot UAs.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 12_000;

export const nitterFetcher: SocialFetcher = {
  name: 'nitter',
  async fetchHandle(handle: string): Promise<SocialPost[]> {
    let lastErr: unknown = null;
    for (const base of NITTER_INSTANCES) {
      const url = `${base}/${encodeURIComponent(handle)}/rss`;
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          // Cache-bust to avoid edge / Cloudflare staleness on the mirror's side
          cache: 'no-store',
          headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        if (!res.ok) {
          lastErr = new Error(`${base} ${handle}: HTTP ${res.status}`);
          continue;
        }
        const xml = await res.text();
        // Some mirrors return HTML 200s with rate-limit / captcha pages.
        // Real RSS will start with `<?xml` and contain `<rss` / `<channel`.
        if (!/^<\?xml/i.test(xml.trim()) && !/<rss[\s>]|<channel>/.test(xml)) {
          lastErr = new Error(`${base} ${handle}: non-RSS response (likely rate-limit)`);
          continue;
        }
        if (!xml.includes('<item>')) {
          // Empty channel — could mean zero posts, suspended, or stub. Treat
          // as a clean empty list so we don't spam errors. If ALL mirrors say
          // empty, the watchdog (>12h stale) catches it later.
          return [];
        }
        const posts = parseRssXml(xml, handle);
        if (posts.length > 0) return posts;
        // 0 parseable posts — try next mirror
        lastErr = new Error(`${base} ${handle}: 0 parseable posts`);
      } catch (e) {
        lastErr = e;
        // Fall through to next instance
      }
    }
    throw new Error(
      `nitter ${handle}: all ${NITTER_INSTANCES.length} instances failed — ` +
      `last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
    );
  },
};

// ─── RSS parsing ──────────────────────────────────────────────────────────
// We use targeted regex rather than a full XML parser. RSS shape is stable
// and adding xml2js / fast-xml-parser as a dep isn't justified for one feed.

function parseRssXml(xml: string, handle: string): SocialPost[] {
  const handleLower = handle.toLowerCase();

  // Extract feed-level title for display name (e.g. "ZachXBT / @zachxbt")
  const channelTitleMatch = xml.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/);
  const displayName = channelTitleMatch
    ? cleanText(channelTitleMatch[1]).split('/')[0].trim() || undefined
    : undefined;

  const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  const posts: SocialPost[] = [];

  for (const block of itemBlocks) {
    const link = cleanText(extractTag(block, 'link') || '');
    const pubDateStr = cleanText(extractTag(block, 'pubDate') || '');
    const descRaw = extractTag(block, 'description') || '';
    const titleRaw = extractTag(block, 'title') || '';

    const pubDate = new Date(pubDateStr);
    if (!Number.isFinite(pubDate.getTime())) continue;

    // Pull the tweet's numeric id out of the link path:
    //   https://nitter.net/zachxbt/status/1234567890#m → 1234567890
    const idMatch = link.match(/\/status\/(\d+)/);
    const tweetId = idMatch ? idMatch[1] : String(pubDate.getTime());
    const id = `${handleLower}_${tweetId}`;

    // Rewrite nitter URL → canonical x.com URL so links don't depend on us.
    const xLink = link.replace(/^https?:\/\/[^/]+/, 'https://x.com').replace(/#\w+$/, '');

    // Body: prefer description (full text + media), fall back to title.
    // Strip HTML for the plain `body`; keep raw for `bodyHtml`.
    const bodyHtml = decodeEntities(descRaw) || decodeEntities(titleRaw);
    let body = stripHtml(bodyHtml);

    // Strip RT prefix that nitter prepends ("R to @user: ..." or "RT by @user: ...")
    body = body.replace(/^R(?:T)?\s*(?:by|to)?\s*@\w+:\s*/i, '').trim();

    if (body.length === 0) continue;

    posts.push({
      id,
      handle: handleLower,
      displayName,
      body,
      bodyHtml,
      link: xLink,
      pubDate,
    });
  }

  return posts;
}

export function extractTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : undefined;
}

export function cleanText(s: string): string {
  return s.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
}

/**
 * Decode common HTML entities. Critical ordering: `&amp;` MUST decode
 * LAST. Otherwise text like `&amp;lt;` would decode to `&lt;` and then
 * to `<`, producing `<` from what should have stayed `&lt;` (a literal
 * "&lt;" in the source). The current order ensures we only un-escape
 * one layer of entity encoding.
 */
export function decodeEntities(s: string): string {
  return cleanText(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // last — must come after all others
}

export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
