import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { CURATED_MAPPINGS, extractKeywords, keywordSimilarity } from '@/lib/api/prediction-markets/mappings';
import type { PredictionMarket, PredictionArbitrage, PredictionMarketsResponse } from '@/lib/api/prediction-markets/types';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

// --- Polymarket fetcher ---
async function fetchPolymarket(): Promise<PredictionMarket[]> {
  const res = await fetchWithTimeout(
    'https://gamma-api.polymarket.com/markets?limit=200&active=true&order=volume24hr&ascending=false',
    {},
    15000
  );
  if (!res.ok) throw new Error(`Polymarket HTTP ${res.status}`);
  const markets: any[] = await res.json();

  return markets
    .filter((m: any) => m.outcomePrices && m.active && m.volume !== '0')
    .map((m: any) => {
      let prices: number[] = [0.5, 0.5];
      try {
        const parsed = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices;
        prices = parsed.map((p: any) => parseFloat(p) || 0.5);
      } catch { /* use defaults */ }

      return {
        id: String(m.id || m.conditionId || ''),
        platform: 'polymarket' as const,
        question: m.question || '',
        slug: m.slug || '',
        yesPrice: prices[0] ?? 0.5,
        noPrice: prices[1] ?? 0.5,
        volume24h: parseFloat(m.volume24hr) || 0,
        totalVolume: parseFloat(m.volume) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        openInterest: 0,
        endDate: m.endDate || '',
        category: extractCategory(m),
        active: true,
      };
    });
}

function extractCategory(m: any): string {
  if (m.tags && Array.isArray(m.tags) && m.tags.length > 0) return m.tags[0];
  if (m.groupItemTitle) return m.groupItemTitle;
  return 'Other';
}

// --- Kalshi fetcher ---
async function fetchKalshi(): Promise<PredictionMarket[]> {
  const res = await fetchWithTimeout(
    'https://api.elections.kalshi.com/trade-api/v2/markets?limit=200&status=open',
    {},
    15000
  );
  if (!res.ok) throw new Error(`Kalshi HTTP ${res.status}`);
  const json: any = await res.json();
  const markets: any[] = json.markets || [];

  return markets
    .filter((m: any) => m.status === 'active' || m.status === 'open')
    .map((m: any) => {
      const yesBid = (m.yes_bid ?? m.last_price ?? 50) / 100;
      const noBid = (m.no_bid ?? (100 - (m.last_price ?? 50))) / 100;

      return {
        id: m.ticker || '',
        platform: 'kalshi' as const,
        question: m.title || m.ticker || '',
        slug: m.ticker || '',
        yesPrice: Math.max(0, Math.min(1, yesBid)),
        noPrice: Math.max(0, Math.min(1, noBid)),
        volume24h: m.volume_24h || 0,
        totalVolume: m.volume || 0,
        liquidity: 0,
        openInterest: m.open_interest || 0,
        endDate: m.close_time || '',
        category: m.category || 'Other',
        active: true,
      };
    });
}

// --- Market matching engine ---
function matchMarkets(
  polymarkets: PredictionMarket[],
  kalshiMarkets: PredictionMarket[]
): PredictionArbitrage[] {
  const matched: PredictionArbitrage[] = [];
  const usedPoly = new Set<string>();
  const usedKalshi = new Set<string>();

  // Pass 1: Curated regex mappings
  for (const mapping of CURATED_MAPPINGS) {
    const polyRe = new RegExp(mapping.polymarketMatch, 'i');
    const kalshiRe = new RegExp(mapping.kalshiMatch, 'i');

    const poly = polymarkets.find(m => !usedPoly.has(m.id) && polyRe.test(m.question));
    const kalshi = kalshiMarkets.find(m =>
      !usedKalshi.has(m.id) && (kalshiRe.test(m.question) || kalshiRe.test(m.id))
    );

    if (poly && kalshi) {
      usedPoly.add(poly.id);
      usedKalshi.add(kalshi.id);
      matched.push(buildArbitrage(poly, kalshi, 'curated', mapping.label, mapping.category));
    }
  }

  // Pass 2: Keyword fuzzy matching
  const SIMILARITY_THRESHOLD = 0.4;
  for (const poly of polymarkets) {
    if (usedPoly.has(poly.id)) continue;
    const polyKW = extractKeywords(poly.question);
    if (polyKW.length < 2) continue; // skip very short questions

    let bestMatch: PredictionMarket | null = null;
    let bestScore = 0;

    for (const kalshi of kalshiMarkets) {
      if (usedKalshi.has(kalshi.id)) continue;
      const kalshiKW = extractKeywords(kalshi.question);
      if (kalshiKW.length < 2) continue;

      const score = keywordSimilarity(polyKW, kalshiKW);
      if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
        bestScore = score;
        bestMatch = kalshi;
      }
    }

    if (bestMatch) {
      usedPoly.add(poly.id);
      usedKalshi.add(bestMatch.id);
      matched.push(buildArbitrage(poly, bestMatch, 'auto', poly.question, poly.category));
    }
  }

  return matched.sort((a, b) => b.spreadPercent - a.spreadPercent);
}

function buildArbitrage(
  poly: PredictionMarket,
  kalshi: PredictionMarket,
  matchType: 'curated' | 'auto',
  question: string,
  category: string
): PredictionArbitrage {
  const spread = Math.abs(poly.yesPrice - kalshi.yesPrice);
  const direction = poly.yesPrice < kalshi.yesPrice ? 'buy-poly-yes' : 'buy-kalshi-yes';

  return {
    id: `${poly.id}_${kalshi.id}`,
    matchType,
    question,
    category,
    polymarket: poly,
    kalshi,
    spread,
    spreadPercent: +(spread * 100).toFixed(2),
    direction,
    polymarketUrl: `https://polymarket.com/event/${poly.slug}`,
    kalshiUrl: `https://kalshi.com/markets/${kalshi.slug}`,
  };
}

export async function GET(_request: NextRequest) {
  const errors: string[] = [];

  const [polyResult, kalshiResult] = await Promise.allSettled([
    fetchPolymarket(),
    fetchKalshi(),
  ]);

  const poly = polyResult.status === 'fulfilled' ? polyResult.value : [];
  const kalshi = kalshiResult.status === 'fulfilled' ? kalshiResult.value : [];

  if (polyResult.status === 'rejected') errors.push(`Polymarket: ${polyResult.reason}`);
  if (kalshiResult.status === 'rejected') errors.push(`Kalshi: ${kalshiResult.reason}`);

  const arbitrage = matchMarkets(poly, kalshi);

  const response: PredictionMarketsResponse = {
    arbitrage,
    polymarketMarkets: poly,
    kalshiMarkets: kalshi,
    meta: {
      polymarketCount: poly.length,
      kalshiCount: kalshi.length,
      matchedCount: arbitrage.length,
      timestamp: Date.now(),
      ...(errors.length > 0 ? { errors } : {}),
    },
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
