import { NextResponse } from 'next/server';
import { getCache, setCache, isDBConfigured } from '@/lib/db';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// L1: In-memory cache (instant, lost on cold start)
let cachedData: { value: number; classification: string; timestamp: number } | null = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const CMC_API_KEY = process.env.CMC_API_KEY || '';
const DB_CACHE_KEY = 'fear-greed';
const DB_CACHE_TTL = 1800; // 30 min in seconds

export async function GET() {
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
