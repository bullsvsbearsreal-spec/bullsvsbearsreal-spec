/**
 * GET /api/options?currency=BTC
 *
 * Multi-exchange options data: Deribit + Binance + OKX + Bybit.
 * Returns max pain, put/call ratio, open interest by strike, IV data, and per-exchange breakdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';
import { optionsFetchers, OptionInstrument } from './exchanges';

export const runtime = 'edge';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

// L1 cache: 60-second TTL
interface CachedOptions {
  body: any;
  timestamp: number;
}
const l1Cache = new Map<string, CachedOptions>();
const L1_TTL = 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const currency = (searchParams.get('currency') || 'BTC').toUpperCase();

  if (!['BTC', 'ETH'].includes(currency)) {
    return NextResponse.json({ error: 'Only BTC and ETH options supported' }, { status: 400 });
  }

  // L1 cache check
  const cacheKey = `options_${currency}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  try {
    // Fetch from all exchanges in parallel
    const exchangeResults = await Promise.allSettled(
      optionsFetchers.map(async (ef) => {
        const start = Date.now();
        try {
          const data = await ef.fetcher(fetchWithTimeout, currency);
          return { name: ef.name, data, status: 'ok' as const, latency: Date.now() - start };
        } catch (err) {
          return { name: ef.name, data: [] as OptionInstrument[], status: 'error' as const, latency: Date.now() - start, error: String(err) };
        }
      })
    );

    // Merge all instruments
    const allInstruments: OptionInstrument[] = [];
    const health: Array<{ exchange: string; status: string; count: number; latency: number }> = [];

    exchangeResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const r = result.value;
        allInstruments.push(...r.data);
        health.push({ exchange: r.name, status: r.status, count: r.data.length, latency: r.latency });
      }
    });

    if (allInstruments.length === 0) {
      if (cached) {
        return NextResponse.json(cached.body, {
          headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
        });
      }
      return NextResponse.json({ error: 'No options data available from any exchange' }, { status: 502 });
    }

    // Determine underlying price (median across exchanges)
    const prices = allInstruments.map(i => i.underlyingPrice).filter(p => p > 0).sort((a, b) => a - b);
    const underlyingPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;

    // Calculate per-strike OI (merged across all exchanges)
    const strikeOI = new Map<number, { callOI: number; putOI: number }>();
    allInstruments.forEach((opt) => {
      const entry = strikeOI.get(opt.strike) || { callOI: 0, putOI: 0 };
      if (opt.optionType === 'call') entry.callOI += opt.openInterestUsd;
      else entry.putOI += opt.openInterestUsd;
      strikeOI.set(opt.strike, entry);
    });

    // Max pain calculation (strike that minimizes total loss)
    const strikes: number[] = [];
    strikeOI.forEach((_, k) => strikes.push(k));
    strikes.sort((a, b) => a - b);

    let maxPainStrike = underlyingPrice;
    let minTotalLoss = Infinity;

    strikes.forEach((testPrice) => {
      let totalLoss = 0;
      strikeOI.forEach((oi, strike) => {
        if (testPrice > strike) totalLoss += oi.callOI * (testPrice - strike) / (underlyingPrice || 1);
        if (testPrice < strike) totalLoss += oi.putOI * (strike - testPrice) / (underlyingPrice || 1);
      });
      if (totalLoss < minTotalLoss) {
        minTotalLoss = totalLoss;
        maxPainStrike = testPrice;
      }
    });

    // Put/Call ratio
    let totalCallOI = 0;
    let totalPutOI = 0;
    strikeOI.forEach((oi) => {
      totalCallOI += oi.callOI;
      totalPutOI += oi.putOI;
    });
    const putCallRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

    // Strike data (filtered to relevant range: 70%-130% of spot)
    const lowerBound = underlyingPrice * 0.7;
    const upperBound = underlyingPrice * 1.3;
    const relevantStrikes: Array<{ strike: number; callOI: number; putOI: number }> = [];
    strikeOI.forEach((oi, strike) => {
      if (strike >= lowerBound && strike <= upperBound) {
        relevantStrikes.push({ strike, ...oi });
      }
    });
    relevantStrikes.sort((a, b) => a.strike - b.strike);

    // IV smile (averaged per strike, merged across exchanges)
    const ivByStrike = new Map<number, { callIVs: number[]; putIVs: number[] }>();
    allInstruments.forEach((opt) => {
      if (opt.strike >= lowerBound && opt.strike <= upperBound && opt.markIV > 0) {
        const entry = ivByStrike.get(opt.strike) || { callIVs: [], putIVs: [] };
        if (opt.optionType === 'call') entry.callIVs.push(opt.markIV);
        else entry.putIVs.push(opt.markIV);
        ivByStrike.set(opt.strike, entry);
      }
    });
    const ivSmile: Array<{ strike: number; callIV: number; putIV: number }> = [];
    ivByStrike.forEach((ivs, strike) => {
      const avgCallIV = ivs.callIVs.length > 0 ? ivs.callIVs.reduce((s, v) => s + v, 0) / ivs.callIVs.length : 0;
      const avgPutIV = ivs.putIVs.length > 0 ? ivs.putIVs.reduce((s, v) => s + v, 0) / ivs.putIVs.length : 0;
      ivSmile.push({ strike, callIV: avgCallIV, putIV: avgPutIV });
    });
    ivSmile.sort((a, b) => a.strike - b.strike);

    // Per-exchange OI breakdown
    const exchangeOI: Record<string, { callOI: number; putOI: number; instruments: number }> = {};
    allInstruments.forEach((opt) => {
      if (!exchangeOI[opt.exchange]) exchangeOI[opt.exchange] = { callOI: 0, putOI: 0, instruments: 0 };
      if (opt.optionType === 'call') exchangeOI[opt.exchange].callOI += opt.openInterestUsd;
      else exchangeOI[opt.exchange].putOI += opt.openInterestUsd;
      exchangeOI[opt.exchange].instruments++;
    });

    const responseBody = {
      currency,
      underlyingPrice,
      maxPain: maxPainStrike,
      putCallRatio,
      totalCallOI,
      totalPutOI,
      totalOI: totalCallOI + totalPutOI,
      instrumentCount: allInstruments.length,
      strikeData: relevantStrikes,
      ivSmile,
      exchangeBreakdown: Object.entries(exchangeOI).map(([exchange, oi]) => ({
        exchange,
        callOI: oi.callOI,
        putOI: oi.putOI,
        totalOI: oi.callOI + oi.putOI,
        instruments: oi.instruments,
        share: totalCallOI + totalPutOI > 0
          ? ((oi.callOI + oi.putOI) / (totalCallOI + totalPutOI) * 100)
          : 0,
      })).sort((a, b) => b.totalOI - a.totalOI),
      health,
    };

    // Update L1 cache
    l1Cache.set(cacheKey, { body: responseBody, timestamp: Date.now() });

    return NextResponse.json(responseBody, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (e) {
    if (cached) {
      return NextResponse.json(cached.body, {
        headers: { 'X-Cache': 'STALE', 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
      });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch options data' },
      { status: 500 },
    );
  }
}
