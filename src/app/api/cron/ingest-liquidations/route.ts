/**
 * Vercel Cron: Poll exchange REST APIs for recent liquidations.
 * Runs serverlessly on Vercel Pro (every 1 minute via vercel.json).
 *
 * Exchanges with REST liquidation endpoints:
 *  - Binance: GET /fapi/v1/allForceOrders (direct)
 *  - OKX:     GET /api/v5/public/liquidation-orders (per-underlying)
 *  - HTX:     GET /linear-swap-api/v3/swap_liquidation_orders (per-contract)
 *  - gTrade:  GET /trading-history-24h (filter TradeClosedLIQ)
 *  - Deribit: GET /api/v2/public/get_last_trades_by_currency (filter liquidation field)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDBConfigured, saveLiquidationSnapshot } from '@/lib/db';
import { isLiqCryptoSymbol, normalizeLiqSymbol } from '@/lib/liquidation-parsers';

export const runtime = 'nodejs';
export const preferredRegion = 'sin1';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface LiqRow {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  timestamp: number;
}

// ─── Binance: GET /fapi/v1/allForceOrders ──────────────────────────
async function fetchBinanceLiqs(): Promise<LiqRow[]> {
  try {
    const resp = await fetch(
      'https://fapi.binance.com/fapi/v1/allForceOrders?limit=200',
      { signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((d: any) => d.status === 'FILLED')
      .map((d: any) => {
        const symbol = normalizeLiqSymbol(d.symbol || '');
        const price = parseFloat(d.averagePrice || d.price || '0');
        const qty = parseFloat(d.executedQty || d.origQty || '0');
        return {
          symbol,
          exchange: 'Binance',
          side: d.side === 'SELL' ? 'long' as const : 'short' as const,
          price,
          quantity: qty,
          valueUsd: price * qty,
          timestamp: d.time,
        };
      })
      .filter((r) => r.valueUsd > 0 && r.price > 0 && isLiqCryptoSymbol(r.symbol));
  } catch (e) {
    console.error('[CRON-LIQ] Binance fetch error:', e);
    return [];
  }
}

// ─── OKX: GET /api/v5/public/liquidation-orders (requires uly param) ─
const OKX_UNDERLYINGS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT',
  'DOGE-USDT', 'SUI-USDT', 'PEPE-USDT', 'LINK-USDT',
];

async function fetchOKXLiqsForUly(uly: string): Promise<LiqRow[]> {
  try {
    const resp = await fetch(
      `https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&state=filled&uly=${uly}&limit=100`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    if (json.code !== '0' || !Array.isArray(json.data)) return [];

    const rows: LiqRow[] = [];
    for (const item of json.data) {
      const instId = item.instId || '';
      const symbol = normalizeLiqSymbol(instId);
      if (!isLiqCryptoSymbol(symbol)) continue;

      for (const d of item.details || []) {
        const price = parseFloat(d.bkPx || '0');
        const qty = parseFloat(d.sz || '0');
        if (price <= 0 || qty <= 0) continue;
        rows.push({
          symbol,
          exchange: 'OKX',
          side: d.side === 'sell' ? 'long' as const : 'short' as const,
          price,
          quantity: qty,
          valueUsd: price * qty,
          timestamp: parseInt(d.ts, 10),
        });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

async function fetchOKXLiqs(): Promise<LiqRow[]> {
  // OKX rate limit: 2 req/2s — batch 2 at a time with 1.2s delay
  const rows: LiqRow[] = [];
  for (let i = 0; i < OKX_UNDERLYINGS.length; i += 2) {
    const batch = OKX_UNDERLYINGS.slice(i, i + 2);
    const results = await Promise.all(batch.map(fetchOKXLiqsForUly));
    rows.push(...results.flat());
    if (i + 2 < OKX_UNDERLYINGS.length) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  return rows;
}

// ─── HTX: GET /linear-swap-api/v3/swap_liquidation_orders ────────
const HTX_CONTRACTS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT',
  'DOGE-USDT', 'SUI-USDT', 'PEPE-USDT', 'LINK-USDT',
  'BNB-USDT', 'ADA-USDT', 'AVAX-USDT', 'ARB-USDT',
];

async function fetchHTXLiqsForContract(contract: string): Promise<LiqRow[]> {
  try {
    const resp = await fetch(
      `https://api.hbdm.com/linear-swap-api/v3/swap_liquidation_orders?contract=${contract}&pair=${contract}&trade_type=0&start_time=${Date.now() - 120000}&end_time=${Date.now()}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    if (json.code !== 200 || !Array.isArray(json.data)) return [];

    return json.data
      .map((d: any) => {
        const symbol = normalizeLiqSymbol(d.contract_code || contract);
        const price = parseFloat(d.price || '0');
        const qty = parseFloat(d.amount || '0');
        const turnover = parseFloat(d.trade_turnover || '0');
        return {
          symbol,
          exchange: 'HTX',
          side: d.direction === 'sell' ? 'long' as const : 'short' as const,
          price,
          quantity: qty,
          valueUsd: turnover > 0 ? turnover : price * qty,
          timestamp: d.created_at || Date.now(),
        };
      })
      .filter((r: LiqRow) => r.valueUsd > 0 && r.price > 0 && isLiqCryptoSymbol(r.symbol));
  } catch {
    return [];
  }
}

async function fetchHTXLiqs(): Promise<LiqRow[]> {
  // Batch 4 at a time to stay within rate limits (240 req/3s is generous)
  const rows: LiqRow[] = [];
  for (let i = 0; i < HTX_CONTRACTS.length; i += 4) {
    const batch = HTX_CONTRACTS.slice(i, i + 4);
    const results = await Promise.all(batch.map(fetchHTXLiqsForContract));
    rows.push(...results.flat());
  }
  return rows;
}

// ─── gTrade: GET /api/trading-history/24h (global backend) ──────
async function fetchGTradeLiqs(): Promise<LiqRow[]> {
  try {
    const resp = await fetch(
      'https://backend-global.gains.trade/api/trading-history/24h?chainId=42161',
      { signal: AbortSignal.timeout(10000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];

    // Only keep liquidation events from the last 2 minutes (dedup handles rest)
    const cutoff = Date.now() - 120000;

    return data
      .filter((d: any) => d.action === 'TradeClosedLIQ')
      .filter((d: any) => {
        const ts = d.date ? new Date(d.date).getTime() : 0;
        return ts > cutoff;
      })
      .map((d: any) => {
        // pair format: "BTC/USD", "ETH/USD", "SOL/USD"
        const symbol = (d.pair || '').split('/')[0].replace(/-/g, '');
        const price = parseFloat(d.price || '0');
        const size = parseFloat(d.size || '0'); // collateral in USD
        const leverage = parseFloat(d.leverage || '1');
        const valueUsd = size * leverage;
        return {
          symbol,
          exchange: 'gTrade',
          side: d.long === 1 ? 'long' as const : 'short' as const,
          price,
          quantity: valueUsd > 0 && price > 0 ? valueUsd / price : 0,
          valueUsd,
          timestamp: new Date(d.date).getTime() || Date.now(),
        };
      })
      .filter((r: LiqRow) => r.valueUsd > 0 && r.price > 0 && isLiqCryptoSymbol(r.symbol));
  } catch (e) {
    console.error('[CRON-LIQ] gTrade fetch error:', e);
    return [];
  }
}

// ─── Deribit: GET /api/v2/public/get_last_trades_by_currency ────
async function fetchDeribitLiqsForCurrency(currency: string): Promise<LiqRow[]> {
  try {
    const resp = await fetch(
      `https://www.deribit.com/api/v2/public/get_last_trades_by_currency?currency=${currency}&kind=future&count=200`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    if (!json.result?.trades) return [];

    return json.result.trades
      .filter((t: any) => t.liquidation) // only liquidation trades
      .map((t: any) => {
        const symbol = currency; // BTC, ETH etc
        const price = parseFloat(t.price || '0');
        const qty = parseFloat(t.amount || '0');
        return {
          symbol,
          exchange: 'Deribit',
          // liquidation='M' means maker was liquidated, 'T' means taker was liquidated
          side: t.direction === 'sell' ? 'long' as const : 'short' as const,
          price,
          quantity: qty,
          valueUsd: price * qty,
          timestamp: t.timestamp || Date.now(),
        };
      })
      .filter((r: LiqRow) => r.valueUsd > 0 && r.price > 0);
  } catch {
    return [];
  }
}

async function fetchDeribitLiqs(): Promise<LiqRow[]> {
  const currencies = ['BTC', 'ETH'];
  const results = await Promise.all(currencies.map(fetchDeribitLiqsForCurrency));
  return results.flat();
}

// ─── Handler ───────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Verify cron auth (Vercel sends CRON_SECRET in Authorization header)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  // Fetch from all exchanges in parallel
  const [binance, okx, htx, gtrade, deribit] = await Promise.all([
    fetchBinanceLiqs(),
    fetchOKXLiqs(),
    fetchHTXLiqs(),
    fetchGTradeLiqs(),
    fetchDeribitLiqs(),
  ]);

  const allRows = [...binance, ...okx, ...htx, ...gtrade, ...deribit];

  const fetched = {
    binance: binance.length,
    okx: okx.length,
    htx: htx.length,
    gtrade: gtrade.length,
    deribit: deribit.length,
  };

  if (allRows.length === 0) {
    return NextResponse.json({ ok: true, fetched, inserted: 0 });
  }

  // Insert via existing DB helper (handles dedup with ON CONFLICT DO NOTHING)
  const inserted = await saveLiquidationSnapshot(allRows);

  return NextResponse.json({ ok: true, fetched, inserted });
}
