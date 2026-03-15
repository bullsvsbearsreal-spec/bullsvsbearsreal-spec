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
      { path: '/api/v1/funding', method: 'GET', description: 'Real-time funding rates across 34 exchanges' },
      { path: '/api/v1/funding/history', method: 'GET', description: 'Historical funding rate snapshots (up to 7 days)' },
      { path: '/api/v1/arbitrage', method: 'GET', description: 'Funding rate arbitrage opportunities with feasibility grades' },
      { path: '/api/v1/openinterest', method: 'GET', description: 'Open interest data across exchanges' },
      { path: '/api/v1/exchanges', method: 'GET', description: 'Supported exchanges with fees and intervals' },
      { path: '/api/v1/status', method: 'GET', description: 'API health status (no auth required)' },
    ],
    tiers: {
      free: { rateLimit: '100 req/min', dailyLimit: '5,000 req/day' },
      pro: { rateLimit: '500 req/min', dailyLimit: 'unlimited' },
    },
    documentation: 'https://infohub.trade/developers/docs',
    timestamp: Date.now(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60' },
  });
}
