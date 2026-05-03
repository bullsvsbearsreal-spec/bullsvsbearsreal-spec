/**
 * GET /api/perp-dex-volume
 *
 * Perp DEX market-share leaderboard. Derivatives volume overview on DeFiLlama
 * is paid-tier, but their fees overview is free and includes a `Derivatives`
 * category that has most perp DEXs + their fee revenue. We use fee revenue
 * as a proxy for relative market share — the bigger the fees, the bigger
 * the volume (fee rates are similar across DEXs, ~0.02-0.07%).
 *
 * For absolute volume we reverse-engineer using a standard 0.035% average
 * taker fee (middle of the industry band). This gives an order-of-magnitude
 * estimate that's directionally accurate.
 *
 * Cache: 5 min.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const DEFILLAMA_FEES_URL = 'https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true';

// Fee rate assumption used to infer notional volume from fee revenue.
// This is a blended taker fee; real rates vary (Hyperliquid ~0.02-0.035%,
// GMX ~0.05%, dYdX ~0.05%) but 0.035% is a reasonable blend.
const AVG_FEE_RATE = 0.00035;

interface LlamaProtocol {
  name: string;
  category: string;
  logo?: string;
  chains?: string[];
  total24h?: number;
  total7d?: number;
  total30d?: number;
  change_1d?: number;
  change_7d?: number;
  change_30d?: number;
}

export interface PerpDEXRow {
  name: string;
  logo: string | null;
  chains: string[];
  fees24h: number;
  fees7d: number;
  fees30d: number;
  impliedVolume24h: number;
  impliedVolume7d: number;
  impliedVolume30d: number;
  change24hPct: number;
  change7dPct: number;
  marketShare24h: number;    // 0..1
  marketShare7d: number;
}

const cache = new Map<string, { body: any; ts: number }>();
const CACHE_TTL = 300_000;

export async function GET(_request: NextRequest) {
  const cacheKey = 'perp-dex-volume:v1';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const res = await fetch(DEFILLAMA_FEES_URL, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `DeFiLlama ${res.status}`, data: [] }, { status: 502 });
    }
    const json = await res.json();
    const raw: LlamaProtocol[] = json?.protocols || [];

    // Filter to derivatives. DeFiLlama's category labels vary — match flexibly.
    const derivs = raw.filter(p => {
      const cat = (p.category || '').toLowerCase();
      return cat === 'derivatives' || cat.includes('perpetual') || cat.includes('perp');
    });

    const total24h = derivs.reduce((s, p) => s + (p.total24h ?? 0), 0);
    const total7d = derivs.reduce((s, p) => s + (p.total7d ?? 0), 0);

    const rows: PerpDEXRow[] = derivs.map(p => {
      const fees24h = p.total24h ?? 0;
      const fees7d = p.total7d ?? 0;
      const fees30d = p.total30d ?? 0;
      return {
        name: p.name,
        logo: p.logo ?? null,
        chains: p.chains ?? [],
        fees24h,
        fees7d,
        fees30d,
        impliedVolume24h: fees24h / AVG_FEE_RATE,
        impliedVolume7d: fees7d / AVG_FEE_RATE,
        impliedVolume30d: fees30d / AVG_FEE_RATE,
        change24hPct: p.change_1d ?? 0,
        change7dPct: p.change_7d ?? 0,
        marketShare24h: total24h > 0 ? fees24h / total24h : 0,
        marketShare7d: total7d > 0 ? fees7d / total7d : 0,
      };
    })
      .filter(r => r.fees30d > 0 || r.fees7d > 0)
      .sort((a, b) => b.fees24h - a.fees24h);

    const summary = {
      totalFees24h: total24h,
      totalImpliedVolume24h: total24h / AVG_FEE_RATE,
      totalFees7d: total7d,
      totalImpliedVolume7d: total7d / AVG_FEE_RATE,
      protocolCount: rows.length,
      leader: rows[0]?.name ?? null,
      leaderShare: rows[0]?.marketShare24h ?? 0,
      top3Share: rows.slice(0, 3).reduce((s, r) => s + r.marketShare24h, 0),
    };

    const body = {
      data: rows,
      summary,
      meta: {
        source: 'defillama',
        avgFeeRate: AVG_FEE_RATE,
        timestamp: Date.now(),
        methodology: 'Fee revenue is used as a market-share proxy. Volume is implied by dividing fees by a blended 0.035% taker rate.',
      },
    };

    cache.set(cacheKey, { body, ts: Date.now() });
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[perp-dex-volume] error:', msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 502 });
  }
}
