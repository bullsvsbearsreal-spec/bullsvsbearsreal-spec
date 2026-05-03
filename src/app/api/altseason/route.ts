/**
 * GET /api/altseason
 *
 * Classic Altseason Index: what % of top-50 non-stablecoin altcoins have
 * outperformed BTC over the last 30 days. >75% = "altseason", <25% = "bitcoin
 * season". Inspired by CoinMarketCap's index but built from CoinGecko data.
 *
 * We also surface:
 *   • BTC dominance + 24h/7d change
 *   • Stablecoin cap share (sidelined capital gauge)
 *   • Top altcoins outperforming BTC (and the worst underperformers)
 *
 * Source: CoinGecko `/coins/markets` — free, rate-limited.
 * Cache: 5 min.
 */
import { NextRequest, NextResponse } from 'next/server';
import { STABLE_SYMBOLS, BTC_PROXIES, ETH_PROXIES, hasExcludedName } from '@/lib/coin-filters';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const COINGECKO_MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets';
const COINGECKO_GLOBAL_URL = 'https://api.coingecko.com/api/v3/global';

interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  price_change_percentage_30d_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
}

export interface AltRow {
  rank: number;
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  marketCap: number;
  price: number;
  change30d: number;
  change7d: number;
  outperformsBtc30d: boolean;
  btcRelative30d: number;  // (alt 90d - btc 90d)
}

interface AltseasonResponse {
  data: AltRow[];
  summary: {
    altseasonIndex: number;          // 0..100
    classification: 'Bitcoin Season' | 'Neutral' | 'Altseason';
    totalAlts: number;
    outperformers: number;
    btcChange30d: number;
    btcDominance: number;
    btcDominanceChange24h: number;
    stablecoinShare: number;
  };
  meta: { timestamp: number; sampleSize: number; windowDays: 7 | 30 };
}

const cache = new Map<string, { body: AltseasonResponse; ts: number }>();
const CACHE_TTL = 300_000;

async function fetchJson<T = any>(url: string, timeoutMs = 10_000): Promise<T | null> {
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

function classify(idx: number): AltseasonResponse['summary']['classification'] {
  if (idx >= 75) return 'Altseason';
  if (idx <= 25) return 'Bitcoin Season';
  return 'Neutral';
}

export async function GET(_request: NextRequest) {
  const cacheKey = 'altseason:v1';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const marketsUrl = `${COINGECKO_MARKETS_URL}?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h%2C7d%2C30d`;

  const [marketsRaw, globalRaw] = await Promise.all([
    fetchJson<CGMarket[]>(marketsUrl),
    fetchJson<{ data?: { market_cap_percentage?: Record<string, number>; total_market_cap?: { usd?: number } } }>(COINGECKO_GLOBAL_URL),
  ]);

  if (!marketsRaw || !Array.isArray(marketsRaw)) {
    return NextResponse.json({ error: 'CoinGecko markets unavailable', data: [] }, { status: 502 });
  }

  // Gracefully fall back to 7d if 30d isn't populated (rate-limit / free-tier behaviour)
  const hasThirty = marketsRaw.some(c => c.price_change_percentage_30d_in_currency != null);
  const pickChange = (c: CGMarket): number | null => {
    const v = hasThirty
      ? c.price_change_percentage_30d_in_currency
      : c.price_change_percentage_7d_in_currency;
    return v == null ? null : v;
  };

  const btc = marketsRaw.find(c => c.id === 'bitcoin' || c.symbol?.toLowerCase() === 'btc');
  const btcChange30d = (btc ? pickChange(btc) : 0) ?? 0;

  // Filter out stables + BTC + BTC/ETH proxies to get the "alt" universe.
  // ETH proxies are excluded so ETH doesn't get double-counted via its LST wrappers.
  const filtered = marketsRaw.filter(c => {
    const sym = (c.symbol || '').toLowerCase();
    if (!sym) return false;
    if (sym === 'btc') return false;
    if (STABLE_SYMBOLS.has(sym)) return false;
    if (BTC_PROXIES.has(sym)) return false;
    if (ETH_PROXIES.has(sym)) return false;
    // Name-based check — "wrapped bitcoin"/"wrapped ether" variants slip in
    const name = (c.name || '').toLowerCase();
    if (name.includes('wrapped bitcoin') || name.includes('wrapped btc')) return false;
    if (name.includes('wrapped ether') || name.includes('liquid stak')) return false;
    // Require change data in the chosen window
    if (pickChange(c) == null) return false;
    return true;
  });

  const alts = filtered.slice(0, 50); // classic top-50 alts methodology

  const rows: AltRow[] = alts.map(c => {
    const change = pickChange(c) ?? 0;
    return {
      rank: c.market_cap_rank ?? 0,
      id: c.id,
      symbol: (c.symbol || '').toUpperCase(),
      name: c.name,
      image: c.image ?? null,
      marketCap: c.market_cap ?? 0,
      price: c.current_price ?? 0,
      change30d: change,
      change7d: c.price_change_percentage_7d_in_currency ?? 0,
      outperformsBtc30d: change > btcChange30d,
      btcRelative30d: change - btcChange30d,
    };
  });

  // Sort by btc-relative outperformance desc
  rows.sort((a, b) => b.btcRelative30d - a.btcRelative30d);

  const outperformers = rows.filter(r => r.outperformsBtc30d).length;
  const altseasonIndex = alts.length ? Math.round((outperformers / alts.length) * 100) : 0;

  const btcDom = globalRaw?.data?.market_cap_percentage?.btc ?? 0;
  const stableDom =
    (globalRaw?.data?.market_cap_percentage?.usdt ?? 0) +
    (globalRaw?.data?.market_cap_percentage?.usdc ?? 0) +
    (globalRaw?.data?.market_cap_percentage?.dai ?? 0);

  const body: AltseasonResponse = {
    data: rows,
    summary: {
      altseasonIndex,
      classification: classify(altseasonIndex),
      totalAlts: alts.length,
      outperformers,
      btcChange30d,
      btcDominance: btcDom,
      btcDominanceChange24h: 0, // CoinGecko /global doesn't expose this directly; leave 0 for now
      stablecoinShare: stableDom,
    },
    meta: { timestamp: Date.now(), sampleSize: alts.length, windowDays: hasThirty ? 30 : 7 },
  };

  cache.set(cacheKey, { body, ts: Date.now() });
  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
  });
}
