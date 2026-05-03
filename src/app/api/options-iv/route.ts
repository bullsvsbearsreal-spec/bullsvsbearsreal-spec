/**
 * GET /api/options-iv
 *
 * Implied volatility snapshot for BTC and ETH options. Derived from Deribit's
 * free public endpoint. Computes:
 *   • ATM IV per expiry (term structure)
 *   • 25-delta skew (put IV - call IV at similar delta) as a quick fear gauge
 *   • Put/Call ratio from OI
 *   • Volume-weighted overall IV
 *   • Max pain by expiry
 *
 * Upstream:
 *   GET https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option
 *
 * Query params:
 *   currency — 'BTC' | 'ETH' (default BTC)
 *
 * Cache: 60s.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const DERIBIT_URL = 'https://www.deribit.com/api/v2/public/get_book_summary_by_currency';

interface DeribitOption {
  instrument_name: string;
  mark_iv?: number;
  mark_price?: number;
  open_interest?: number;
  volume_usd?: number;
  underlying_price?: number;
  creation_timestamp?: number;
}

interface ExpiryRow {
  expiry: string;           // 'DEC26'
  expiryDate: string;       // ISO date
  daysToExpiry: number;
  atmIv: number;            // IV at strike closest to underlying
  underlying: number;
  callOi: number;
  putOi: number;
  maxPain: number | null;
  skew25d: number;          // put_iv - call_iv (pos = bearish)
  callIvAvg: number;
  putIvAvg: number;
}

interface OptionsIvResponse {
  currency: 'BTC' | 'ETH';
  underlying: number;
  summary: {
    atmIv30d: number | null;         // interpolated or nearest-expiry ATM IV ~30d
    putCallOiRatio: number;          // total_put_oi / total_call_oi
    totalOi: number;
    totalOiUsd: number;
    totalVolumeUsd: number;
    skew25d30d: number | null;       // 25d skew near 30d expiry
    termStructureSlope: number | null; // short-term minus long-term IV (contango/backwardation)
  };
  expiries: ExpiryRow[];
  meta: { timestamp: number; source: 'deribit'; instrumentCount: number };
}

const cache = new Map<string, { body: OptionsIvResponse; ts: number }>();
const CACHE_TTL = 60_000;

// Deribit instrument name: BTC-25DEC26-65000-P
function parseInstrument(name: string): { currency: string; expiry: string; strike: number; side: 'C' | 'P' } | null {
  const parts = name.split('-');
  if (parts.length !== 4) return null;
  const [currency, expiryRaw, strikeRaw, sideRaw] = parts;
  const strike = parseFloat(strikeRaw);
  if (!Number.isFinite(strike)) return null;
  const side = (sideRaw === 'C' || sideRaw === 'P') ? sideRaw : null;
  if (!side) return null;
  return { currency, expiry: expiryRaw, strike, side };
}

// Deribit expiry format is "25DEC26" => 25 Dec 2026
function expiryToDate(exp: string): Date | null {
  const m = exp.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthStr = m[2];
  const year = 2000 + parseInt(m[3], 10);
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const mo = months[monthStr];
  if (mo == null) return null;
  return new Date(Date.UTC(year, mo, day, 8, 0, 0)); // Deribit expires 08:00 UTC
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const currencyRaw = (searchParams.get('currency') || 'BTC').toUpperCase();
  const currency: 'BTC' | 'ETH' = currencyRaw === 'ETH' ? 'ETH' : 'BTC';

  const cacheKey = `options-iv:${currency}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    const res = await fetch(`${DERIBIT_URL}?currency=${currency}&kind=option`, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Deribit ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const raw: DeribitOption[] = Array.isArray(json?.result) ? json.result : [];
    if (!raw.length) {
      return NextResponse.json({ error: 'empty options feed' }, { status: 502 });
    }

    // Group by expiry
    interface Parsed extends DeribitOption {
      strike: number;
      side: 'C' | 'P';
      expiry: string;
    }
    const byExpiry = new Map<string, Parsed[]>();
    let underlying = 0;
    for (const o of raw) {
      const parsed = parseInstrument(o.instrument_name);
      if (!parsed) continue;
      if (parsed.currency !== currency) continue;
      if (o.underlying_price && !underlying) underlying = o.underlying_price;
      const list = byExpiry.get(parsed.expiry) ?? [];
      list.push({ ...o, strike: parsed.strike, side: parsed.side, expiry: parsed.expiry });
      byExpiry.set(parsed.expiry, list);
    }

    const now = Date.now();
    const expiries: ExpiryRow[] = [];
    byExpiry.forEach((group, expiry) => {
      if (group.length === 0) return;
      const expDate = expiryToDate(expiry);
      if (!expDate) return;
      const daysToExpiry = Math.max(0, (expDate.getTime() - now) / 86_400_000);
      const und = group[0].underlying_price ?? underlying;
      if (!und) return;

      // Find ATM strike = strike closest to underlying
      const uniqueStrikes = Array.from(new Set(group.map(g => g.strike))).sort((a, b) => Math.abs(a - und) - Math.abs(b - und));
      const atmStrike = uniqueStrikes[0];
      const atmOptions = group.filter(g => g.strike === atmStrike && Number.isFinite(g.mark_iv) && (g.mark_iv as number) > 0);
      const atmIv = atmOptions.length ? atmOptions.reduce((s, x) => s + (x.mark_iv ?? 0), 0) / atmOptions.length : 0;

      // 25-delta skew: approximate via strikes ~25% OTM on each side
      // Strike + 25% OTM = call at strike * 1.1 (rough proxy), put at strike * 0.9
      const callStrikeTarget = und * 1.10;
      const putStrikeTarget = und * 0.90;
      const nearestCall = group
        .filter(g => g.side === 'C' && Number.isFinite(g.mark_iv) && (g.mark_iv as number) > 0)
        .sort((a, b) => Math.abs(a.strike - callStrikeTarget) - Math.abs(b.strike - callStrikeTarget))[0];
      const nearestPut = group
        .filter(g => g.side === 'P' && Number.isFinite(g.mark_iv) && (g.mark_iv as number) > 0)
        .sort((a, b) => Math.abs(a.strike - putStrikeTarget) - Math.abs(b.strike - putStrikeTarget))[0];
      const skew25d = (nearestPut && nearestCall) ? (nearestPut.mark_iv as number) - (nearestCall.mark_iv as number) : 0;

      const callOi = group.filter(g => g.side === 'C').reduce((s, x) => s + (x.open_interest || 0), 0);
      const putOi = group.filter(g => g.side === 'P').reduce((s, x) => s + (x.open_interest || 0), 0);
      const calls = group.filter(g => g.side === 'C' && Number.isFinite(g.mark_iv) && (g.mark_iv as number) > 0);
      const puts = group.filter(g => g.side === 'P' && Number.isFinite(g.mark_iv) && (g.mark_iv as number) > 0);
      const callIvAvg = calls.length ? calls.reduce((s, x) => s + (x.mark_iv ?? 0), 0) / calls.length : 0;
      const putIvAvg = puts.length ? puts.reduce((s, x) => s + (x.mark_iv ?? 0), 0) / puts.length : 0;

      // Max pain: strike with smallest total ITM value
      // simplified: strike that minimizes sum over options of (OI * max(0, strike_diff))
      let maxPainStrike: number | null = null;
      let minPain = Infinity;
      for (const k of uniqueStrikes) {
        let pain = 0;
        for (const g of group) {
          const oi = g.open_interest || 0;
          if (oi <= 0) continue;
          if (g.side === 'C' && k > g.strike) pain += oi * (k - g.strike);
          if (g.side === 'P' && k < g.strike) pain += oi * (g.strike - k);
        }
        if (pain < minPain) { minPain = pain; maxPainStrike = k; }
      }

      expiries.push({
        expiry,
        expiryDate: expDate.toISOString().slice(0, 10),
        daysToExpiry: Number(daysToExpiry.toFixed(1)),
        atmIv,
        underlying: und,
        callOi,
        putOi,
        maxPain: maxPainStrike,
        skew25d,
        callIvAvg,
        putIvAvg,
      });
    });

    expiries.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

    // Aggregate summary
    const totalCallOi = expiries.reduce((s, e) => s + e.callOi, 0);
    const totalPutOi = expiries.reduce((s, e) => s + e.putOi, 0);
    const totalOi = totalCallOi + totalPutOi;
    const totalOiUsd = raw.reduce((s, o) => s + ((o.open_interest || 0) * (o.mark_price || 0) * (o.underlying_price || 0)), 0);
    const totalVolumeUsd = raw.reduce((s, o) => s + (o.volume_usd || 0), 0);
    const putCallOiRatio = totalCallOi > 0 ? totalPutOi / totalCallOi : 0;

    // Find expiry closest to 30d for 30d ATM IV and 30d skew
    const near30d = expiries
      .filter(e => e.atmIv > 0)
      .slice()
      .sort((a, b) => Math.abs(a.daysToExpiry - 30) - Math.abs(b.daysToExpiry - 30))[0] || null;
    const atmIv30d = near30d?.atmIv ?? null;
    const skew25d30d = near30d?.skew25d ?? null;

    // Term structure slope: short (< 14 days) minus long (>90 days)
    const shortSlice = expiries.filter(e => e.daysToExpiry > 0 && e.daysToExpiry < 14 && e.atmIv > 0);
    const longSlice = expiries.filter(e => e.daysToExpiry >= 90 && e.atmIv > 0);
    const shortAvg = shortSlice.length ? shortSlice.reduce((s, e) => s + e.atmIv, 0) / shortSlice.length : 0;
    const longAvg = longSlice.length ? longSlice.reduce((s, e) => s + e.atmIv, 0) / longSlice.length : 0;
    const termStructureSlope = shortAvg && longAvg ? shortAvg - longAvg : null;

    const body: OptionsIvResponse = {
      currency,
      underlying,
      summary: {
        atmIv30d,
        putCallOiRatio,
        totalOi,
        totalOiUsd,
        totalVolumeUsd,
        skew25d30d,
        termStructureSlope,
      },
      expiries,
      meta: {
        timestamp: Date.now(),
        source: 'deribit',
        instrumentCount: raw.length,
      },
    };

    cache.set(cacheKey, { body, ts: Date.now() });
    return NextResponse.json(body, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error('[options-iv] error:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
