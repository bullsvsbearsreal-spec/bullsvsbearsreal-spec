import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/enriched?symbol=BTC
 * Merges tickers + funding + OI into a single per-exchange response.
 * Saves the client from making 3 separate fetches.
 */

const INTERNAL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface EnrichedEntry {
  exchange: string;
  symbol: string;
  lastPrice: number;
  change24h?: number;
  quoteVolume24h?: number;
  fundingRate?: number;
  fundingInterval?: string;
  markPrice?: number;
  predictedRate?: number;
  openInterestValue?: number;
}

export async function GET(req: NextRequest) {
  const sym = req.nextUrl.searchParams.get('symbol') || 'BTC';

  try {
    const [tickerRes, fundingRes, oiRes] = await Promise.allSettled([
      fetch(`${INTERNAL}/api/tickers?symbols=${sym}`, { next: { revalidate: 5 } }).then(r => r.ok ? r.json() : null),
      fetch(`${INTERNAL}/api/funding`, { next: { revalidate: 15 } }).then(r => r.ok ? r.json() : null),
      fetch(`${INTERNAL}/api/openinterest`, { next: { revalidate: 30 } }).then(r => r.ok ? r.json() : null),
    ]);

    const tickers: any[] = (tickerRes.status === 'fulfilled' && tickerRes.value?.data) || [];
    const funding: any[] = (fundingRes.status === 'fulfilled' && fundingRes.value?.data) || [];
    const oi: any[] = (oiRes.status === 'fulfilled' && oiRes.value?.data) || [];

    // Filter to requested symbol
    const symTickers = tickers.filter(t => t.symbol === sym);
    const symFunding = funding.filter(f => f.symbol === sym);
    const symOI = oi.filter(o => o.symbol === sym);

    // Merge by exchange
    const map = new Map<string, EnrichedEntry>();

    for (const t of symTickers) {
      map.set(t.exchange, {
        exchange: t.exchange,
        symbol: sym,
        lastPrice: t.lastPrice || 0,
        change24h: t.changePercent24h ?? t.priceChangePercent24h ?? t.change24h,
        quoteVolume24h: t.quoteVolume24h,
      });
    }

    for (const f of symFunding) {
      const existing = map.get(f.exchange);
      if (existing) {
        existing.fundingRate = f.fundingRate;
        existing.fundingInterval = f.fundingInterval;
        existing.markPrice = f.markPrice;
        existing.predictedRate = f.predictedRate;
      } else {
        map.set(f.exchange, {
          exchange: f.exchange,
          symbol: sym,
          lastPrice: f.markPrice || 0,
          fundingRate: f.fundingRate,
          fundingInterval: f.fundingInterval,
          markPrice: f.markPrice,
          predictedRate: f.predictedRate,
        });
      }
    }

    for (const o of symOI) {
      const existing = map.get(o.exchange);
      if (existing) {
        existing.openInterestValue = o.openInterestValue;
      } else {
        map.set(o.exchange, {
          exchange: o.exchange,
          symbol: sym,
          lastPrice: 0,
          openInterestValue: o.openInterestValue,
        });
      }
    }

    const data = Array.from(map.values()).filter(e => e.lastPrice > 0 || e.openInterestValue);

    return NextResponse.json(
      { data, meta: { symbol: sym, count: data.length, timestamp: Date.now() } },
      { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } },
    );
  } catch {
    return NextResponse.json({ data: [], meta: { symbol: sym, count: 0, timestamp: Date.now(), error: true } }, { status: 500 });
  }
}
