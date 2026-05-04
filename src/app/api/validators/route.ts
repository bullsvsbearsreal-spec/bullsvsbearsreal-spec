/**
 * GET /api/validators
 *
 * Liquid-staking + native staking yields across ETH, SOL, and other major
 * PoS chains. Pulls DefiLlama Yields filtered to known LST/LSD projects.
 *
 * Free DefiLlama yields API. L1 cached 30 min.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface LlamaPool {
  pool: string;             // pool ID
  project: string;
  symbol: string;
  chain: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  ilRisk?: string;
  exposure?: string;
}

interface ValidatorRow {
  project: string;
  symbol: string;
  chain: string;
  asset: string;            // BTC / ETH / SOL etc derived from symbol
  apy: number;              // total
  apyBase: number;          // staking-side APR
  apyReward: number;        // points / token rewards
  tvlUsd: number;
  category: 'liquid-staking' | 'restaking' | 'native-staking';
}

interface ApiResponse {
  byAsset: Record<string, ValidatorRow[]>;
  totalTvl: number;
  ts: number;
}

const TIMEOUT = 12_000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 30 * 60 * 1000;

const LST_PROJECTS = new Set([
  'lido', 'rocket-pool', 'rocketpool', 'frax-ether', 'mantle-lsp',
  'binance-staked-eth', 'coinbase-wrapped-staked-eth', 'stakewise-v3',
  'jito-liquid-staking', 'jito', 'marinade-finance', 'marinade',
  'sanctum', 'blazestake', 'jpool',
]);

const RESTAKING_PROJECTS = new Set([
  'eigenlayer', 'symbiotic', 'karak', 'ether-fi', 'etherfi-stake',
  'renzo', 'kelp-dao', 'puffer-finance', 'swell', 'eigenpie',
]);

const ALLOW_PROJECTS = new Set<string>();
LST_PROJECTS.forEach(p => ALLOW_PROJECTS.add(p));
RESTAKING_PROJECTS.forEach(p => ALLOW_PROJECTS.add(p));

const ASSET_FROM_SYMBOL = (sym: string): string => {
  const u = sym.toUpperCase();
  if (u.includes('STETH') || u.includes('RETH') || u.includes('CBETH') || u.includes('WSTETH') || u.endsWith('ETH') || u === 'WETH' || u === 'ETH') return 'ETH';
  if (u.includes('JITOSOL') || u.includes('MSOL') || u.includes('BSOL') || u.includes('JSOL') || u.endsWith('SOL') || u === 'SOL') return 'SOL';
  if (u.includes('BTC')) return 'BTC';
  if (u.includes('MATIC') || u.includes('POL')) return 'POL';
  if (u.includes('AVAX')) return 'AVAX';
  if (u.includes('ATOM')) return 'ATOM';
  if (u.includes('NEAR')) return 'NEAR';
  return 'OTHER';
};

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  try {
    const res = await fetchWithTimeout(
      'https://yields.llama.fi/pools',
      { headers: { Accept: 'application/json' } },
      TIMEOUT,
    );
    if (!res.ok) {
      if (l1) return NextResponse.json(l1.body, { headers: { 'X-Cache': 'STALE' } });
      return NextResponse.json({ error: `DefiLlama HTTP ${res.status}`, byAsset: {} }, { status: 502 });
    }
    const json = await res.json() as { data?: LlamaPool[] };
    const pools = json.data ?? [];

    const filtered: ValidatorRow[] = [];
    for (const p of pools) {
      if (!ALLOW_PROJECTS.has(p.project)) continue;
      if (!Number.isFinite(p.apy) || (p.apy ?? 0) <= 0) continue;
      if ((p.tvlUsd ?? 0) < 5_000_000) continue;
      filtered.push({
        project: p.project,
        symbol: p.symbol,
        chain: p.chain,
        asset: ASSET_FROM_SYMBOL(p.symbol),
        apy: p.apy ?? 0,
        apyBase: p.apyBase ?? 0,
        apyReward: p.apyReward ?? 0,
        tvlUsd: p.tvlUsd,
        category: RESTAKING_PROJECTS.has(p.project) ? 'restaking' : 'liquid-staking',
      });
    }

    // Sort within each asset bucket by TVL desc
    filtered.sort((a, b) => b.tvlUsd - a.tvlUsd);

    const byAsset: Record<string, ValidatorRow[]> = {};
    for (const r of filtered) {
      if (!byAsset[r.asset]) byAsset[r.asset] = [];
      byAsset[r.asset].push(r);
    }

    const totalTvl = filtered.reduce((s, r) => s + r.tvlUsd, 0);

    const body: ApiResponse = {
      byAsset,
      totalTvl,
      ts: Date.now(),
    };

    if (filtered.length > 0) l1 = { body, ts: Date.now() };

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': filtered.length > 0
          ? 'public, s-maxage=900, stale-while-revalidate=3600'
          : 'no-store',
      },
    });
  } catch (e) {
    if (l1) return NextResponse.json(l1.body, { headers: { 'X-Cache': 'STALE' } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed', byAsset: {} },
      { status: 502 },
    );
  }
}
