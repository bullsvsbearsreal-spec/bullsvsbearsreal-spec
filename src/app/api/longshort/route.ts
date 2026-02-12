import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';

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
