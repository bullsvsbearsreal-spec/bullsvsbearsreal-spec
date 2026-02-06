import { NextResponse } from 'next/server';

// Force Edge Runtime to run from Singapore (bypass US geo-restrictions)
export const runtime = 'edge';
export const preferredRegion = 'sin1';

// Common headers to help with API requests
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Helper function for fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...commonHeaders, ...options.headers },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Fetch long/short ratio from Binance server-side to avoid CORS
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';

  try {
    // Binance Global Long/Short Account Ratio
    const res = await fetchWithTimeout(
      `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`
    );

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const latest = data[0];
        const longRatio = parseFloat(latest.longAccount) * 100;
        const shortRatio = parseFloat(latest.shortAccount) * 100;

        return NextResponse.json({
          longRatio,
          shortRatio,
          symbol,
          timestamp: latest.timestamp,
        });
      }
    }

    // Fallback to default
    return NextResponse.json({
      longRatio: 50,
      shortRatio: 50,
      symbol,
    });
  } catch (error) {
    console.error('Long/Short ratio error:', error);

    // Return default values on error
    return NextResponse.json({
      longRatio: 50,
      shortRatio: 50,
      symbol,
    });
  }
}
