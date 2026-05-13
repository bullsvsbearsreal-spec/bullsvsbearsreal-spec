/**
 * GET /api/trending-tokens
 *
 * Trending / boosted tokens across chains, enriched with live pair data
 * (price, volume, txns, marketcap, age) from DexScreener's free API.
 *
 * Upstream:
 *   GET https://api.dexscreener.com/token-boosts/latest/v1
 *   GET https://api.dexscreener.com/latest/dex/tokens/{address}
 *
 * Query params:
 *   chain  — 'all' | 'solana' | 'ethereum' | 'base' | 'bsc' | etc. (default: all)
 *   limit  — 1..60 (default 30)
 *   sort   — 'boost' | 'volume' | 'change' | 'age' (default: boost)
 *
 * Cache: 60s.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface BoostedToken {
  chainId: string;
  tokenAddress: string;
  description?: string;
  icon?: string;
  url: string;
  links?: Array<{ type?: string; url: string }>;
  totalAmount?: number;
  amount?: number;
}

interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h6?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

export interface TrendingRow {
  address: string;
  chain: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  priceUsd: number;
  volume24h: number;
  txns24h: number;
  buys24h: number;
  sells24h: number;
  priceChange24h: number;
  priceChange1h: number;
  liquidityUsd: number;
  marketCap: number;
  ageHours: number;
  boostAmount: number;
  dexScreenerUrl: string;
  twitter: string | null;
  telegram: string | null;
}

interface TrendingResponse {
  data: TrendingRow[];
  summary: {
    tokenCount: number;
    totalVolume24h: number;
    totalLiquidity: number;
    freshTokensPct: number;     // % under 24h old
    chainBreakdown: Array<{ chain: string; count: number }>;
  };
  meta: {
    source: 'dexscreener';
    timestamp: number;
    chain: string;
    sort: string;
    returned: number;
  };
}

const cache = new Map<string, { body: TrendingResponse; ts: number }>();
const CACHE_TTL = 60_000;

async function fetchJson<T>(url: string, timeoutMs = 8_000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function normalizeChain(c: string): string {
  return c.toLowerCase();
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const chain = normalizeChain(searchParams.get('chain') || 'all');
  const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30));
  const sortRaw = (searchParams.get('sort') || 'boost').toLowerCase();
  const sort = (['boost', 'volume', 'change', 'age'].includes(sortRaw) ? sortRaw : 'boost') as 'boost' | 'volume' | 'change' | 'age';

  const cacheKey = `trending-tokens:${chain}:${limit}:${sort}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  // Pull boosted tokens
  const boosts = await fetchJson<BoostedToken[]>('https://api.dexscreener.com/token-boosts/latest/v1');
  if (!Array.isArray(boosts) || boosts.length === 0) {
    return NextResponse.json({ error: 'dexscreener boosts unavailable', data: [] }, { status: 502 });
  }

  // Filter by chain if requested
  const filtered = chain === 'all' ? boosts : boosts.filter(b => normalizeChain(b.chainId) === chain);

  // Dedupe by token address — DexScreener returns the same boost campaign
  // multiple times when renewed, which surfaces as N identical rows in the
  // table. Keep the entry with the highest totalAmount per address (the
  // most-recent / largest boost) and drop the rest.
  const byAddress = new Map<string, BoostedToken>();
  for (const b of filtered) {
    const key = `${normalizeChain(b.chainId)}:${b.tokenAddress.toLowerCase()}`;
    const existing = byAddress.get(key);
    const cur = (b.totalAmount || b.amount || 0);
    const prev = existing ? (existing.totalAmount || existing.amount || 0) : -Infinity;
    if (!existing || cur > prev) byAddress.set(key, b);
  }
  const deduped = Array.from(byAddress.values());

  // Enrich with pair data — fetch each token in parallel, bounded
  const toFetch = deduped.slice(0, Math.min(limit * 2, 60));  // fetch extra in case some fail
  const enriched = await Promise.all(
    toFetch.map(async (b) => {
      const pairs = await fetchJson<{ pairs?: DexPair[] }>(
        `https://api.dexscreener.com/latest/dex/tokens/${b.tokenAddress}`,
        5000,
      );
      const list = pairs?.pairs ?? [];
      if (!list.length) return null;
      // Pick the deepest pair (most liquid) for this token
      const best = list.slice().sort((a, b2) => (b2.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      if (!best) return null;
      return { boost: b, pair: best };
    }),
  );

  const rows: TrendingRow[] = [];
  const now = Date.now();
  for (const e of enriched) {
    if (!e) continue;
    const { boost, pair } = e;
    const priceUsd = parseFloat(pair.priceUsd || '0') || 0;
    if (priceUsd <= 0) continue;  // drop zero-price dead pairs
    const liq = pair.liquidity?.usd || 0;
    if (liq < 1000) continue;  // drop rugpulls with no liquidity
    const vol24 = pair.volume?.h24 || 0;
    const h24Txns = pair.txns?.h24;
    const buys = h24Txns?.buys || 0;
    const sells = h24Txns?.sells || 0;
    const age = pair.pairCreatedAt ? Math.max(0, (now - pair.pairCreatedAt) / 3_600_000) : 0;
    const twitter = boost.links?.find(l => l.type === 'twitter' || l.url?.includes('x.com') || l.url?.includes('twitter.com'))?.url || null;
    const telegram = boost.links?.find(l => l.type === 'telegram' || l.url?.includes('t.me'))?.url || null;

    rows.push({
      address: boost.tokenAddress,
      chain: boost.chainId,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      imageUrl: pair.info?.imageUrl || null,
      priceUsd,
      volume24h: vol24,
      txns24h: buys + sells,
      buys24h: buys,
      sells24h: sells,
      priceChange24h: pair.priceChange?.h24 || 0,
      priceChange1h: pair.priceChange?.h1 || 0,
      liquidityUsd: liq,
      marketCap: pair.marketCap || pair.fdv || 0,
      ageHours: age,
      boostAmount: boost.totalAmount || boost.amount || 0,
      dexScreenerUrl: pair.url,
      twitter,
      telegram,
    });
  }

  // Sort
  if (sort === 'volume')     rows.sort((a, b) => b.volume24h - a.volume24h);
  else if (sort === 'change') rows.sort((a, b) => b.priceChange24h - a.priceChange24h);
  else if (sort === 'age')   rows.sort((a, b) => a.ageHours - b.ageHours);
  else                       rows.sort((a, b) => b.boostAmount - a.boostAmount);

  const trimmed = rows.slice(0, limit);

  // Summary
  const totalVolume = trimmed.reduce((s, r) => s + r.volume24h, 0);
  const totalLiq = trimmed.reduce((s, r) => s + r.liquidityUsd, 0);
  const freshCount = trimmed.filter(r => r.ageHours < 24).length;
  const chainCounts = new Map<string, number>();
  for (const r of trimmed) chainCounts.set(r.chain, (chainCounts.get(r.chain) || 0) + 1);
  const chainBreakdown = Array.from(chainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => ({ chain: c, count: n }));

  const body: TrendingResponse = {
    data: trimmed,
    summary: {
      tokenCount: trimmed.length,
      totalVolume24h: totalVolume,
      totalLiquidity: totalLiq,
      freshTokensPct: trimmed.length ? (freshCount / trimmed.length) * 100 : 0,
      chainBreakdown,
    },
    meta: {
      source: 'dexscreener',
      timestamp: Date.now(),
      chain,
      sort,
      returned: trimmed.length,
    },
  };

  // Only pin cache when we have trending tokens. Was: cached empty for
  // 60s when DexScreener returned 200 with no rows (rate-limit response
  // is sometimes shaped like an empty success).
  if (trimmed.length > 0) {
    cache.set(cacheKey, { body, ts: Date.now() });
  }
  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': trimmed.length > 0
        ? 'public, s-maxage=60, stale-while-revalidate=180'
        : 'no-store',
    },
  });
}
