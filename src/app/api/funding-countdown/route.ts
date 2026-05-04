/**
 * GET /api/funding-countdown
 *
 * Returns the next funding settlement timestamp per exchange × symbol,
 * sourced directly from each venue's perp-info endpoint. Most exchanges
 * use 8h funding intervals but the *clock* differs (Binance 00:00/08:00/
 * 16:00 UTC, Bybit 00:00/08:00/16:00, OKX 04:00/12:00/20:00 UTC, etc.) —
 * traders care about when each one fires, not just the rate.
 *
 * Free APIs only. L1 cached 30s.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../_shared/fetch';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface CountdownRow {
  exchange: string;
  symbol: string;
  fundingRate: number;        // current rate (decimal, e.g. 0.0001 = 0.01%)
  nextFundingMs: number;      // unix ms of next settlement
  intervalHours: number;      // typical interval (most are 8)
}

interface CountdownResponse {
  rows: CountdownRow[];
  symbols: string[];
  exchanges: string[];
  ts: number;
}

const TIMEOUT = 6000;
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'HYPE', 'AVAX', 'LINK', 'SUI'];

// L1 cache — 30s is fine; the *time* doesn't change but the rate does
let l1: { body: CountdownResponse; ts: number } | null = null;
const L1_TTL = 30_000;

/* ─── Per-exchange fetchers ─────────────────────────────────────── */

async function fromBinance(): Promise<CountdownRow[]> {
  try {
    const res = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/premiumIndex', {}, TIMEOUT);
    if (!res.ok) return [];
    const arr = await res.json() as Array<{ symbol: string; lastFundingRate: string; nextFundingTime: number }>;
    return SYMBOLS.flatMap(sym => {
      const m = arr.find(t => t.symbol === `${sym}USDT`);
      if (!m) return [];
      return [{
        exchange: 'Binance',
        symbol: sym,
        fundingRate: Number(m.lastFundingRate) || 0,
        nextFundingMs: Number(m.nextFundingTime) || 0,
        intervalHours: 8,
      }];
    });
  } catch { return []; }
}

async function fromBybit(): Promise<CountdownRow[]> {
  try {
    const res = await fetchWithTimeout(
      'https://api.bybit.com/v5/market/tickers?category=linear',
      {}, TIMEOUT,
    );
    if (!res.ok) return [];
    const json = await res.json() as { result?: { list?: Array<{ symbol: string; fundingRate: string; nextFundingTime: string }> } };
    const list = json.result?.list ?? [];
    return SYMBOLS.flatMap(sym => {
      const m = list.find(t => t.symbol === `${sym}USDT`);
      if (!m) return [];
      return [{
        exchange: 'Bybit',
        symbol: sym,
        fundingRate: Number(m.fundingRate) || 0,
        nextFundingMs: Number(m.nextFundingTime) || 0,
        intervalHours: 8,
      }];
    });
  } catch { return []; }
}

async function fromOkx(): Promise<CountdownRow[]> {
  try {
    // OKX requires per-symbol calls for funding-rate endpoint
    const promises = SYMBOLS.map(async sym => {
      const r = await fetchWithTimeout(
        `https://www.okx.com/api/v5/public/funding-rate?instId=${sym}-USDT-SWAP`,
        {}, TIMEOUT,
      );
      if (!r.ok) return null;
      const j = await r.json() as { data?: Array<{ fundingRate: string; nextFundingTime: string }> };
      const d = j.data?.[0];
      if (!d) return null;
      return {
        exchange: 'OKX',
        symbol: sym,
        fundingRate: Number(d.fundingRate) || 0,
        nextFundingMs: Number(d.nextFundingTime) || 0,
        intervalHours: 8,
      } satisfies CountdownRow;
    });
    const settled = await Promise.allSettled(promises);
    return settled
      .filter((r): r is PromiseFulfilledResult<CountdownRow | null> => r.status === 'fulfilled' && r.value != null)
      .map(r => r.value!);
  } catch { return []; }
}

async function fromBitget(): Promise<CountdownRow[]> {
  try {
    const res = await fetchWithTimeout(
      'https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES',
      {}, TIMEOUT,
    );
    if (!res.ok) return [];
    const json = await res.json() as { data?: Array<{ symbol: string; fundingRate: string; nextFundingTime: string }> };
    const list = json.data ?? [];
    return SYMBOLS.flatMap(sym => {
      const m = list.find(t => t.symbol === `${sym}USDT`);
      if (!m) return [];
      return [{
        exchange: 'Bitget',
        symbol: sym,
        fundingRate: Number(m.fundingRate) || 0,
        nextFundingMs: Number(m.nextFundingTime) || 0,
        intervalHours: 8,
      }];
    });
  } catch { return []; }
}

async function fromHyperliquid(): Promise<CountdownRow[]> {
  try {
    const res = await fetchWithTimeout(
      'https://api.hyperliquid.xyz/info',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }) },
      TIMEOUT,
    );
    if (!res.ok) return [];
    const json = await res.json() as [{ universe: Array<{ name: string }> }, Array<{ funding: string; nextFundingTime?: number }>];
    const [meta, ctxs] = json;
    return SYMBOLS.flatMap(sym => {
      const idx = meta.universe.findIndex(u => u.name === sym);
      if (idx === -1) return [];
      const ctx = ctxs[idx];
      if (!ctx) return [];
      // HL funding is hourly. nextFundingTime is sometimes missing — use next-hour rounding.
      const next = ctx.nextFundingTime ?? (Math.floor(Date.now() / 3_600_000) + 1) * 3_600_000;
      return [{
        exchange: 'Hyperliquid',
        symbol: sym,
        fundingRate: Number(ctx.funding) || 0,
        nextFundingMs: next,
        intervalHours: 1,
      }];
    });
  } catch { return []; }
}

/* ─── Handler ───────────────────────────────────────────────────── */

export async function GET(_request: NextRequest) {
  if (l1 && Date.now() - l1.ts < L1_TTL) {
    return NextResponse.json(l1.body, {
      headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' },
    });
  }

  const [bin, bybit, okx, bitget, hl] = await Promise.all([
    fromBinance(), fromBybit(), fromOkx(), fromBitget(), fromHyperliquid(),
  ]);
  const rows = [...bin, ...bybit, ...okx, ...bitget, ...hl].filter(r => r.nextFundingMs > 0);

  const body: CountdownResponse = {
    rows,
    symbols: Array.from(new Set(rows.map(r => r.symbol))),
    exchanges: Array.from(new Set(rows.map(r => r.exchange))),
    ts: Date.now(),
  };

  if (rows.length > 0) l1 = { body, ts: Date.now() };

  return NextResponse.json(body, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': rows.length > 0 ? 'public, s-maxage=20, stale-while-revalidate=60' : 'no-store',
    },
  });
}
