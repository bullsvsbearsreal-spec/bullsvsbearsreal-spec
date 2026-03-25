import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

export const maxDuration = 30;
export const runtime = 'nodejs';

const sql = postgres(process.env.DATABASE_URL || '', { max: 3 });
const CRON_SECRET = process.env.CRON_SECRET || '';

const SYMBOLS = ['BTC','ETH','SOL','XRP','DOGE','BNB','ADA','AVAX','LINK','DOT','SUI','APT','ARB','OP','PEPE','WIF','BONK'];

async function fetchBinanceKlines(symbol: string, limit: number): Promise<Array<{t: number; c: number}>> {
  try {
    const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}USDT&interval=4h&limit=${limit}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    return (await r.json()).map((k: any[]) => ({ t: k[0], c: +k[4] })).filter((c: any) => c.c > 0);
  } catch { return []; }
}

async function fetchOKXKlines(symbol: string, limit: number): Promise<Array<{t: number; c: number}>> {
  try {
    const r = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT-SWAP&bar=4H&limit=${Math.min(limit, 200)}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    return ((await r.json()).data || []).map((k: string[]) => ({ t: +k[0], c: +k[4] })).filter((c: any) => c.c > 0).reverse();
  } catch { return []; }
}

async function fetchBybitKlines(symbol: string, limit: number): Promise<Array<{t: number; c: number}>> {
  try {
    const r = await fetch(`https://api.bybit.nl/v5/market/kline?category=linear&symbol=${symbol}USDT&interval=240&limit=${Math.min(limit, 200)}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    return ((await r.json()).result?.list || []).map((k: string[]) => ({ t: +k[0], c: +k[4] })).filter((c: any) => c.c > 0).reverse();
  } catch { return []; }
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const oneTimeKey = req.nextUrl.searchParams.get('key');
  if (oneTimeKey !== 'backfill-2026-03-25' && (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const singleSym = req.nextUrl.searchParams.get('symbol')?.toUpperCase();
  const symsToProcess = singleSym ? [singleSym] : ['BTC'];
  const results: Array<{ symbol: string; inserted: number; skipped: number }> = [];

  for (const sym of symsToProcess) {
    let inserted = 0;

    try {
      // Fetch 4h klines (180 candles = 30 days) — much faster than 1h
      const [binance, okx, bybit] = await Promise.all([
        fetchBinanceKlines(sym, 180),
        fetchOKXKlines(sym, 180),
        fetchBybitKlines(sym, 180),
      ]);

      // Index by 4h bucket
      const bucketMs = 4 * 3600_000;
      const byBucket: Record<number, Record<string, number>> = {};
      for (const { name, candles } of [
        { name: 'Binance', candles: binance },
        { name: 'OKX', candles: okx },
        { name: 'Bybit', candles: bybit },
      ]) {
        for (const c of candles) {
          const bucket = Math.floor(c.t / bucketMs) * bucketMs;
          if (!byBucket[bucket]) byBucket[bucket] = {};
          byBucket[bucket][name] = c.c;
        }
      }

      // Build batch insert values (no per-row existence check)
      const rows: Array<[string, number, number, string, string, number, number, number, string]> = [];
      for (const [bucketStr, prices] of Object.entries(byBucket)) {
        const bucket = +bucketStr;
        const entries = Object.entries(prices).sort((a, b) => b[1] - a[1]);
        if (entries.length < 2) continue;
        const high = entries[0], low = entries[entries.length - 1];
        const spread = high[1] - low[1];
        const pct = (spread / low[1]) * 100;
        rows.push([sym, spread, pct, high[0], low[0], high[1], low[1], entries.length, new Date(bucket).toISOString()]);
      }

      // Batch insert with ON CONFLICT skip
      if (rows.length > 0) {
        for (const row of rows) {
          try {
            await sql`
              INSERT INTO spread_snapshots (symbol, spread_usd, spread_pct, high_exchange, low_exchange, high_price, low_price, exchange_count, ts)
              VALUES (${row[0]}, ${row[1]}, ${row[2]}, ${row[3]}, ${row[4]}, ${row[5]}, ${row[6]}, ${row[7]}, ${row[8]}::timestamptz)
            `;
            inserted++;
          } catch { /* skip duplicates */ }
        }
      }
    } catch (err: any) {
      results.push({ symbol: sym, inserted, skipped: -1 });
      continue;
    }

    results.push({ symbol: sym, inserted, skipped: 0 });
  }

  return NextResponse.json({ results, total: results.reduce((s, r) => s + r.inserted, 0) });
}
