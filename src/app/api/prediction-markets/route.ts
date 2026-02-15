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
    'https://gamma-api.polymarket.com/markets?limit=200&active=true&closed=false&order=volume24hr&ascending=false',
    {},
    15000
  );
  if (!res.ok) throw new Error(`Polymarket HTTP ${res.status}`);
  const markets: any[] = await res.json();

  return markets
    .filter((m: any) => {
      if (!m.outcomePrices || !m.active || m.closed) return false;
      if (m.volume === '0' || m.volume === 0) return false;
      // Filter out resolved markets (YES near 0 or 1)
      let prices: number[] = [0.5, 0.5];
      try {
        const parsed = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices) : m.outcomePrices;
        prices = parsed.map((p: any) => parseFloat(p) || 0.5);
      } catch { /* */ }
      const yesPrice = prices[0] ?? 0.5;
      // Skip markets that are essentially resolved (YES < 0.02 or > 0.98)
      if (yesPrice < 0.02 || yesPrice > 0.98) return false;
      return true;
    })
    .map((m: any) => {
      let prices: number[] = [0.5, 0.5];
      try {
        const parsed = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices) : m.outcomePrices;
        prices = parsed.map((p: any) => parseFloat(p) || 0.5);
      } catch { /* */ }

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
  // Infer category from question keywords
  const q = (m.question || '').toLowerCase();
  if (/bitcoin|btc|ethereum|eth|crypto|solana|xrp/i.test(q)) return 'Crypto';
  if (/fed |interest rate|inflation|gdp|cpi|recession|tariff/i.test(q)) return 'Economics';
  if (/trump|biden|election|president|congress|senate|government|shutdown/i.test(q)) return 'Politics';
  if (/win on|match|game|championship|nba|nfl|fifa|uefa|league/i.test(q)) return 'Sports';
  if (/openai|ai |deepseek|google|apple|tesla|spacex/i.test(q)) return 'Tech';
  return 'Other';
}

// --- Kalshi fetcher ---
// The default /markets endpoint returns low-quality sports parlays.
// Instead, fetch from specific interesting series that have real prediction markets.
const KALSHI_SERIES = [
  // Crypto
  'KXBTC2026200', 'KXETHMAXMON', 'KXETHMINY', 'KXETHFLIP', 'KXBCH', 'KXDJTCHAIN',
  'KXTEXASBTC', 'KXETHE', 'KXETHETF', 'KXCRYPTODAY1',
  // Economics
  'KXRATECUTCOUNT', 'CPIYOY', 'KXAVGTARIFF', 'KXGDPYEAR', 'KXACPICORE-',
  'FXEURO', 'KXGASD', 'KXFEDDISSENT', 'KXFEDEMPLOYEES', 'KXCPICN', 'CPIAR',
  'TNOTED', 'KXREVSOL', 'CPIGAS',
  // Politics
  'GOVSHUT', 'KXTARIFFSGLOBAL', 'KXTARIFFSEU', 'KXTARIFFSMEX', 'KXTARIFFRATEPRC',
  'KXTARIFFSCOPPER', 'KXVOTESHUTDOWNH', 'KXGOVREOPEN2025',
  'KXTRUMPMOSCOW', 'KXTRUMPZELENSKYY', 'KXUSAIRANAGREEMENT', 'KXCONTEMPT',
  'KXFULLLIDBEFORE8PM', 'KXLEAVEADMIN', 'KXAISECURITY',
  // Tech / Science
  'KXOPENAIPROFIT', 'KXDEEPSEEKR2RELEASE', 'AITURING', 'KXAIOPEN',
  'KXCOMPBANCHINESEAI', 'KXANTITRUSTOAIMSFT', 'GOOGLECEOCHANGE', 'APPLEAI',
  // Events
  'KXNEWPOPE', 'KXELONMARS',
  // Financials
  'KXOAIANTH', 'KXRAMPBREX', 'KXDEELRIP',
];

async function fetchKalshi(): Promise<PredictionMarket[]> {
  const allMarkets: PredictionMarket[] = [];
  const seen = new Set<string>();

  // Fetch markets from each interesting series in parallel (batched)
  const batchSize = 10;
  for (let i = 0; i < KALSHI_SERIES.length; i += batchSize) {
    const batch = KALSHI_SERIES.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(series =>
        fetchWithTimeout(
          `https://api.elections.kalshi.com/trade-api/v2/markets?limit=20&series_ticker=${series}&status=open`,
          {},
          10000
        ).then(r => r.ok ? r.json() : { markets: [] })
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const markets: any[] = result.value.markets || [];
      for (const m of markets) {
        if (!m.ticker || seen.has(m.ticker)) continue;
        // Only include markets with actual price data
        if ((m.yes_bid === 0 || m.yes_bid == null) && (m.last_price === 0 || m.last_price == null)) continue;
        seen.add(m.ticker);

        const yesBid = (m.yes_bid ?? m.last_price ?? 50) / 100;
        const noBid = (m.no_bid ?? (100 - (m.last_price ?? 50))) / 100;

        // Infer category from series ticker
        const seriesTicker = m.series_ticker || m.ticker || '';
        let category = m.category || 'Other';
        if (!category || category === 'Other') {
          if (/BTC|ETH|CRYPTO|BCH|DJT/i.test(seriesTicker)) category = 'Crypto';
          else if (/CPI|GDP|FED|RATE|TARIFF|FXEURO|TNOTE|GAS|INFLATION/i.test(seriesTicker)) category = 'Economics';
          else if (/TRUMP|GOV|SHUTDOWN|IRAN|ADMIN|VOTE|LEAV/i.test(seriesTicker)) category = 'Politics';
          else if (/AI|OPENAI|DEEP|GOOGLE|APPLE|TURING/i.test(seriesTicker)) category = 'Tech';
        }

        allMarkets.push({
          id: m.ticker,
          platform: 'kalshi' as const,
          question: m.title || m.ticker,
          slug: m.ticker,
          yesPrice: Math.max(0, Math.min(1, yesBid)),
          noPrice: Math.max(0, Math.min(1, noBid)),
          volume24h: m.volume_24h || 0,
          totalVolume: m.volume || 0,
          liquidity: 0,
          openInterest: m.open_interest || 0,
          endDate: m.close_time || '',
          category,
          active: true,
        });
      }
    }
  }

  // Sort by total volume descending
  allMarkets.sort((a, b) => b.totalVolume - a.totalVolume);
  return allMarkets;
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

  // Pass 2: Keyword fuzzy matching (lower threshold since we're comparing different phrasings)
  const SIMILARITY_THRESHOLD = 0.3;
  for (const poly of polymarkets) {
    if (usedPoly.has(poly.id)) continue;
    const polyKW = extractKeywords(poly.question);
    if (polyKW.length < 2) continue;

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
