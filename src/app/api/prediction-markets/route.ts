import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { CURATED_MAPPINGS, extractKeywords, keywordSimilarity, extractNumbers, hasConflictingPolarity } from '@/lib/api/prediction-markets/mappings';
import type { PredictionMarket, PredictionArbitrage, PredictionMarketsResponse, PredictionPlatform } from '@/lib/api/prediction-markets/types';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

// ─── Polymarket ──────────────────────────────────────────────
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
      let prices: number[] = [0.5, 0.5];
      try {
        const parsed = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices) : m.outcomePrices;
        prices = parsed.map((p: any) => parseFloat(p) || 0.5);
      } catch { /* */ }
      const yesPrice = prices[0] ?? 0.5;
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
        category: inferCategory(m.question || '', m.tags),
        active: true,
        url: `https://polymarket.com/event/${m.slug || ''}`,
      };
    });
}

// ─── Kalshi ──────────────────────────────────────────────────
// Curated series with actual volume — skip dead daily tickers (KXBTCD, KXETHD)
const KALSHI_SERIES = [
  // Crypto (yearly targets — high volume)
  'KXBTCMAXY', 'KXBTCMINY', 'KXBTC2026200', 'KXETHMAXMON', 'KXETHMINY',
  'KXETHFLIP', 'KXBCH', 'KXDJTCHAIN', 'KXTEXASBTC', 'KXETHE', 'KXETHETF',
  'KXCRYPTODAY1',
  // Economics
  'KXFED', 'KXRATECUTCOUNT', 'CPIYOY', 'KXAVGTARIFF', 'KXGDPYEAR',
  'KXACPICORE-', 'FXEURO', 'KXGASD', 'KXFEDDISSENT', 'KXFEDEMPLOYEES',
  'KXCPICN', 'CPIAR', 'TNOTED', 'KXREVSOL', 'CPIGAS',
  // Politics
  'GOVSHUT', 'KXTARIFFSGLOBAL', 'KXTARIFFSEU', 'KXTARIFFSMEX',
  'KXTARIFFRATEPRC', 'KXTARIFFSCOPPER', 'KXVOTESHUTDOWNH', 'KXGOVREOPEN2025',
  'KXTRUMPMOSCOW', 'KXTRUMPZELENSKYY', 'KXUSAIRANAGREEMENT', 'KXCONTEMPT',
  'KXFULLLIDBEFORE8PM', 'KXLEAVEADMIN', 'KXAISECURITY', 'KXDEPORTATIONS',
  'KXPRESNOMFEDCHAIR',
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
        if ((m.yes_bid === 0 || m.yes_bid == null) && (m.last_price === 0 || m.last_price == null)) continue;
        seen.add(m.ticker);

        const yesBid = (m.yes_bid ?? m.last_price ?? 50) / 100;
        const noBid = (m.no_bid ?? (100 - (m.last_price ?? 50))) / 100;

        const seriesTicker = m.series_ticker || m.ticker || '';
        let category = m.category || 'Other';
        if (!category || category === 'Other') {
          if (/BTC|ETH|CRYPTO|BCH|DJT/i.test(seriesTicker)) category = 'Crypto';
          else if (/CPI|GDP|FED|RATE|TARIFF|FXEURO|TNOTE|GAS|INFLATION/i.test(seriesTicker)) category = 'Economics';
          else if (/TRUMP|GOV|SHUTDOWN|IRAN|ADMIN|VOTE|LEAV|DEPORT/i.test(seriesTicker)) category = 'Politics';
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
          url: `https://kalshi.com/markets/${m.ticker}`,
        });
      }
    }
  }

  allMarkets.sort((a, b) => b.totalVolume - a.totalVolume);
  return allMarkets;
}

// ─── Shared helpers ──────────────────────────────────────────
function inferCategory(question: string, tags?: any, fallback?: string): string {
  if (tags && Array.isArray(tags) && tags.length > 0) return tags[0];
  const q = question.toLowerCase();
  if (/bitcoin|btc|ethereum|eth|crypto|solana|xrp|defi/i.test(q)) return 'Crypto';
  if (/fed |interest rate|inflation|gdp|cpi|recession|tariff|economy/i.test(q)) return 'Economics';
  if (/trump|biden|election|president|congress|senate|government|shutdown|republican|democrat/i.test(q)) return 'Politics';
  if (/\bvs\.?\b|win\b.*\b(?:match|game|tournament|championship|cup|open|masters|grand prix)|championship|nba|nfl|nhl|mlb|fifa|uefa|league|super bowl|premier league|ligue|serie a|la liga|wimbledon|playoffs/i.test(q)) return 'Sports';
  if (/openai|ai |deepseek|google|apple|tesla|spacex|agi|artificial/i.test(q)) return 'Tech';
  if (/war|iran|russia|ukraine|china|military|strike|nuclear/i.test(q)) return 'Geopolitics';
  if (fallback && fallback !== 'Other') return fallback;
  return 'Other';
}

// ─── Cross-platform matching ─────────────────────────────────
function matchAllPlatforms(
  platformData: Record<PredictionPlatform, PredictionMarket[]>
): PredictionArbitrage[] {
  const allMatches: PredictionArbitrage[] = [];
  const platforms = Object.keys(platformData) as PredictionPlatform[];

  // Match every pair of platforms
  for (let i = 0; i < platforms.length; i++) {
    for (let j = i + 1; j < platforms.length; j++) {
      const pA = platforms[i];
      const pB = platforms[j];
      const marketsA = platformData[pA];
      const marketsB = platformData[pB];
      if (marketsA.length === 0 || marketsB.length === 0) continue;

      const matches = matchPair(marketsA, marketsB, pA, pB);
      allMatches.push(...matches);
    }
  }

  return allMatches.sort((a, b) => b.spreadPercent - a.spreadPercent);
}

function matchPair(
  marketsA: PredictionMarket[],
  marketsB: PredictionMarket[],
  platformA: PredictionPlatform,
  platformB: PredictionPlatform
): PredictionArbitrage[] {
  const matched: PredictionArbitrage[] = [];
  const usedA = new Set<string>();
  const usedB = new Set<string>();

  // Pass 1: Curated regex mappings (only for polymarket↔kalshi)
  if (
    (platformA === 'polymarket' && platformB === 'kalshi') ||
    (platformA === 'kalshi' && platformB === 'polymarket')
  ) {
    const poly = platformA === 'polymarket' ? marketsA : marketsB;
    const kalshi = platformA === 'kalshi' ? marketsA : marketsB;
    const polyUsed = platformA === 'polymarket' ? usedA : usedB;
    const kalshiUsed = platformA === 'kalshi' ? usedA : usedB;

    for (const mapping of CURATED_MAPPINGS) {
      const polyRe = new RegExp(mapping.polymarketMatch, 'i');
      const kalshiRe = new RegExp(mapping.kalshiMatch, 'i');

      const pMatch = poly.find(m => !polyUsed.has(m.id) && polyRe.test(m.question));
      const kMatch = kalshi.find(m =>
        !kalshiUsed.has(m.id) && (kalshiRe.test(m.question) || kalshiRe.test(m.id))
      );

      if (pMatch && kMatch) {
        polyUsed.add(pMatch.id);
        kalshiUsed.add(kMatch.id);
        const a = platformA === 'polymarket' ? pMatch : kMatch;
        const b = platformA === 'polymarket' ? kMatch : pMatch;
        matched.push(buildArbitrage(a, b, 'curated', mapping.label, mapping.category));
      }
    }
  }

  // Pass 2: Keyword fuzzy matching (strict)
  const SIMILARITY_THRESHOLD = 0.5;
  for (const mA of marketsA) {
    if (usedA.has(mA.id)) continue;
    const kwA = extractKeywords(mA.question);
    if (kwA.length < 2) continue;

    let bestMatch: PredictionMarket | null = null;
    let bestScore = 0;

    for (const mB of marketsB) {
      if (usedB.has(mB.id)) continue;
      const kwB = extractKeywords(mB.question);
      if (kwB.length < 2) continue;

      const score = keywordSimilarity(kwA, kwB);
      if (score < SIMILARITY_THRESHOLD) continue;

      // Reject conflicting polarity (e.g. "above $100K" vs "below $100K")
      if (hasConflictingPolarity(mA.question, mB.question)) continue;

      // Reject mismatched numerical thresholds (e.g. "$15K" vs "$60K")
      const numsA = extractNumbers(mA.question);
      const numsB = extractNumbers(mB.question);
      if (numsA.length > 0 && numsB.length > 0) {
        const hasNumMatch = numsA.some(a => numsB.some(b =>
          Math.min(a, b) / Math.max(a, b) > 0.8
        ));
        if (!hasNumMatch) continue;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = mB;
      }
    }

    if (bestMatch) {
      usedA.add(mA.id);
      usedB.add(bestMatch.id);
      matched.push(buildArbitrage(mA, bestMatch, 'auto', mA.question, mA.category));
    }
  }

  return matched;
}

function buildArbitrage(
  a: PredictionMarket,
  b: PredictionMarket,
  matchType: 'curated' | 'auto',
  question: string,
  category: string
): PredictionArbitrage {
  const spread = Math.abs(a.yesPrice - b.yesPrice);
  const cheaper = a.yesPrice < b.yesPrice ? a.platform : b.platform;

  return {
    id: `${a.id}_${b.id}`,
    matchType,
    question,
    category,
    platformA: a,
    platformB: b,
    spread,
    spreadPercent: +(spread * 100).toFixed(2),
    direction: `buy-${cheaper}-yes`,
    urlA: a.url,
    urlB: b.url,
  };
}

// ─── Main handler ────────────────────────────────────────────
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

  const platformData = { polymarket: poly, kalshi };
  const arbitrage = matchAllPlatforms(platformData);

  const response: PredictionMarketsResponse = {
    arbitrage,
    markets: platformData,
    meta: {
      counts: {
        polymarket: poly.length,
        kalshi: kalshi.length,
      },
      matchedCount: arbitrage.length,
      timestamp: Date.now(),
      ...(errors.length > 0 ? { errors } : {}),
    },
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
