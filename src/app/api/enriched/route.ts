import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { fetchAllExchangesWithHealth } from '../_shared/exchange-fetchers';
import { tickerFetchers } from '../tickers/exchanges';
import { getFundingData } from '../_shared/funding-core';
import { getOIData } from '../_shared/oi-core';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/**
 * /api/enriched?symbol=BTC
 * Merges tickers + funding + OI into a single per-exchange response.
 * Uses direct function imports instead of HTTP self-fetch.
 */

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
    const [tickerResult, fundingResult, oiResult] = await Promise.allSettled([
      fetchAllExchangesWithHealth(tickerFetchers, fetchWithTimeout),
      getFundingData('all'),
      getOIData(),
    ]);

    const tickers: any[] = (tickerResult.status === 'fulfilled' && tickerResult.value?.data) || [];
    const funding: any[] = (fundingResult.status === 'fulfilled' && fundingResult.value?.result?.data) || [];
    const oi: any[] = (oiResult.status === 'fulfilled' && oiResult.value?.result?.data) || [];

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
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } },
    );
  } catch {
    return NextResponse.json({ data: [], meta: { symbol: sym, count: 0, timestamp: Date.now(), error: true } }, { status: 500 });
  }
}
