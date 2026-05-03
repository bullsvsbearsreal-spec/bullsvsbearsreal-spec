/**
 * GET /api/staking
 *
 * ETH liquid-staking + liquid-restaking yield dashboard. We pivot DefiLlama's
 * free `/pools` feed to only ETH-denominated staking and restaking protocols.
 *
 * Categories returned:
 *   • LST   — Liquid Staking (Lido stETH, Rocket Pool rETH, Frax sfrxETH, etc.)
 *   • LRT   — Liquid Restaking (Ether.fi weETH, Renzo ezETH, Kelp rsETH, etc.)
 *   • SYN   — Synthetic / delta-neutral (Ethena USDe / sUSDe, Usual USD0, etc.)
 *   • Other — catch-all (Pendle PT/YT, etc.)
 *
 * Cache: 5 min.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const DEFILLAMA_POOLS = 'https://yields.llama.fi/pools';

interface LlamaPool {
  pool: string;              // opaque id
  chain: string;
  project: string;
  symbol: string;
  tvlUsd?: number;
  apy?: number;
  apyBase?: number;
  apyReward?: number;
  poolMeta?: string | null;
  stablecoin?: boolean;
  ilRisk?: string;
  exposure?: string;
  apyMean30d?: number;
  apyPct7D?: number;
  category?: string;
  underlyingTokens?: string[];
}

export interface StakingRow {
  poolId: string;
  project: string;
  symbol: string;
  chain: string;
  category: 'LST' | 'LRT' | 'SYN' | 'Other';
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  apyMean30d: number;
  apyChange7d: number;
}

interface StakingResponse {
  data: StakingRow[];
  summary: {
    totalTvlUsd: number;
    topApy: number;
    topApyProtocol: string | null;
    lstTvl: number;
    lrtTvl: number;
    synTvl: number;
    protocolCount: number;
  };
  meta: {
    source: 'defillama';
    timestamp: number;
    category: 'all' | 'LST' | 'LRT' | 'SYN' | 'Other';
    windowDays: 30;
    returned: number;
  };
}

const cache = new Map<string, { body: StakingResponse; ts: number }>();
const CACHE_TTL = 300_000;

// Known protocol classifier. Substrings, case-insensitive.
const LST_PROJECTS = new Set([
  'lido', 'rocket-pool', 'rocketpool', 'frax-ether', 'frxether', 'stader',
  'ankr-staked-eth', 'swell', 'mantle-staked-eth', 'mev', 'stakewise',
  'coinbase-wrapped-staked-eth', 'cbeth', 'binance-staked-eth', 'wbeth',
]);
const LRT_PROJECTS = new Set([
  'ether.fi', 'etherfi', 'ether.fi-stake', 'kelp-dao', 'kelp', 'renzo',
  'eigenlayer', 'puffer', 'bedrock-unieth', 'swell-restaking', 'mellow',
  'mantle-restaking',
]);
const SYN_PROJECTS = new Set([
  'ethena-usde', 'ethena', 'usual', 'usual-usd', 'elixir', 'resolv',
]);

function classify(project: string, symbol: string): StakingRow['category'] {
  const p = (project || '').toLowerCase();
  const s = (symbol || '').toLowerCase();
  if (LST_PROJECTS.has(p)) return 'LST';
  if (LRT_PROJECTS.has(p)) return 'LRT';
  if (SYN_PROJECTS.has(p)) return 'SYN';
  // Symbol-based backup
  if (/(^steth$|reth|cbeth|sweth|frxeth|sfrxeth|wbeth|mseth)/.test(s)) return 'LST';
  if (/(weeth|rseth|ezeth|pufeth|lseth|uniETH|steakhouse)/i.test(s)) return 'LRT';
  if (/(usde|susde|usd0|rlp)/i.test(s)) return 'SYN';
  // Project name contains 'stak' => LST
  if (p.includes('stak')) return 'LST';
  return 'Other';
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '60', 10) || 60));
  const category = (searchParams.get('category') || 'all').toUpperCase();
  const cat = (['LST', 'LRT', 'SYN', 'OTHER'].includes(category) ? category : 'ALL');

  const cacheKey = `staking:${cat}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const res = await fetch(DEFILLAMA_POOLS, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `DefiLlama ${res.status}`, data: [] }, { status: 502 });
    }
    const json = await res.json();
    const raw: LlamaPool[] = Array.isArray(json?.data) ? json.data : [];

    // DefiLlama's /pools endpoint doesn't populate `category`, so we can't use
    // it. Instead, positive-match by project name (known LST/LRT/SYN protocols)
    // and negatively exclude lending protocols that just accept LSTs as
    // collateral (aave / morpho / sparklend / sky / etc).
    const LENDING_PROJECTS = new Set([
      'aave-v3', 'aave-v2', 'aave', 'morpho-blue', 'morpho-aave-v3', 'morpho',
      'sparklend', 'spark', 'sky-lending', 'sky', 'fluid-lending', 'fluid',
      'compound-v3', 'compound', 'radiant-v2', 'radiant', 'venus',
      'merkl', 'moonwell', 'seamless', 'extra-finance', 'benqi',
    ]);

    const candidates = raw.filter(p => {
      if (!p || !p.symbol || !p.project) return false;
      const proj = p.project.toLowerCase();
      // Block-list: lending + yield-aggregator derivatives (wrap LSTs but not staking)
      if (LENDING_PROJECTS.has(proj)) return false;
      // Positive-match: known LST / LRT / synthetic protocols
      if (LST_PROJECTS.has(proj) || LRT_PROJECTS.has(proj) || SYN_PROJECTS.has(proj)) return true;
      // Project-name heuristic (staking or restaking in the name)
      if (proj.includes('stak') || proj.includes('restak')) return true;
      if (proj.includes('ethena') || proj.includes('usual')) return true;
      // Symbol fallback for LST/LRT/synthetic tokens we recognize
      const sym = p.symbol.toLowerCase();
      if (/^(steth|reth|cbeth|sweth|frxeth|sfrxeth|wbeth|mseth|weeth|eeth|rseth|ezeth|pufeth|lseth|unieth|ankreth|wsteth|usde|susde|usd0|ethx|oseth|lseth|stkgho|swellp)$/i.test(sym)) return true;
      return false;
    });

    // Classify + shape
    let rows: StakingRow[] = candidates.map(p => ({
      poolId: p.pool,
      project: p.project,
      symbol: p.symbol,
      chain: p.chain,
      category: classify(p.project, p.symbol),
      tvlUsd: p.tvlUsd ?? 0,
      apy: p.apy ?? 0,
      apyBase: p.apyBase ?? 0,
      apyReward: p.apyReward ?? 0,
      apyMean30d: p.apyMean30d ?? 0,
      apyChange7d: p.apyPct7D ?? 0,
    }));

    // Filter by requested category
    if (cat !== 'ALL') {
      rows = rows.filter(r => r.category === (cat as StakingRow['category']));
    }

    // Drop near-zero dust pools (< $100k TVL) — too much noise
    rows = rows.filter(r => r.tvlUsd >= 100_000);

    // Sort by TVL desc (that's the typical "who to trust first" view)
    rows.sort((a, b) => b.tvlUsd - a.tvlUsd);

    const trimmed = rows.slice(0, limit);

    const lstTvl = rows.filter(r => r.category === 'LST').reduce((s, r) => s + r.tvlUsd, 0);
    const lrtTvl = rows.filter(r => r.category === 'LRT').reduce((s, r) => s + r.tvlUsd, 0);
    const synTvl = rows.filter(r => r.category === 'SYN').reduce((s, r) => s + r.tvlUsd, 0);
    const top = [...trimmed].sort((a, b) => b.apy - a.apy)[0];

    const body: StakingResponse = {
      data: trimmed,
      summary: {
        totalTvlUsd: rows.reduce((s, r) => s + r.tvlUsd, 0),
        topApy: top?.apy ?? 0,
        topApyProtocol: top ? `${top.project} (${top.symbol})` : null,
        lstTvl,
        lrtTvl,
        synTvl,
        protocolCount: rows.length,
      },
      meta: {
        source: 'defillama',
        timestamp: Date.now(),
        category: cat === 'ALL' ? 'all' : (cat.toLowerCase() as 'lst' | 'lrt' | 'syn' | 'other') as StakingResponse['meta']['category'],
        windowDays: 30,
        returned: trimmed.length,
      },
    };

    cache.set(cacheKey, { body, ts: Date.now() });
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[staking] error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
