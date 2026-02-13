import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const VALID_PERIODS = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];

// Fetch long/short ratio from Binance server-side to avoid CORS
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';
  const period = VALID_PERIODS.includes(searchParams.get('period') || '')
    ? searchParams.get('period')!
    : '5m';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '1', 10), 1), 500);

  try {
    // Binance Global Long/Short Account Ratio
    const res = await fetchWithTimeout(
      `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=${limit}`
    );

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        if (limit === 1) {
          // Single point — backward-compatible response
          const latest = data[0];
          return NextResponse.json({
            longRatio: parseFloat(latest.longAccount) * 100,
            shortRatio: parseFloat(latest.shortAccount) * 100,
            symbol,
            timestamp: latest.timestamp,
          });
        }

        // Historical data — array response
        const points = data.map((d: any) => ({
          longRatio: parseFloat(d.longAccount) * 100,
          shortRatio: parseFloat(d.shortAccount) * 100,
          timestamp: d.timestamp,
        }));

        return NextResponse.json({
          symbol,
          period,
          points,
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
