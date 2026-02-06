import { NextResponse } from 'next/server';
import axios from 'axios';

// Common headers to help with API requests
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Fetch long/short ratio from Binance server-side to avoid CORS
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';

  try {
    // Binance Global Long/Short Account Ratio
    const res = await axios.get('https://fapi.binance.com/futures/data/globalLongShortAccountRatio', {
      params: {
        symbol: symbol,
        period: '5m',
        limit: 1,
      },
      timeout: 10000,
      headers: commonHeaders,
    });

    if (res.data && res.data.length > 0) {
      const latest = res.data[0];
      const longRatio = parseFloat(latest.longAccount) * 100;
      const shortRatio = parseFloat(latest.shortAccount) * 100;

      return NextResponse.json({
        longRatio,
        shortRatio,
        symbol,
        timestamp: latest.timestamp,
      });
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
