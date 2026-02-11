import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'sin1';

// Cache the result for 10 minutes to avoid hammering the API
let cachedData: { value: number; classification: string; timestamp: number } | null = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  // Return cache if fresh
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedData);
  }

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
        return NextResponse.json(cachedData);
      }
    }

    // Fallback if API fails but we have stale cache
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Ultimate fallback — neutral
    return NextResponse.json({
      value: 50,
      classification: 'Neutral',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Fear & Greed API error:', error);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    return NextResponse.json({
      value: 50,
      classification: 'Neutral',
      timestamp: Date.now(),
    });
  }
}
