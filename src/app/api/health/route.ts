import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

const ADMIN_API_KEY = (process.env.ADMIN_API_KEY || '').trim();

interface ExchangeHealth {
  name: string;
  status: 'ok' | 'error' | 'empty';
  count: number;
  latencyMs: number;
  error?: string;
}

interface RouteHealth {
  health: ExchangeHealth[];
  cache: string;
  meta: {
    totalExchanges: number;
    activeExchanges: number;
    totalEntries: number;
    timestamp: number;
  };
}

export async function GET(request: NextRequest) {
  // Auth check — require Bearer token if ADMIN_API_KEY is set
  if (ADMIN_API_KEY) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${ADMIN_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const origin = request.nextUrl.origin;
  const timeout = AbortSignal.timeout(25000);

  const routes: Record<string, RouteHealth> = {};
  const errors: Array<{ exchange: string; route: string; error: string; latencyMs: number }> = [];

  // Fetch all 3 routes in parallel (will hit L1 cache if fresh)
  const [fundingRes, oiRes, tickersRes] = await Promise.all([
    fetch(`${origin}/api/funding`, { signal: timeout }).catch(() => null),
    fetch(`${origin}/api/openinterest`, { signal: timeout }).catch(() => null),
    fetch(`${origin}/api/tickers`, { signal: timeout }).catch(() => null),
  ]);

  // Parse each route
  for (const [name, res] of [
    ['funding', fundingRes],
    ['openinterest', oiRes],
    ['tickers', tickersRes],
  ] as const) {
    if (!res || !res.ok) {
      routes[name] = {
        health: [],
        cache: 'ERROR',
        meta: { totalExchanges: 0, activeExchanges: 0, totalEntries: 0, timestamp: Date.now() },
      };
      continue;
    }

    const cache = res.headers.get('X-Cache') || 'UNKNOWN';
    const json = await res.json();
    const health: ExchangeHealth[] = json.health || [];
    const meta = json.meta || {
      totalExchanges: health.length,
      activeExchanges: health.filter((h: ExchangeHealth) => h.status === 'ok').length,
      totalEntries: Array.isArray(json.data) ? json.data.length : (Array.isArray(json) ? json.length : 0),
      timestamp: Date.now(),
    };

    routes[name] = { health, cache, meta };

    // Collect errors
    for (const h of health) {
      if (h.status === 'error') {
        errors.push({
          exchange: h.name,
          route: name,
          error: h.error || 'Unknown error',
          latencyMs: h.latencyMs,
        });
      }
    }
  }

  // Determine overall status
  const totalActive = Object.values(routes).reduce((sum, r) => sum + r.meta.activeExchanges, 0);
  const totalExchanges = Object.values(routes).reduce((sum, r) => sum + r.meta.totalExchanges, 0);
  const activeRatio = totalExchanges > 0 ? totalActive / totalExchanges : 0;

  let status: 'healthy' | 'degraded' | 'down' = 'healthy';
  if (activeRatio < 0.5) status = 'down';
  else if (activeRatio < 0.8 || errors.length > 5) status = 'degraded';

  return NextResponse.json({
    status,
    timestamp: Date.now(),
    routes,
    errors,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
