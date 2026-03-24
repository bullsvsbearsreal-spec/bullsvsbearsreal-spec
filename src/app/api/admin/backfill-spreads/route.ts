import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

export const maxDuration = 300; // 5 minutes
export const runtime = 'nodejs';

const sql = postgres(process.env.DATABASE_URL || '', { max: 3 });
const CRON_SECRET = process.env.CRON_SECRET || '';

const SYMBOLS = ['BTC','ETH','SOL','XRP','DOGE','BNB','ADA','AVAX','LINK','DOT','SUI','APT','ARB','OP','PEPE','WIF','BONK'];
const EXCHANGES = ['Binance', 'OKX', 'Bybit'];

// Simple kline fetchers for backfill (1h candles, 30 days)
async function fetchBinanceKlines(symbol: string, limit: number): Promise<Array<{t: number; c: number}>> {
  try {
    const r = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}USDT&interval=1h&limit=${limit}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const data = await r.json();
    return data.map((k: any[]) => ({ t: k[0], c: +k[4] })).filter((c: any) => c.c > 0);
  } catch { return []; }
}

async function fetchOKXKlines(symbol: string, limit: number): Promise<Array<{t: number; c: number}>> {
  try {
    const r = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT-SWAP&bar=1H&limit=${Math.min(limit, 300)}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((k: string[]) => ({ t: +k[0], c: +k[4] })).filter((c: any) => c.c > 0).reverse();
  } catch { return []; }
}

async function fetchBybitKlines(symbol: string, limit: number): Promise<Array<{t: number; c: number}>> {
  try {
    const r = await fetch(`https://api.bybit.nl/v5/market/kline?category=linear&symbol=${symbol}USDT&interval=60&limit=${Math.min(limit, 200)}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.result?.list || []).map((k: string[]) => ({ t: +k[0], c: +k[4] })).filter((c: any) => c.c > 0).reverse();
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  // Auth check
  const auth = req.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{ symbol: string; inserted: number; skipped: number }> = [];

  for (const sym of SYMBOLS) {
    let inserted = 0, skipped = 0;

    try {
      // Fetch klines from 3 exchanges
      const [binance, okx, bybit] = await Promise.all([
        fetchBinanceKlines(sym, 720), // 30 days * 24h
        fetchOKXKlines(sym, 300),     // OKX max 300
        fetchBybitKlines(sym, 200),   // Bybit max 200
      ]);

      // Index by hourly bucket
      const bucketMs = 3600_000;
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

      // Compute spread per bucket and insert
      for (const [bucketStr, prices] of Object.entries(byBucket)) {
        const bucket = +bucketStr;
        const entries = Object.entries(prices).sort((a, b) => b[1] - a[1]);
        if (entries.length < 2) continue;

        const high = entries[0];
        const low = entries[entries.length - 1];
        const spread = high[1] - low[1];
        const pct = (spread / low[1]) * 100;

        // Skip if row already exists for this symbol+hour
        const existing = await sql`
          SELECT id FROM spread_snapshots
          WHERE symbol = ${sym}
            AND ts >= ${new Date(bucket).toISOString()}::timestamptz
            AND ts < ${new Date(bucket + bucketMs).toISOString()}::timestamptz
          LIMIT 1
        `;
        if (existing.length > 0) { skipped++; continue; }

        await sql`
          INSERT INTO spread_snapshots (symbol, spread_usd, spread_pct, high_exchange, low_exchange, high_price, low_price, exchange_count, ts)
          VALUES (${sym}, ${spread}, ${pct}, ${high[0]}, ${low[0]}, ${high[1]}, ${low[1]}, ${entries.length}, ${new Date(bucket).toISOString()}::timestamptz)
        `;
        inserted++;
      }
    } catch (err: any) {
      results.push({ symbol: sym, inserted, skipped: -1 });
      continue;
    }

    results.push({ symbol: sym, inserted, skipped });

    // Small delay between symbols to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({ results, total: results.reduce((s, r) => s + r.inserted, 0) });
}
