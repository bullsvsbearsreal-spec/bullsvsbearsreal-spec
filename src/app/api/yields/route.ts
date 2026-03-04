/**
 * GET /api/yields?project=aave-v3&chain=Ethereum&stablecoin=true&minTvl=100000&minApy=0.1
 *
 * Fetches DeFi yield data from DeFiLlama. Filters and returns top pools.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';

const LLAMA_URL = 'https://yields.llama.fi/pools';

// Curated "lending/yield" projects — excludes DEX LPs to focus on clean yield
const LENDING_PROJECTS = new Set([
  'aave-v3', 'aave-v2', 'morpho-v1', 'morpho-blue', 'pendle',
  'compound-v3', 'compound-v2', 'spark', 'euler-v2', 'fluid',
  'venus', 'silo-v2', 'radiant-v2', 'benqi-lending', 'moonwell',
  'seamless-protocol', 'kamino-lend', 'marginfi', 'drift-lending',
  'lido', 'rocketpool', 'jito', 'marinade', 'ethena',
  'maker', 'sky', 'usual-protocol', 'mountain-protocol',
  'yearn-v3', 'beefy', 'convex-finance', 'spectra',
  'gmx-v2-perps', 'hyperliquid-hlp', 'aave-v3-lido',
  'ionic', 'layerbank', 'zerolend', 'pac-finance',
]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const projectFilter = searchParams.get('project')?.toLowerCase();
  const chainFilter = searchParams.get('chain');
  const stableOnly = searchParams.get('stablecoin') === 'true';
  const minTvl = parseFloat(searchParams.get('minTvl') || '50000');
  const minApy = parseFloat(searchParams.get('minApy') || '0');
  const lendingOnly = searchParams.get('lending') !== 'false'; // default true
  const limit = Math.min(parseInt(searchParams.get('limit') || '200') || 200, 500);

  try {
    const resp = await fetch(LLAMA_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'DeFiLlama API error' }, { status: 502 });
    }

    const raw = await resp.json();
    if (raw.status !== 'success' || !Array.isArray(raw.data)) {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 502 });
    }

    let pools = raw.data.filter((p: any) => {
      if (!p.tvlUsd || p.tvlUsd < minTvl) return false;
      if (p.apy === null || p.apy === undefined || p.apy < minApy) return false;
      if (p.outlier) return false; // skip outlier yields
      if (stableOnly && !p.stablecoin) return false;
      if (chainFilter && p.chain !== chainFilter) return false;
      if (projectFilter && !p.project.toLowerCase().includes(projectFilter)) return false;
      if (lendingOnly && !LENDING_PROJECTS.has(p.project)) return false;
      return true;
    });

    // Sort by APY descending
    pools.sort((a: any, b: any) => (b.apy || 0) - (a.apy || 0));
    pools = pools.slice(0, limit);

    // Map to clean response
    const data = pools.map((p: any) => ({
      pool: p.pool,
      chain: p.chain,
      project: p.project,
      symbol: p.symbol,
      tvl: Math.round(p.tvlUsd),
      apy: +(p.apy || 0).toFixed(2),
      apyBase: p.apyBase !== null ? +(p.apyBase).toFixed(2) : null,
      apyReward: p.apyReward !== null ? +(p.apyReward).toFixed(2) : null,
      stablecoin: p.stablecoin || false,
      ilRisk: p.ilRisk || 'no',
      apyChange7d: p.apyPct7D !== null ? +(p.apyPct7D).toFixed(2) : null,
      apyMean30d: p.apyMean30d !== null ? +(p.apyMean30d).toFixed(2) : null,
      prediction: p.predictions?.predictedClass || null,
      poolMeta: p.poolMeta || null,
      exposure: p.exposure || null,
      category: p.category || null,
    }));

    // Get unique chains and projects for filters
    const chains = Array.from(new Set<string>(data.map((d: any) => d.chain))).sort();
    const projects = Array.from(new Set<string>(data.map((d: any) => d.project))).sort();

    return NextResponse.json({ data, chains, projects, count: data.length }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (e) {
    console.error('[YIELDS] Error:', e);
    return NextResponse.json({ error: 'Failed to fetch yields' }, { status: 500 });
  }
}
