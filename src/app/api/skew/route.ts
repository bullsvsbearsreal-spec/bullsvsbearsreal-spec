/**
 * GET /api/skew?asset=BTC|ETH
 *
 * Put-call IV skew tracker via Deribit's public API. We pull the active
 * options book for the requested currency, group by expiry, and at each
 * expiry compute average IV for OTM puts (delta < 0.4) and OTM calls
 * (delta > 0.6) at roughly 25-delta. Skew = put_iv - call_iv (in vol points).
 *
 * Negative skew → calls priced over puts (rare, often a top signal).
 * Positive skew → puts priced over calls (the normal regime).
 *
 * Free Deribit endpoint, no auth. L1 cached 60s.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface DeribitTicker {
  instrument_name: string;
  mark_iv: number;          // implied vol % (e.g. 65.2)
  greeks?: { delta?: number };
  underlying_price?: number;
}

interface DeribitInstrument {
  instrument_name: string;
  expiration_timestamp: number;
  strike: number;
  option_type: 'call' | 'put';
}

interface ExpirySkew {
  expiry: string;          // ISO date, day-resolution
  daysToExpiry: number;
  callIv: number | null;   // avg IV for ~25d calls
  putIv: number | null;    // avg IV for ~25d puts
  skew: number | null;     // put - call, in vol points
  underlyingPrice: number;
}

interface SkewResponse {
  asset: 'BTC' | 'ETH';
  expiries: ExpirySkew[];
  ts: number;
  underlyingPrice: number;
}

const TIMEOUT = 8000;
const l1Cache = new Map<string, { body: SkewResponse; ts: number }>();
const L1_TTL = 60_000;

async function fetchInstruments(asset: string): Promise<DeribitInstrument[]> {
  const res = await fetch(
    `https://www.deribit.com/api/v2/public/get_instruments?currency=${asset}&kind=option&expired=false`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  );
  if (!res.ok) throw new Error(`deribit instruments HTTP ${res.status}`);
  const json = await res.json() as { result?: DeribitInstrument[] };
  return json.result ?? [];
}

async function fetchBookSummaries(asset: string): Promise<DeribitTicker[]> {
  // book_summary returns aggregate quote info incl. mark_iv per instrument
  const res = await fetch(
    `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${asset}&kind=option`,
    { signal: AbortSignal.timeout(TIMEOUT) },
  );
  if (!res.ok) throw new Error(`deribit book_summary HTTP ${res.status}`);
  const json = await res.json() as { result?: Array<{ instrument_name: string; mark_iv: number; underlying_price: number }> };
  return (json.result ?? []).map(r => ({
    instrument_name: r.instrument_name,
    mark_iv: r.mark_iv,
    underlying_price: r.underlying_price,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const asset = (searchParams.get('asset') || 'BTC').toUpperCase() as 'BTC' | 'ETH';
  if (asset !== 'BTC' && asset !== 'ETH') {
    return NextResponse.json({ error: 'asset must be BTC or ETH' }, { status: 400 });
  }

  const cacheKey = `skew_${asset}`;
  const cached = l1Cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < L1_TTL) {
    return NextResponse.json(cached.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=180' },
    });
  }

  try {
    const [instruments, summaries] = await Promise.all([
      fetchInstruments(asset),
      fetchBookSummaries(asset),
    ]);

    if (instruments.length === 0 || summaries.length === 0) {
      return NextResponse.json({ error: 'no options data', expiries: [] }, { status: 503 });
    }

    // Map instrument → metadata
    const meta = new Map<string, DeribitInstrument>();
    for (const i of instruments) meta.set(i.instrument_name, i);
    // Underlying price (any summary has it)
    const underlyingPrice = summaries.find(s => Number.isFinite(s.underlying_price))?.underlying_price ?? 0;

    // Group by expiry, separating call/put
    type Bucket = { expiryMs: number; calls: Array<{ strike: number; iv: number }>; puts: Array<{ strike: number; iv: number }> };
    const byExpiry = new Map<number, Bucket>();

    for (const s of summaries) {
      const m = meta.get(s.instrument_name);
      if (!m || !Number.isFinite(s.mark_iv) || s.mark_iv <= 0) continue;
      const exp = m.expiration_timestamp;
      let b = byExpiry.get(exp);
      if (!b) { b = { expiryMs: exp, calls: [], puts: [] }; byExpiry.set(exp, b); }
      const entry = { strike: m.strike, iv: s.mark_iv };
      if (m.option_type === 'call') b.calls.push(entry);
      else b.puts.push(entry);
    }

    // For each expiry, pick OTM strikes near 25-delta. Heuristic: spot ± ~10–15%.
    // 25-delta call ≈ strike at +10% OTM for short-dated (sloppy but free).
    // 25-delta put  ≈ strike at -10% OTM. Average a small window.
    const now = Date.now();
    const expiries: ExpirySkew[] = [];
    byExpiry.forEach((b: Bucket) => {
      const days = Math.round((b.expiryMs - now) / 86_400_000);
      if (days < 1 || days > 180) return;
      if (underlyingPrice <= 0) return;

      // OTM call window: strikes between 1.05× and 1.20× spot
      const callsWin = b.calls.filter((c: { strike: number; iv: number }) => c.strike >= underlyingPrice * 1.05 && c.strike <= underlyingPrice * 1.20);
      // OTM put window: strikes between 0.80× and 0.95× spot
      const putsWin = b.puts.filter((p: { strike: number; iv: number }) => p.strike >= underlyingPrice * 0.80 && p.strike <= underlyingPrice * 0.95);

      const avgIv = (arr: Array<{ iv: number }>) => arr.length === 0 ? null : arr.reduce((s, x) => s + x.iv, 0) / arr.length;
      const callIv = avgIv(callsWin);
      const putIv = avgIv(putsWin);
      const skew = (callIv != null && putIv != null) ? putIv - callIv : null;

      expiries.push({
        expiry: new Date(b.expiryMs).toISOString().slice(0, 10),
        daysToExpiry: days,
        callIv: callIv != null ? Math.round(callIv * 100) / 100 : null,
        putIv: putIv != null ? Math.round(putIv * 100) / 100 : null,
        skew: skew != null ? Math.round(skew * 100) / 100 : null,
        underlyingPrice,
      });
    });

    expiries.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

    const body: SkewResponse = {
      asset,
      expiries,
      underlyingPrice,
      ts: Date.now(),
    };

    if (expiries.length > 0) l1Cache.set(cacheKey, { body, ts: Date.now() });

    return NextResponse.json(body, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': expiries.length > 0
          ? 'public, s-maxage=45, stale-while-revalidate=180'
          : 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
