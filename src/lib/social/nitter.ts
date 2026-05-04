/**
 * Nitter RSS fetcher.
 *
 * Nitter is a community-maintained Twitter mirror. Right now `nitter.net`
 * is the only public instance returning real data — others are dead or
 * 403-blocked. If `nitter.net` itself goes down, override via env var:
 *
 *   NITTER_BASE=https://your-self-hosted-nitter.example.com
 *
 * Or swap the whole fetcher in the cron handler to RSSHub / rss.app / X API.
 */
import type { SocialFetcher, SocialPost } from './types';

const NITTER_BASE = (process.env.NITTER_BASE || 'https://nitter.net').replace(/\/$/, '');

export const nitterFetcher: SocialFetcher = {
  name: 'nitter',
  async fetchHandle(handle: string): Promise<SocialPost[]> {
    const url = `${NITTER_BASE}/${encodeURIComponent(handle)}/rss`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'InfoHubSocialFetcher/1.0 (+https://info-hub.io)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) {
      throw new Error(`nitter ${handle}: HTTP ${res.status}`);
    }
    const xml = await res.text();
    if (!xml.includes('<item>')) {
      // No items at all — could be account suspended, private, or nitter
      // returning a stub. Surface it as a clean empty list, not an error.
      return [];
    }
    return parseRssXml(xml, handle);
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

function extractTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : undefined;
}

function cleanText(s: string): string {
  return s.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
}

function decodeEntities(s: string): string {
  return cleanText(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // last — must come after all others
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
