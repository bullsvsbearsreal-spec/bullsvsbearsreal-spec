import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
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

async function fetchHistory(limit: number): Promise<HistoryResponse | null> {
  try {
    const res = await fetch(`https://api.alternative.me/fng/?limit=${limit}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.data || json.data.length === 0) return null;

    const entries: FearGreedEntry[] = json.data.map((entry: { value: string; value_classification: string; timestamp: string }) => ({
      value: parseInt(entry.value) || 50,
      classification: entry.value_classification || 'Neutral',
      timestamp: (parseInt(entry.timestamp) * 1000) || Date.now(),
    }));

    return {
      current: entries[0],
      history: entries,
    };
  } catch (error) {
    console.error('Fear & Greed history fetch error:', error);
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

    // Fetch from alternative.me
    const historyData = await fetchHistory(limit);
    if (historyData) {
      historyCache[limit] = { data: historyData, time: Date.now() };
      if (isDBConfigured()) setCache(cacheKey, historyData, 3600).catch(() => {});
      return NextResponse.json(historyData);
    }

    // Fallback: return stale cache or empty
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ current: { value: 50, classification: 'Neutral', timestamp: Date.now() }, history: [] });
  }

  // --- Current value mode (unchanged) ---
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

  // Try CMC first
  try {
    const res = await fetch('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest', {
      headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        cachedData = {
          value: json.data.value ?? 50,
          classification: json.data.value_classification || 'Neutral',
          timestamp: json.data.update_time ? new Date(json.data.update_time).getTime() : Date.now(),
        };
        cacheTime = Date.now();
        if (isDBConfigured()) setCache(DB_CACHE_KEY, cachedData, DB_CACHE_TTL).catch(() => {});
        return NextResponse.json(cachedData);
      }
    }
  } catch (error) {
    console.error('CMC Fear & Greed error:', error);
  }

  // Fallback to alternative.me (free, no key needed)
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        const entry = json.data[0];
        cachedData = {
          value: parseInt(entry.value) || 50,
          classification: entry.value_classification || 'Neutral',
          timestamp: parseInt(entry.timestamp) * 1000 || Date.now(),
        };
        cacheTime = Date.now();
        if (isDBConfigured()) setCache(DB_CACHE_KEY, cachedData, DB_CACHE_TTL).catch(() => {});
        return NextResponse.json(cachedData);
      }
    }
  } catch (error) {
    console.error('alternative.me Fear & Greed fallback error:', error);
  }

  // Return stale cache or neutral fallback
  if (cachedData) {
    return NextResponse.json(cachedData);
  }

  return NextResponse.json({
    value: 50,
    classification: 'Neutral',
    timestamp: Date.now(),
  });
}
