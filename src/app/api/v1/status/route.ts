import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/status
 *
 * Returns API health status + version info.
 * No auth required — free call for monitoring.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    status: 'operational',
    version: 'v1',
    endpoints: [
      { path: '/api/v1/funding', method: 'GET', description: 'Real-time funding rates across 33 exchanges' },
      { path: '/api/v1/funding/history', method: 'GET', description: 'Historical funding rate snapshots (up to 7 days)' },
      { path: '/api/v1/arbitrage', method: 'GET', description: 'Funding rate arbitrage opportunities with feasibility grades' },
      { path: '/api/v1/openinterest', method: 'GET', description: 'Open interest data across exchanges' },
      { path: '/api/v1/tickers', method: 'GET', description: 'Real-time price & volume data across exchanges' },
      { path: '/api/v1/liquidations', method: 'GET', description: 'Recent liquidation feed or aggregated summary' },
      { path: '/api/v1/spreads', method: 'GET', description: 'Cross-exchange price spreads ranked by opportunity' },
      { path: '/api/v1/fear-greed', method: 'GET', description: 'Fear & Greed Index (current + optional 30d history)' },
      { path: '/api/v1/top-movers', method: 'GET', description: 'Top gaining and losing coins by 24h change' },
      { path: '/api/v1/global-stats', method: 'GET', description: 'Market-wide stats: altcoin season, BTC dominance, total market cap' },
      { path: '/api/v1/longshort', method: 'GET', description: 'Long/short ratio data (Binance, OKX)' },
      { path: '/api/v1/options', method: 'GET', description: 'Options market data: max pain, put/call ratio, IV (Deribit, Binance, OKX, Bybit)' },
      { path: '/api/v1/exchanges', method: 'GET', description: 'Supported exchanges with fees and intervals' },
      { path: '/api/v1/status', method: 'GET', description: 'API health status (no auth required)' },
    ],
    tiers: {
      free: { rateLimit: '100 req/min', dailyLimit: '5,000 req/day' },
      pro: { rateLimit: '500 req/min', dailyLimit: 'unlimited' },
    },
    documentation: 'https://info-hub.io/developers/docs',
    timestamp: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60' },
  });
}
