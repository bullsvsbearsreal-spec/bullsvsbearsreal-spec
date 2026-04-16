import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// L1: In-memory cache (instant, lost on cold start)
let cachedData: { value: number; classification: string; timestamp: number } | null = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// L1: History cache keyed by limit
const historyCache: Record<number, { data: HistoryResponse; time: number }> = {};
const HISTORY_CACHE_TTL = 60 * 60 * 1000; // 1 hour (data updates daily)

const CMC_API_KEY = process.env.CMC_API_KEY || '';
const DB_CACHE_KEY = 'fear-greed';
const DB_CACHE_TTL = 1800; // 30 min in seconds

const VALID_LIMITS = [7, 30, 90, 365] as const;

interface FearGreedEntry {
  value: number;
  classification: string;
  timestamp: number;
}

interface HistoryResponse {
  current: FearGreedEntry;
  history: FearGreedEntry[];
}

function classifyValue(value: number): string {
  if (value <= 20) return 'Extreme Fear';
  if (value <= 40) return 'Fear';
  if (value <= 60) return 'Neutral';
  if (value <= 80) return 'Greed';
  return 'Extreme Greed';
}

async function fetchCMCHistory(limit: number): Promise<HistoryResponse | null> {
  if (!CMC_API_KEY) return null;
  try {
    const res = await fetch(`https://pro-api.coinmarketcap.com/v3/fear-and-greed/historical?limit=${limit}`, {
      headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.data || json.data.length === 0) return null;

    const entries: FearGreedEntry[] = json.data.map((entry: { value: number; value_classification?: string; timestamp?: string; update_time?: string }) => ({
      value: entry.value ?? 50,
      classification: entry.value_classification || classifyValue(entry.value ?? 50),
      timestamp: entry.update_time ? new Date(entry.update_time).getTime() : (entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now()),
    }));

    return {
      current: entries[0],
      history: entries,
    };
  } catch (error) {
    console.error('CMC Fear & Greed history error:', error);
    return null;
  }
}

async function fetchCMCCurrent(): Promise<FearGreedEntry | null> {
  if (!CMC_API_KEY) return null;
  try {
    const res = await fetch('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest', {
      headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.data) return null;

    return {
      value: json.data.value ?? 50,
      classification: json.data.value_classification || classifyValue(json.data.value ?? 50),
      timestamp: json.data.update_time ? new Date(json.data.update_time).getTime() : Date.now(),
    };
  } catch (error) {
    console.error('CMC Fear & Greed error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const wantsHistory = searchParams.get('history') === 'true';
  const rawLimit = parseInt(searchParams.get('limit') || '30');
  const limit = VALID_LIMITS.includes(rawLimit as typeof VALID_LIMITS[number]) ? rawLimit : 30;

  // --- History mode ---
  if (wantsHistory) {
    const cacheKey = `fear-greed-history-${limit}`;

    // L1: In-memory history cache
    const cached = historyCache[limit];
    if (cached && Date.now() - cached.time < HISTORY_CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // L2: DB cache
    if (isDBConfigured()) {
      try {
        const dbData = await getCache<HistoryResponse>(cacheKey);
        if (dbData) {
          historyCache[limit] = { data: dbData, time: Date.now() };
          return NextResponse.json(dbData);
        }
      } catch { /* DB miss — proceed to fetch */ }
    }

    // Fetch from CMC
    const historyData = await fetchCMCHistory(limit);
    if (historyData) {
      historyCache[limit] = { data: historyData, time: Date.now() };
      if (isDBConfigured()) setCache(cacheKey, historyData, 3600).catch(e => console.warn('[fear-greed] cache write failed:', e));
      return NextResponse.json(historyData, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      });
    }

    // Fallback: return stale cache or unavailable signal
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ current: { value: 50, classification: 'Neutral', timestamp: Date.now(), unavailable: true }, history: [] });
  }

  // --- Current value mode ---
  // L1: Return in-memory cache if fresh
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedData);
  }

  // L2: Check DB cache (survives cold starts)
  if (isDBConfigured()) {
    try {
      const dbData = await getCache<typeof cachedData>(DB_CACHE_KEY);
      if (dbData) {
        cachedData = dbData;
        cacheTime = Date.now();
        return NextResponse.json(cachedData);
      }
    } catch { /* DB miss or error — proceed to fetch */ }
  }

  // Fetch from CMC
  const entry = await fetchCMCCurrent();
  if (entry) {
    cachedData = entry;
    cacheTime = Date.now();
    if (isDBConfigured()) setCache(DB_CACHE_KEY, cachedData, DB_CACHE_TTL).catch(e => console.warn('[fear-greed] cache write failed:', e));
    return NextResponse.json(cachedData, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  }

  // Return stale cache or neutral fallback
  if (cachedData) {
    return NextResponse.json(cachedData);
  }

  return NextResponse.json({
    value: 50,
    classification: 'Neutral',
    timestamp: Date.now(),
    unavailable: true,
  });
}
