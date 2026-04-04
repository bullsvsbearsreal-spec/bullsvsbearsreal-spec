/**
 * Client-side liquidation ingest endpoint.
 * Receives batched liquidation events from the browser's WebSocket connections
 * and persists them to the database. This bridges the gap between the 9-exchange
 * real-time WebSocket feed (browser-only) and the historical DB (previously only
 * 5 exchanges via REST cron).
 *
 * Rate limited: max 1 request per 5 seconds per IP, max 50 events per batch.
 * Deduplication handled by DB unique index (symbol, exchange, side, price, ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDBConfigured, saveLiquidationSnapshot } from '@/lib/db';
import { isLiqCryptoSymbol, normalizeLiqSymbol } from '@/lib/liquidation-parsers';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

const MAX_BATCH_SIZE = 50;
// Only accept events from these known exchanges
const ALLOWED_EXCHANGES = new Set([
  'Binance', 'Bybit', 'OKX', 'Bitget', 'Deribit', 'HTX', 'gTrade', 'dYdX', 'Bitfinex',
]);

// Simple in-memory rate limiting (per-deployment, not global)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 5000;

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const lastRequest = rateLimitMap.get(ip) || 0;
  if (now - lastRequest < RATE_LIMIT_MS) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }
  rateLimitMap.set(ip, now);

  // Clean old entries periodically
  if (rateLimitMap.size > 1000) {
    Array.from(rateLimitMap.entries()).forEach(([key, ts]) => {
      if (now - ts > 60000) rateLimitMap.delete(key);
    });
  }

  if (!isDBConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const events = body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'No events' }, { status: 400 });
  }

  // Validate and sanitize events
  const validRows = events
    .slice(0, MAX_BATCH_SIZE)
    .filter((e: any) => {
      if (!e.symbol || !e.exchange || !e.side || !e.price || !e.value || !e.timestamp) return false;
      if (!ALLOWED_EXCHANGES.has(e.exchange)) return false;
      if (e.side !== 'long' && e.side !== 'short') return false;
      if (typeof e.price !== 'number' || e.price <= 0) return false;
      if (typeof e.value !== 'number' || e.value <= 0) return false;
      if (typeof e.timestamp !== 'number') return false;
      // Reject events older than 1 hour or in the future
      const age = now - e.timestamp;
      if (age > 3600000 || age < -30000) return false;
      return true;
    })
    .map((e: any) => {
      const symbol = normalizeLiqSymbol(e.symbol);
      if (!isLiqCryptoSymbol(symbol)) return null;
      return {
        symbol,
        exchange: e.exchange,
        side: e.side as 'long' | 'short',
        price: e.price,
        quantity: e.quantity || (e.value / e.price),
        valueUsd: e.value,
        timestamp: e.timestamp,
      };
    })
    .filter(Boolean) as any[];

  if (validRows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, reason: 'No valid events after filtering' });
  }

  try {
    const inserted = await saveLiquidationSnapshot(validRows);
    return NextResponse.json({ ok: true, inserted, accepted: validRows.length });
  } catch (err) {
    console.error('[LIQ-INGEST] DB save error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
