/**
 * GET /api/stablecoins
 *
 * Proxies DefiLlama stablecoins API.
 * Returns top stablecoins with market cap, chain breakdown, and changes.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [stableRes, chartRes] = await Promise.all([
      fetch('https://stablecoins.llama.fi/stablecoins?includePrices=true', {
        next: { revalidate: 300 },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch('https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=1', {
        next: { revalidate: 300 },
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    if (!stableRes?.peggedAssets) {
      return NextResponse.json({ error: 'Failed to fetch stablecoin data' }, { status: 502 });
    }

    // Process top stablecoins
    interface RawStable { id?: string; name?: string; symbol?: string; pegType?: string; price?: number; circulating?: { peggedUSD?: number }; circulatingPrevWeek?: { peggedUSD?: number }; circulatingPrevMonth?: { peggedUSD?: number }; chainCirculating?: Record<string, { current?: { peggedUSD?: number } }> }
    const stables = (stableRes.peggedAssets as RawStable[])
      .filter((s) => s.pegType === 'peggedUSD')
      .map((s) => {
        const currentMcap = s.circulating?.peggedUSD || 0;
        const chains: Record<string, number> = {};
        if (s.chainCirculating) {
          Object.entries(s.chainCirculating).forEach(([chain, data]) => {
            const val = data?.current?.peggedUSD || 0;
            if (val > 0) chains[chain] = val;
          });
        }

        return {
          id: s.id,
          name: s.name,
          symbol: s.symbol,
          mcap: currentMcap,
          price: s.price ?? 1,
          chains,
          chainCount: Object.keys(chains).length,
          change7d: s.circulatingPrevWeek?.peggedUSD
            ? ((currentMcap - s.circulatingPrevWeek.peggedUSD) / s.circulatingPrevWeek.peggedUSD) * 100
            : null,
          change30d: s.circulatingPrevMonth?.peggedUSD
            ? ((currentMcap - s.circulatingPrevMonth.peggedUSD) / s.circulatingPrevMonth.peggedUSD) * 100
            : null,
        };
      })
      .filter((s: any) => s.mcap > 1_000_000) // At least $1M mcap
      .sort((a: any, b: any) => b.mcap - a.mcap)
      .slice(0, 25);

    // Total mcap
    const totalMcap = stables.reduce((s: number, t: any) => s + t.mcap, 0);

    return NextResponse.json({
      stablecoins: stables,
      totalMcap,
      count: stables.length,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch stablecoin data' },
      { status: 500 },
    );
  }
}
