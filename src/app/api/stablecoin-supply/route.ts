/**
 * GET /api/stablecoin-supply
 *
 * Stablecoin circulating supply timeseries via DefiLlama's free
 * /stablecoins endpoint plus per-stablecoin charts.
 *
 * Stablecoin supply is a clean liquidity-onramp signal — fast supply
 * growth = new dollars entering crypto, fast contraction = liquidity
 * leaving the system.
 */
import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface LlamaStable {
  id: number;
  name: string;
  symbol: string;
  pegType: string;
  pegMechanism: string;
  circulating?: { peggedUSD?: number };
  circulatingPrevDay?: { peggedUSD?: number };
  circulatingPrevWeek?: { peggedUSD?: number };
  circulatingPrevMonth?: { peggedUSD?: number };
  chains?: string[];
  /** Direct image URL on DefiLlama */
  logo?: string;
}

interface StableRow {
  id: number;
  name: string;
  symbol: string;
  supply: number;
  change1d: number | null;
  change7d: number | null;
  change30d: number | null;
  pegMechanism: string;
  chains: string[];
  logoUrl: string | null;
}

interface ApiResponse {
  rows: StableRow[];
  totalSupply: number;
  totalChange30d: number | null;
  ts: number;
}

const TIMEOUT = 12_000;
let l1: { body: ApiResponse; ts: number } | null = null;
const L1_TTL = 30 * 60 * 1000;

export async function GET() {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  try {
    const res = await fetchWithTimeout(
      'https://stablecoins.llama.fi/stablecoins?includePrices=false',
      { headers: { Accept: 'application/json' } },
      TIMEOUT,
    );
    if (!res.ok) {
      if (l1) return NextResponse.json(l1.body, { headers: { 'X-Cache': 'STALE' } });
      return NextResponse.json({ error: `DefiLlama HTTP ${res.status}`, rows: [] }, { status: 502 });
    }
    const json = await res.json() as { peggedAssets?: LlamaStable[] };
    const peggedAssets = json.peggedAssets ?? [];

    // Filter to USD-pegged with > $50M supply
    const filtered = peggedAssets
      .filter(p => p.pegType?.includes('USD') && (p.circulating?.peggedUSD ?? 0) > 50_000_000);

    let totalNow = 0;
    let total30d = 0;
    const rows: StableRow[] = filtered.map(p => {
      const now = p.circulating?.peggedUSD ?? 0;
      const prev1d = p.circulatingPrevDay?.peggedUSD ?? null;
      const prev7d = p.circulatingPrevWeek?.peggedUSD ?? null;
      const prev30d = p.circulatingPrevMonth?.peggedUSD ?? null;
      totalNow += now;
      if (prev30d != null) total30d += prev30d;

      return {
        id: p.id,
        name: p.name,
        symbol: p.symbol,
        supply: now,
        change1d: prev1d != null && prev1d > 0 ? (now - prev1d) / prev1d : null,
        change7d: prev7d != null && prev7d > 0 ? (now - prev7d) / prev7d : null,
        change30d: prev30d != null && prev30d > 0 ? (now - prev30d) / prev30d : null,
        pegMechanism: p.pegMechanism || 'unknown',
        chains: p.chains?.slice(0, 5) ?? [],
        logoUrl: p.symbol ? `https://icons.llamao.fi/icons/protocols/${p.name.toLowerCase().replace(/\s+/g, '-')}?w=48&h=48` : null,
      };
    });

    rows.sort((a, b) => b.supply - a.supply);

    const totalChange30d = total30d > 0 ? (totalNow - total30d) / total30d : null;

    const body: ApiResponse = {
      rows: rows.slice(0, 30),
      totalSupply: totalNow,
      totalChange30d,
      ts: Date.now(),
    };

    if (rows.length > 0) l1 = { body, ts: Date.now() };

    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  } catch (e) {
    if (l1) return NextResponse.json(l1.body, { headers: { 'X-Cache': 'STALE' } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed', rows: [] },
      { status: 502 },
    );
  }
}
