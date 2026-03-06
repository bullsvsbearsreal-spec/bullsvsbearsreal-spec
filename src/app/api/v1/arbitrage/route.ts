import { NextRequest, NextResponse } from 'next/server';
import { fetchFundingArbitrage, fetchArbHistory } from '@/lib/api/aggregator';
import { getArbRoundTripFee, EXCHANGE_FEES, isExchangeDex } from '@/lib/constants/exchanges';
import { computeGrade } from '@/app/funding/components/arbitrage/utils';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import type { AssetClassFilter } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/v1/arbitrage
 *
 * Returns funding rate arbitrage opportunities with feasibility analysis.
 * Query params:
 *   ?minSpread=0.05    — minimum 8h spread % (default: 0)
 *   ?minOI=100000      — minimum OI in USD on smaller side (default: 0)
 *   ?grade=A,B         — filter by feasibility grade (default: all)
 *   ?symbols=BTC,ETH   — filter by symbols
 *   ?limit=50          — max results (default: 100, max: 500)
 *   ?assetClass=crypto  — crypto|stocks|forex|commodities (default: crypto)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateV1Request(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = request.nextUrl;
  const minSpread = parseFloat(searchParams.get('minSpread') || '0') || 0;
  const minOI = parseFloat(searchParams.get('minOI') || '0') || 0;
  const gradeFilter = searchParams.get('grade')?.split(',').map(g => g.trim().toUpperCase()).filter(Boolean);
  const symbolFilter = searchParams.get('symbols')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100));
  const assetClass = (searchParams.get('assetClass') || 'crypto') as AssetClassFilter;

  try {
    // Fetch from internal API to reuse caching
    const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const oiRes = await fetch(`${baseUrl}/api/openinterest`, { headers: { 'x-internal': '1' } });
    const oiJson = oiRes.ok ? await oiRes.json() : { data: [] };
    const oiData: any[] = oiJson.data || [];

    // Build OI map by symbol+exchange
    const oiMap = new Map<string, Map<string, number>>();
    oiData.forEach((item: any) => {
      const sym = item.symbol?.toUpperCase();
      if (!sym) return;
      if (!oiMap.has(sym)) oiMap.set(sym, new Map());
      oiMap.get(sym)!.set(item.exchange, item.openInterestValue || 0);
    });

    // Fetch arb data
    const arbData = await fetchFundingArbitrage(assetClass);

    // Fetch historical spreads for stability analysis
    const symbols = arbData.map(a => a.symbol);
    const historyMap = await fetchArbHistory(symbols);

    // Enrich each arb pair
    const enriched = arbData.map(arb => {
      const exchanges = arb.exchanges;
      const sorted = [...exchanges].sort((a, b) => b.rate - a.rate);
      const shortExchange = sorted[0]; // highest rate = short here (earn funding)
      const longExchange = sorted[sorted.length - 1]; // lowest rate = long here (pay less)

      const grossSpread8h = shortExchange.rate - longExchange.rate;
      const roundTripFee = getArbRoundTripFee(shortExchange.exchange, longExchange.exchange);
      const netSpread8h = grossSpread8h - roundTripFee;

      // OI per side
      const symOI = oiMap.get(arb.symbol.toUpperCase());
      const shortOI = symOI?.get(shortExchange.exchange) || 0;
      const longOI = symOI?.get(longExchange.exchange) || 0;
      const minSideOI = Math.min(shortOI, longOI);
      const totalOI = (symOI ? Array.from(symOI.values()).reduce((a, b) => a + b, 0) : 0);

      // Stability from history
      const hist = historyMap.get(arb.symbol);
      let stability: 'stable' | 'volatile' | 'new' = 'new';
      if (hist && hist.avg7d > 0) {
        const deviation = Math.abs(grossSpread8h - hist.avg7d) / hist.avg7d;
        stability = deviation <= 0.3 ? 'stable' : 'volatile';
      }

      // Grade
      const { grade } = computeGrade(grossSpread8h, minSideOI, stability, roundTripFee);

      // Annualized
      const annualizedPct = netSpread8h > 0 ? netSpread8h * (365 * 3) : 0; // 3 funding periods/day for 8h

      // Daily PnL per $10K
      const dailyPnlPer10k = netSpread8h > 0 ? (netSpread8h / 100) * 10000 * 3 : 0;

      return {
        symbol: arb.symbol,
        shortExchange: shortExchange.exchange,
        longExchange: longExchange.exchange,
        shortRate8h: shortExchange.rate,
        longRate8h: longExchange.rate,
        grossSpread8h: Math.round(grossSpread8h * 10000) / 10000,
        netSpread8h: Math.round(netSpread8h * 10000) / 10000,
        annualizedPct: Math.round(annualizedPct * 100) / 100,
        dailyPnlPer10k: Math.round(dailyPnlPer10k * 100) / 100,
        fees: {
          roundTrip: Math.round(roundTripFee * 10000) / 10000,
          shortExchangeFee: EXCHANGE_FEES[shortExchange.exchange]?.taker ?? 0,
          longExchangeFee: EXCHANGE_FEES[longExchange.exchange]?.taker ?? 0,
        },
        oi: {
          short: Math.round(shortOI),
          long: Math.round(longOI),
          total: Math.round(totalOI),
          minSide: Math.round(minSideOI),
        },
        grade,
        stability,
        exchangeCount: exchanges.length,
        allExchanges: exchanges.map(e => ({
          exchange: e.exchange,
          rate8h: Math.round(e.rate * 10000) / 10000,
          type: isExchangeDex(e.exchange) ? 'dex' : 'cex',
        })),
      };
    });

    // Apply filters
    let filtered = enriched
      .filter(a => a.grossSpread8h >= minSpread)
      .filter(a => a.oi.minSide >= minOI);

    if (symbolFilter && symbolFilter.length > 0) {
      filtered = filtered.filter(a => symbolFilter.includes(a.symbol));
    }
    if (gradeFilter && gradeFilter.length > 0) {
      filtered = filtered.filter(a => gradeFilter.includes(a.grade));
    }

    // Sort by net spread descending, take limit
    filtered.sort((a, b) => b.netSpread8h - a.netSpread8h);
    filtered = filtered.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: filtered,
      meta: {
        timestamp: Date.now(),
        totalPairs: enriched.length,
        filtered: filtered.length,
        grades: {
          A: enriched.filter(a => a.grade === 'A').length,
          B: enriched.filter(a => a.grade === 'B').length,
          C: enriched.filter(a => a.grade === 'C').length,
          D: enriched.filter(a => a.grade === 'D').length,
        },
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (e) {
    console.error('v1/arbitrage error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to compute arbitrage data' },
      { status: 500 },
    );
  }
}
