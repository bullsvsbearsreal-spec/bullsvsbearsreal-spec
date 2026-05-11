import { NextRequest, NextResponse } from 'next/server';
import {
  getArbRoundTripFee, EXCHANGE_FEES, isExchangeDex,
  FEE_MODEL_VERSION, FEE_MODEL_UPDATED_AT, getFeeScheduleSnapshot,
} from '@/lib/constants/exchanges';
import { computeGrade } from '@/app/funding/components/arbitrage/utils';
import { authenticateV1Request } from '@/lib/api/v1-auth';
import { getFundingData } from '../../_shared/funding-core';
import { getOIData } from '../../_shared/oi-core';
import { fetchArbHistory } from '@/lib/api/aggregator';
import type { AssetClassFilter } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Symbol aliases for equivalent assets
const SYMBOL_ALIASES: Record<string, string> = {
  'XAUT': 'XAU', 'PAXG': 'XAU', 'GOLD': 'XAU',
  'SILVER': 'XAG',
};

/**
 * Compute arbitrage opportunities from raw funding data.
 * Server-side equivalent of fetchFundingArbitrage() from the aggregator
 * (which uses HTTP calls that fail in serverless context).
 */
function computeArbitrageFromFunding(fundingData: any[]) {
  const symbolMap = new Map<string, Array<{ exchange: string; rate: number }>>();
  const priceMap = new Map<string, Array<{ exchange: string; price: number }>>();
  const intervalTracker = new Map<string, Record<string, string>>();

  fundingData.forEach((fr: any) => {
    const canonicalSymbol = SYMBOL_ALIASES[fr.symbol] || fr.symbol;
    const mult = fr.fundingInterval === '1h' ? 8 : fr.fundingInterval === '4h' ? 2 : 1;
    const existing = symbolMap.get(canonicalSymbol) || [];

    // For DEXes with separate long/short rates, use directional component only
    let effectiveRate: number;
    if (fr.fundingRateLong != null && fr.fundingRateShort != null) {
      effectiveRate = (fr.fundingRateLong - fr.fundingRateShort) / 2;
    } else {
      effectiveRate = fr.fundingRate;
    }
    existing.push({ exchange: fr.exchange, rate: effectiveRate * mult });
    symbolMap.set(canonicalSymbol, existing);

    if (fr.markPrice && fr.markPrice > 0) {
      const prices = priceMap.get(canonicalSymbol) || [];
      prices.push({ exchange: fr.exchange, price: fr.markPrice });
      priceMap.set(canonicalSymbol, prices);
    }

    if (fr.fundingInterval) {
      const intervals = intervalTracker.get(canonicalSymbol) || {};
      intervals[fr.exchange] = fr.fundingInterval;
      intervalTracker.set(canonicalSymbol, intervals);
    }
  });

  // Calculate spread for symbols with 2+ exchanges
  return Array.from(symbolMap.entries())
    .filter(([_, exchanges]) => exchanges.length >= 2)
    .map(([symbol, exchanges]) => {
      const rates = exchanges.map(e => e.rate);
      const maxRate = Math.max(...rates);
      const minRate = Math.min(...rates);
      return {
        symbol,
        exchanges,
        spread: maxRate - minRate,
        markPrices: priceMap.get(symbol) || [],
        intervals: intervalTracker.get(symbol) || {},
      };
    })
    .sort((a, b) => b.spread - a.spread);
}

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
  const VALID_ASSET_CLASSES = ['crypto', 'stocks', 'forex', 'commodities', 'all'] as const;
  const rawAC = searchParams.get('assetClass') || 'crypto';
  const assetClass = (VALID_ASSET_CLASSES as readonly string[]).includes(rawAC) ? rawAC as AssetClassFilter : 'crypto' as AssetClassFilter;

  try {
    // Fetch funding + OI data directly (no self-referential HTTP)
    const [fundingResult, oiResult] = await Promise.all([
      getFundingData(assetClass),
      getOIData(),
    ]);

    // Build OI map from direct data
    const oiData: any[] = oiResult?.result?.data || [];
    const oiMap = new Map<string, Map<string, number>>();
    oiData.forEach((item: any) => {
      const rawSym = item.symbol?.toUpperCase();
      if (!rawSym) return;
      const sym = SYMBOL_ALIASES[rawSym] || rawSym;
      if (!oiMap.has(sym)) oiMap.set(sym, new Map());
      oiMap.get(sym)!.set(item.exchange, item.openInterestValue || 0);
    });

    // Compute arb opportunities from funding data
    const fundingData = fundingResult?.result?.data || [];
    const arbData = computeArbitrageFromFunding(fundingData);

    // Fetch historical spreads for stability analysis
    const symbols = arbData.map(a => a.symbol);
    const historyMap = await fetchArbHistory(symbols);

    // Enrich each arb pair
    const enriched = arbData.map(arb => {
      const exchanges = arb.exchanges;
      const sorted = [...exchanges].sort((a, b) => b.rate - a.rate);
      const shortExchange = sorted[0]; // highest rate = short here
      const longExchange = sorted[sorted.length - 1]; // lowest rate = long here

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

      // Intervals for the short/long sides
      const highInterval = arb.intervals?.[shortExchange.exchange] || '8h';
      const lowInterval = arb.intervals?.[longExchange.exchange] || '8h';

      // Grade (with full scoring)
      const { grade } = computeGrade(grossSpread8h, minSideOI, stability, roundTripFee, {
        highOI: shortOI, lowOI: longOI, highInterval, lowInterval,
      });

      // Annualized
      const annualizedPct = netSpread8h > 0 ? netSpread8h * (365 * 3) : 0;

      // Daily PnL per $10K
      const dailyPnlPer10k = netSpread8h > 0 ? (netSpread8h / 100) * 10000 * 3 : 0;

      // Per-exchange fees (% per trade) — pulled from the same EXCHANGE_FEES
      // table the round-trip math uses, so callers can verify the fee
      // assumption matches their own model or back the spread out.
      const shortFees = EXCHANGE_FEES[shortExchange.exchange];
      const longFees  = EXCHANGE_FEES[longExchange.exchange];

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
          // Total round-trip fee assumed in netSpread8h (taker × 4: open+close on each side).
          roundTrip: Math.round(roundTripFee * 10000) / 10000,
          // Per-side maker + taker, so callers can recompute net spread
          // under their own fill assumptions (e.g. maker-only routing).
          shortExchangeTaker: shortFees?.taker ?? null,
          shortExchangeMaker: shortFees?.maker ?? null,
          longExchangeTaker:  longFees?.taker  ?? null,
          longExchangeMaker:  longFees?.maker  ?? null,
          // Legacy aliases — keep around so existing integrations don't break.
          // Both default to the taker rate (which is what netSpread8h uses).
          shortExchangeFee: shortFees?.taker ?? 0,
          longExchangeFee:  longFees?.taker  ?? 0,
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
        // Each venue trading this symbol, with its own maker + taker fee
        // attached so the caller can plan partial fills, alt-pair hedges,
        // or different fee tiers without round-tripping to the fee table.
        allExchanges: exchanges.map(e => {
          const f = EXCHANGE_FEES[e.exchange];
          return {
            exchange: e.exchange,
            rate8h: Math.round(e.rate * 10000) / 10000,
            type: isExchangeDex(e.exchange) ? 'dex' : 'cex',
            makerFee: f?.maker ?? null,
            takerFee: f?.taker ?? null,
          };
        }),
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
        // Fee assumption surface. Callers can inspect `version` +
        // `updatedAt` to know whether their downstream cache is stale,
        // or use the full `schedule` table to recompute net spreads
        // under their own fill assumptions.
        //
        // All values are percent-per-trade (e.g. 0.05 == 0.05%).
        // Maker can be negative on venues that rebate makers (e.g. Nado).
        feeModel: getFeeScheduleSnapshot(),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        // Surface the version as a header too so HEAD-request consumers
        // can cheaply detect a fee-model bump without parsing the body.
        'X-Fee-Model-Version': FEE_MODEL_VERSION,
        'X-Fee-Model-Updated-At': FEE_MODEL_UPDATED_AT,
      },
    });
  } catch (e) {
    console.error('v1/arbitrage error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to compute arbitrage data' },
      { status: 500 },
    );
  }
}
