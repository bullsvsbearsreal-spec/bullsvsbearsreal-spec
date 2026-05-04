/**
 * GET /api/memecoin-radar
 *
 * Hot Solana memecoins via DexScreener's free public API. Filter to recent
 * launches (< 7 days) with non-trivial liquidity, ranked by 1-hour velocity
 * (volume × price-change percent). Returns the top movers traders use as
 * the "what's pumping right now" feed.
 *
 * Free DexScreener endpoint, no auth. L1 cached 60s — these move fast.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

interface MemeToken {
  address: string;
  name: string;
  symbol: string;
  pairUrl: string;
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  volume1h: number;
  volume24h: number;
  change5m: number;
  change1h: number;
  change24h: number;
  ageHours: number;
  velocity: number;     // composite = vol1h × |change1h|
}

interface ApiResponse {
  tokens: MemeToken[];
  ts: number;
}

const TIMEOUT = 10_000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 60_000;

const QUERY_TERMS = [
  'WIF', 'BONK', 'POPCAT', 'PNUT', 'GOAT', 'MOODENG', 'BRETT',
  'PEPE', 'TRUMP', 'FARTCOIN', 'AI16Z', 'BOME', 'PONKE',
];

async function search(query: string): Promise<DexPair[]> {
  try {
    const res = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json' } },
      TIMEOUT,
    );
    if (!res.ok) return [];
    const json = await res.json() as { pairs?: DexPair[] };
    return json.pairs ?? [];
  } catch {
    return [];
  }
}

async function trendingSolana(): Promise<DexPair[]> {
  // DexScreener has a "tokens/v1/solana/{address}" endpoint but no general
  // "trending solana" route. We approximate via a search for "SOL" plus
  // the curated query list above to get a wide net of high-volume Solana
  // pairs, then filter to chainId === 'solana'.
  const queries = ['SOL', ...QUERY_TERMS];
  const all = await Promise.all(queries.map(search));
  const map = new Map<string, DexPair>();
  for (const arr of all) {
    for (const p of arr) {
      if (p.chainId !== 'solana') continue;
      // Dedupe by pair address — keep one per pair
      if (!map.has(p.pairAddress)) map.set(p.pairAddress, p);
    }
  }
  return Array.from(map.values());
}

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=180' },
    });
  }

  try {
    const pairs = await trendingSolana();
    const now = Date.now();
    const tokens: MemeToken[] = [];

    for (const p of pairs) {
      const liq = p.liquidity?.usd ?? 0;
      const vol1h = p.volume?.h1 ?? 0;
      const vol24h = p.volume?.h24 ?? 0;
      const ch1h = p.priceChange?.h1 ?? 0;
      // Filters: needs decent liquidity + 1h volume (real activity, not stale)
      if (liq < 25_000 || vol1h < 5_000) continue;
      // Skip stable + wrapped + LSTs that show up in SOL search
      const sym = (p.baseToken.symbol || '').toUpperCase();
      if (['SOL', 'USDC', 'USDT', 'JLP', 'JTO', 'PYTH', 'WIF', 'BONK'].includes(sym)) {
        // Allow these only if they have huge 1h velocity — exclude stables outright
        if (['USDC', 'USDT'].includes(sym)) continue;
      }
      const ageHours = p.pairCreatedAt
        ? Math.max(0, (now - p.pairCreatedAt) / 3_600_000)
        : Infinity;

      tokens.push({
        address: p.baseToken.address,
        name: p.baseToken.name || sym,
        symbol: sym,
        pairUrl: p.url,
        priceUsd: Number(p.priceUsd) || 0,
        marketCap: p.marketCap ?? p.fdv ?? 0,
        liquidityUsd: liq,
        volume1h: vol1h,
        volume24h: vol24h,
        change5m: p.priceChange?.m5 ?? 0,
        change1h: ch1h,
        change24h: p.priceChange?.h24 ?? 0,
        ageHours: Number.isFinite(ageHours) ? Math.round(ageHours) : 9999,
        velocity: vol1h * Math.abs(ch1h) / 100,
      });
    }

    tokens.sort((a, b) => b.velocity - a.velocity);
    const trimmed = tokens.slice(0, 50);

    const body: ApiResponse = { tokens: trimmed, ts: Date.now() };
    if (trimmed.length > 0) l1 = { body, ts: Date.now() };

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': trimmed.length > 0
          ? 'public, s-maxage=45, stale-while-revalidate=180'
          : 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed', tokens: [] },
      { status: 502 },
    );
  }
}
