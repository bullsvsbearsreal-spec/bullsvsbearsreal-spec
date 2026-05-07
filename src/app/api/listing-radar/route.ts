/**
 * GET /api/listing-radar
 *
 * Pre-listing leak tracker: aggregates Binance announcement catalogs
 * (new listings + delistings), classifies by type, extracts tickers.
 *
 * Cache: 5 min in-process. Listings move slowly enough.
 *
 * Debug: ?debug=1 returns the raw upstream response shape so we can
 * triage why prod returns 0 events when local works fine. Strips any
 * sensitive bits.
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildListingRadar } from '@/lib/listing-radar';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

let l1: { ts: number; body: any } | null = null;
const L1_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  // Diagnostic mode — bypass cache, hit Binance directly + via proxy,
  // report what each path returned. Used to triage geo-blocking issues.
  if (request.nextUrl.searchParams.get('debug') === '1') {
    const target = 'https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=48&pageNo=1&pageSize=5';
    const proxyUrlRaw = (process.env.PROXY_URL || '').trim();
    const proxiedUrl = proxyUrlRaw && proxyUrlRaw.startsWith('https://')
      ? `${proxyUrlRaw.replace(/\/$/, '')}/?url=${encodeURIComponent(target)}`
      : null;

    const probe = async (url: string, label: string) => {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(8_000),
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          },
        });
        const status = res.status;
        const contentType = res.headers.get('content-type');
        let bodyShape: any = null;
        try {
          const j = await res.json();
          bodyShape = {
            code: j?.code,
            message: j?.message?.slice?.(0, 100) ?? null,
            articleCount: j?.data?.catalogs?.[0]?.articles?.length ?? null,
            firstTitle: j?.data?.catalogs?.[0]?.articles?.[0]?.title?.slice(0, 80) ?? null,
          };
        } catch {
          bodyShape = { error: 'non-JSON response' };
        }
        return { label, url: url.slice(0, 100), status, contentType, bodyShape };
      } catch (e) {
        return { label, url: url.slice(0, 100), error: e instanceof Error ? e.message : 'fetch failed' };
      }
    };

    const direct = await probe(target, 'direct');
    const proxied = proxiedUrl ? await probe(proxiedUrl, 'proxied') : { label: 'proxied', skipped: 'PROXY_URL not configured' };

    return NextResponse.json({
      proxyConfigured: !!proxyUrlRaw,
      probes: [direct, proxied],
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  }
  const feed = await buildListingRadar();
  if (feed.events.length > 0) l1 = { ts: feed.ts, body: feed };
  return NextResponse.json(feed, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': feed.events.length > 0
        ? 'public, s-maxage=300, stale-while-revalidate=900'
        : 'no-store',
    },
  });
}
