import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { CURATED_MAPPINGS, extractKeywords, keywordSimilarity, extractNumbers, hasConflictingPolarity } from '@/lib/api/prediction-markets/mappings';
import type { PredictionMarket, PredictionArbitrage, PredictionMarketsResponse, PredictionPlatform } from '@/lib/api/prediction-markets/types';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ─── Polymarket ──────────────────────────────────────────────
async function fetchPolymarket(): Promise<PredictionMarket[]> {
  const res = await fetchWithTimeout(
    'https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false&order=volume24hr&ascending=false',
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
      } catch (e) {
        console.warn('[prediction-markets] Polymarket price parse failed:', m.id, e);
      }
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
      } catch (e) {
        console.warn('[prediction-markets] Polymarket price parse failed:', m.id, e);
      }

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
// Hybrid fetch strategy:
// 1) series_ticker queries for crypto/sports (not in events API)
// 2) events API for politics/economics/tech (series_ticker broken for these)

// Series that still work via series_ticker param (crypto + sports)
const KALSHI_SERIES = [
  'KXBTCMAXY', 'KXBTCMINY', 'KXBTC2026200', 'KXETHMAXMON', 'KXETHMINY',
  'KXSOL', 'KXRP', 'KXDOGE', 'KXADA',
  'KXNBA', 'KXF1', 'KXELONMARS', 'KXNEWPOPE',
];

// Categories worth fetching from events API
const KALSHI_USEFUL_CATEGORIES = new Set([
  'Politics', 'Elections', 'Economics', 'Financials', 'Companies',
  'Science and Technology', 'World', 'Social',
]);

function categorizeKalshi(eventTicker: string, title: string, eventCategory?: string): string {
  const et = eventTicker || '';
  const t = title || '';
  if (/BTC|ETH|CRYPTO|SOL|XRP|DOGE|ADA/i.test(et) || /bitcoin|ethereum|crypto|solana/i.test(t)) return 'Crypto';
  if (/CPI|GDP|FED|RATE|TARIFF|FXEURO|TNOTE|GAS|INFLATION/i.test(et) || /fed.*rate|inflation|recession|tariff|gdp|cpi/i.test(t)) return 'Economics';
  if (/TRUMP|GOV|SHUTDOWN|ADMIN|VOTE|DEPORT|ELECTION|PRESIDENT/i.test(et) || /trump|biden|president|congress|government|election/i.test(t)) return 'Politics';
  if (/AI|OPENAI|DEEP|GOOGLE|APPLE|TURING/i.test(et) || /openai|deepseek|agi|artificial/i.test(t)) return 'Tech';
  if (/IRAN|UKRAINE|RUSSIA|CHINA|HORMUZ|REGIME|CEASEFIRE/i.test(et) || /iran|ukraine|russia|ceasefire|invade|regime/i.test(t)) return 'Geopolitics';
  if (/NBA|NFL|FIFA|F1|MLB|NHL|FINALS|CHAMPION/i.test(et) || /\b(?:finals|championship|nba|nfl|f1|fifa)\b/i.test(t)) return 'Sports';
  if (/POPE|MARS|ELON/i.test(et) || /pope|mars|elon/i.test(t)) return 'World';
  if (eventCategory === 'Economics' || eventCategory === 'Financials') return 'Economics';
  if (eventCategory === 'Politics' || eventCategory === 'Elections') return 'Politics';
  if (eventCategory === 'Science and Technology' || eventCategory === 'Companies') return 'Tech';
  if (eventCategory === 'Sports') return 'Sports';
  if (eventCategory === 'World') return 'World';
  return 'Other';
}

function parseKalshiMarket(m: any, eventCategory?: string): PredictionMarket | null {
  if (!m.ticker) return null;

  const yesBid = parseFloat(m.yes_bid_dollars) || parseFloat(m.last_price_dollars) || 0;
  const noBid = parseFloat(m.no_bid_dollars) || (1 - yesBid);
  if (yesBid === 0 && parseFloat(m.last_price_dollars || '0') === 0) return null;

  const category = categorizeKalshi(m.event_ticker || m.ticker || '', m.title || '', eventCategory);

  return {
    id: m.ticker,
    platform: 'kalshi' as const,
    question: m.title || m.ticker,
    slug: m.ticker,
    yesPrice: Math.max(0, Math.min(1, yesBid)),
    noPrice: Math.max(0, Math.min(1, noBid)),
    volume24h: parseFloat(m.volume_24h_fp) || 0,
    totalVolume: parseFloat(m.volume_fp) || 0,
    liquidity: parseFloat(m.liquidity_dollars) || 0,
    openInterest: parseFloat(m.open_interest_fp) || 0,
    endDate: m.close_time || '',
    category,
    active: true,
    url: `https://kalshi.com/markets/${m.ticker}`,
  };
}

async function fetchKalshi(): Promise<PredictionMarket[]> {
  const allMarkets: PredictionMarket[] = [];
  const seen = new Set<string>();

  // ── Strategy A: Series ticker queries for crypto/sports ──
  const batchSize = 6;
  for (let i = 0; i < KALSHI_SERIES.length; i += batchSize) {
    const batch = KALSHI_SERIES.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(series =>
        fetchWithTimeout(
          `https://api.elections.kalshi.com/trade-api/v2/markets?limit=30&series_ticker=${series}&status=open`,
          {},
          10000
        ).then(r => r.ok ? r.json() : { markets: [] })
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const m of (result.value.markets || [])) {
        if (seen.has(m.ticker)) continue;
        const parsed = parseKalshiMarket(m);
        if (parsed) { seen.add(m.ticker); allMarkets.push(parsed); }
      }
    }
  }

  // ── Strategy B: Events API for politics/economics/tech ──
  const eventTickers: { ticker: string; category: string }[] = [];
  let eventCursor: string | undefined;
  for (let page = 0; page < 4; page++) {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/events');
    url.searchParams.set('limit', '200');
    url.searchParams.set('status', 'open');
    if (eventCursor) url.searchParams.set('cursor', eventCursor);

    const res = await fetchWithTimeout(url.toString(), {}, 10000);
    if (!res.ok) break;

    const data = await res.json();
    const events: any[] = data.events || [];
    if (events.length === 0) break;

    for (const e of events) {
      if (!e.event_ticker || e.event_ticker.startsWith('KXMVE')) continue;
      if (!KALSHI_USEFUL_CATEGORIES.has(e.category || '')) continue;
      eventTickers.push({ ticker: e.event_ticker, category: e.category || '' });
    }

    eventCursor = data.cursor;
    if (!eventCursor) break;
  }

  // Fetch markets for discovered events
  for (let i = 0; i < eventTickers.length; i += batchSize) {
    const batch = eventTickers.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(({ ticker, category }) =>
        fetchWithTimeout(
          `https://api.elections.kalshi.com/trade-api/v2/markets?limit=30&event_ticker=${ticker}&status=open`,
          {},
          10000
        )
        .then(r => r.ok ? r.json() : { markets: [] })
        .then(data => ({ markets: data.markets || [], eventCategory: category }))
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { markets, eventCategory } = result.value;
      for (const m of markets) {
        if (seen.has(m.ticker)) continue;
        const parsed = parseKalshiMarket(m, eventCategory);
        if (parsed) { seen.add(m.ticker); allMarkets.push(parsed); }
      }
    }

    if (allMarkets.length >= 600) break;
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

  // Pass 2: Keyword fuzzy matching (relaxed threshold + number tolerance)
  const SIMILARITY_THRESHOLD = 0.22;
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
      // But allow 20% tolerance (e.g. $65K vs $60K are close enough)
      const numsA = extractNumbers(mA.question);
      const numsB = extractNumbers(mB.question);
      if (numsA.length > 0 && numsB.length > 0) {
        const hasNumMatch = numsA.some(a => numsB.some(b => {
          const max = Math.max(a, b);
          return max > 0 && Math.min(a, b) / max > 0.7; // 30% tolerance
        }));
        if (!hasNumMatch) continue;
      }

      // Boost score if categories match
      const catBoost = mA.category.toLowerCase() === mB.category.toLowerCase() ? 0.05 : 0;
      const finalScore = score + catBoost;

      if (finalScore > bestScore) {
        bestScore = finalScore;
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
  // Compare both YES and NO spreads — use the better opportunity
  const yesSpread = Math.abs(a.yesPrice - b.yesPrice);
  const noSpread = Math.abs(a.noPrice - b.noPrice);
  const useNo = noSpread > yesSpread;
  const spread = Math.max(yesSpread, noSpread);

  const direction = useNo
    ? `buy-${a.noPrice < b.noPrice ? a.platform : b.platform}-no`
    : `buy-${a.yesPrice < b.yesPrice ? a.platform : b.platform}-yes`;

  return {
    id: `${a.id}_${b.id}`,
    matchType,
    question,
    category,
    platformA: a,
    platformB: b,
    spread,
    spreadPercent: +(spread * 100).toFixed(2),
    direction,
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
