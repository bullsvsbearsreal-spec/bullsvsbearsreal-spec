/**
 * GET /api/news/social
 *
 * Public read endpoint for the social-feed UI. Returns recent KOL Twitter
 * posts sourced from `social_posts`, populated by the social-fetch cron.
 *
 *   ?limit=N    1..200, default 50
 *   ?handle=X   Optional case-insensitive filter (no '@' prefix)
 *
 * Cached at the CF edge (s-maxage=60) since the underlying data only
 * changes when the 15-min cron runs anyway.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isDBConfigured, getRecentSocialPosts } from '@/lib/db';
import { TWITTER_KOLS } from '@/lib/social/kols';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

// L1 in-memory cache. The underlying data only changes at the 15-min cron
// boundary, so even a 60s L1 prevents most DB hits when CF cache is warming.
interface CacheEntry {
  body: unknown;
  ts: number;
}
const l1Cache = new Map<string, CacheEntry>();
const L1_TTL = 60 * 1000;
const PUBLIC_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET(request: NextRequest) {
  if (!isDBConfigured()) {
    return NextResponse.json(
      { posts: [], count: 0, error: 'DATABASE_URL not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const sp = request.nextUrl.searchParams;
  const limitRaw = parseInt(sp.get('limit') || '50', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

  const handleRaw = sp.get('handle')?.trim();
  // Validate handle to avoid arbitrary string injection in cache keys + DB.
  // Twitter handles are alphanumeric + underscore, 1..15 chars.
  const handle =
    handleRaw && /^[A-Za-z0-9_]{1,15}$/.test(handleRaw)
      ? handleRaw.toLowerCase()
      : undefined;
  if (handleRaw && !handle) {
    return NextResponse.json(
      { error: 'Invalid handle — must be 1..15 alphanumeric/underscore chars' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const cacheKey = `${limit}:${handle ?? ''}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': PUBLIC_CACHE },
    });
  }

  const posts = await getRecentSocialPosts(limit, handle);

  const body = {
    posts: posts.map(p => ({
      id: p.id,
      handle: p.handle,
      displayName: p.displayName,
      body: p.body,
      // Don't ship bodyHtml to clients by default — it's larger and
      // potentially still has nitter-internal markup. Only client-side
      // embeds need it; expose via a separate ?include=html later if needed.
      link: p.link,
      pubDate: p.pubDate,
    })),
    count: posts.length,
    handles: handle ? [handle] : Array.from(TWITTER_KOLS).map(h => h.toLowerCase()),
    ts: Date.now(),
  };

  if (posts.length > 0) {
    l1Cache.set(cacheKey, { body, ts: Date.now() });
    if (l1Cache.size > 64) {
      const firstKey = l1Cache.keys().next().value;
      if (firstKey !== undefined) l1Cache.delete(firstKey);
    }
  }

  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': PUBLIC_CACHE },
  });
}
