/**
 * GET /api/tge-calendar
 *
 * Upcoming Token Generation Events served from a curated list. We also
 * fetch CoinGecko's `/coins/list/new` to fold in any *just-launched*
 * tokens (within the past 14 days) as a "Recently launched" section.
 *
 * Curated list lives at src/lib/tge-calendar.ts — maintainer-edited.
 * No paid APIs.
 */
import { NextResponse } from 'next/server';
import { UPCOMING_TGES, type TgeEntry } from '@/lib/tge-calendar';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface RecentLaunch {
  symbol: string;
  name: string;
  /** Approx age in days. CoinGecko exposes activated_at unreliably so we approximate. */
  ageDays: number;
  marketCapUsd: number | null;
  priceUsd: number | null;
  change24h: number | null;
  imageUrl: string | null;
  cgId: string;
}

interface CGCoin {
  id: string;
  symbol: string;
  name: string;
  activated_at?: number;
  current_price?: number;
  market_cap?: number;
  price_change_percentage_24h?: number;
  image?: string;
}

interface ApiResponse {
  upcoming: TgeEntry[];
  recent: RecentLaunch[];
  ts: number;
}

const TIMEOUT = 10_000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 30 * 60 * 1000;

async function fetchRecentLaunches(): Promise<RecentLaunch[]> {
  try {
    // CoinGecko's `/coins/list/new` is auth-gated. Fall back to filtering
    // /coins/markets by `category=recently-added` (free tier).
    const res = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=recently-added&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=24h',
      { headers: { Accept: 'application/json' } },
      TIMEOUT,
    );
    if (!res.ok) return [];
    const arr = await res.json() as CGCoin[];
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr.slice(0, 24).map(c => ({
      symbol: c.symbol?.toUpperCase() ?? '',
      name: c.name,
      ageDays: c.activated_at
        ? Math.max(0, Math.floor((now - c.activated_at * 1000) / 86_400_000))
        : 7,
      marketCapUsd: c.market_cap ?? null,
      priceUsd: c.current_price ?? null,
      change24h: c.price_change_percentage_24h ?? null,
      imageUrl: c.image ?? null,
      cgId: c.id,
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  // Filter curated list to entries whose date is in the future, OR within
  // the past 14 days (so newly-launched tokens stay visible briefly).
  const now = Date.now();
  const upcoming = UPCOMING_TGES
    .filter(t => {
      const eventMs = new Date(t.date + 'T00:00:00Z').getTime();
      return eventMs > now - 14 * 86_400_000;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const recent = await fetchRecentLaunches();

  const body: ApiResponse = {
    upcoming,
    recent,
    ts: Date.now(),
  };

  l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  });
}
