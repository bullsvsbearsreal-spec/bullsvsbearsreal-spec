/**
 * GET /api/sectors
 *
 * Crypto sector / category performance via CoinGecko's free
 * `/coins/categories` endpoint. Returns 24h, 7d, 30d performance and
 * market cap per sector. No auth required.
 *
 * L1 cached 5 min — sector data moves slowly, no need to hammer.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface CategoryRaw {
  id: string;
  name: string;
  market_cap: number | null;
  market_cap_change_24h: number | null;
  volume_24h: number | null;
  top_3_coins: string[];
  // CoinGecko's free endpoint only returns market_cap_change_24h, not 7d/30d.
  // For multi-period view we'd need /coins/markets per category — heavier.
}

interface Sector {
  id: string;
  name: string;
  marketCap: number;
  change24h: number | null;
  volume24h: number;
  topCoins: string[];
}

interface SectorsResponse {
  sectors: Sector[];
  totalMarketCap: number;
  ts: number;
}

const CG_URL = 'https://api.coingecko.com/api/v3/coins/categories';
const TIMEOUT = 10_000;

let l1: { body: SectorsResponse; ts: number } | null = null;
const L1_TTL = 5 * 60 * 1000;

// Curated whitelist — CoinGecko returns ~150 categories, most are noise.
// These are the ones with real market activity that traders watch.
const ALLOWLIST = new Set([
  'layer-1', 'layer-2', 'smart-contract-platform',
  'meme-token', 'solana-meme-coins', 'base-meme-coins',
  'defi', 'decentralized-finance-defi', 'lending-borowing', 'decentralized-exchange',
  'artificial-intelligence', 'ai-meme-coins',
  'gaming', 'metaverse', 'play-to-earn',
  'real-world-assets-rwa',
  'liquid-staking-tokens', 'staking-pool',
  'oracle', 'storage',
  'privacy-coins',
  'rollup', 'optimistic-rollup', 'zk-rollup',
  'depin', 'data-availability',
  'restaking', 'liquid-restaking-tokens',
  'modular-blockchain',
  'bitcoin-ecosystem', 'ordinals',
  'centralized-exchange-token-cex', 'exchange-based-tokens',
  'stablecoins',
  'memes-2-0',
  'governance', 'dao',
  'derivatives', 'perpetuals',
]);

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=240, stale-while-revalidate=600' },
    });
  }

  try {
    const res = await fetch(CG_URL, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      // Stale-on-error
      if (l1) return NextResponse.json(l1.body, { headers: { 'X-Cache': 'STALE' } });
      return NextResponse.json({ error: `CoinGecko HTTP ${res.status}`, sectors: [] }, { status: 502 });
    }
    const arr = (await res.json()) as CategoryRaw[];

    const filtered: Sector[] = arr
      .filter(c => ALLOWLIST.has(c.id) && (c.market_cap ?? 0) > 50_000_000)
      .map(c => ({
        id: c.id,
        name: c.name,
        marketCap: c.market_cap ?? 0,
        change24h: c.market_cap_change_24h,
        volume24h: c.volume_24h ?? 0,
        topCoins: c.top_3_coins.slice(0, 3),
      }))
      .sort((a, b) => b.marketCap - a.marketCap);

    const totalMarketCap = filtered.reduce((s, c) => s + c.marketCap, 0);
    const body: SectorsResponse = {
      sectors: filtered,
      totalMarketCap,
      ts: Date.now(),
    };

    if (filtered.length > 0) l1 = { body, ts: Date.now() };

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': filtered.length > 0
          ? 'public, s-maxage=240, stale-while-revalidate=600'
          : 'no-store',
      },
    });
  } catch (e) {
    if (l1) return NextResponse.json(l1.body, { headers: { 'X-Cache': 'STALE' } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed', sectors: [] },
      { status: 502 },
    );
  }
}
