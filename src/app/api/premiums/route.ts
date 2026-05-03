/**
 * GET /api/premiums
 *
 * Regional BTC/ETH premium tracker across major venues.
 *   • Coinbase Premium Gap — BTC/ETH on Coinbase (US retail + institutions) vs Binance (global).
 *     Positive = US demand > global; classic institutional accumulation signal.
 *   • Kimchi Premium — BTC/ETH on Upbit (KRW, Korean retail) vs Binance USDT (global).
 *     Historical extreme-retail-greed gauge.
 *
 * All data from free public APIs — no keys needed.
 * Cache: 30s.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

interface Venue {
  exchange: string;
  currency: string;
  nativePrice: number;
  usdPrice: number;       // converted to USD
  volume24h?: number;
}

interface PremiumRow {
  symbol: 'BTC' | 'ETH';
  globalUsd: number;
  usGap: { venue: Venue | null; gapPct: number | null };
  kimchi: { venue: Venue | null; gapPct: number | null };
  japanGap: { venue: Venue | null; gapPct: number | null };
}

interface PremiumsResponse {
  rows: PremiumRow[];
  meta: {
    timestamp: number;
    fxRates: { usdKrw: number; usdJpy: number };
    sources: string[];
  };
}

const cache = new Map<string, { body: PremiumsResponse; ts: number }>();
const CACHE_TTL = 30_000;

async function safeFetch<T = any>(url: string, timeoutMs = 6000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Accept': 'application/json', 'User-Agent': 'InfoHub/2.0 (info-hub.io)' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function getFxRates(): Promise<{ usdKrw: number; usdJpy: number }> {
  // Primary: open.er-api.com (free, no key)
  const primary = await safeFetch<{ rates?: Record<string, number> }>(
    'https://open.er-api.com/v6/latest/USD',
  );
  if (primary?.rates?.KRW && primary.rates.JPY) {
    return { usdKrw: primary.rates.KRW, usdJpy: primary.rates.JPY };
  }
  // Fallback: exchangerate.host
  const backup = await safeFetch<{ rates?: Record<string, number> }>(
    'https://api.exchangerate.host/latest?base=USD&symbols=KRW,JPY',
  );
  if (backup?.rates?.KRW && backup.rates.JPY) {
    return { usdKrw: backup.rates.KRW, usdJpy: backup.rates.JPY };
  }
  // Hard-coded last resort (approx Apr 2026); prevents NaN but tags stale
  return { usdKrw: 1420, usdJpy: 150 };
}

async function getBinanceSpot(symbol: 'BTC' | 'ETH'): Promise<Venue | null> {
  const pair = symbol === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';
  const d = await safeFetch<{ lastPrice: string; quoteVolume: string }>(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`,
  );
  if (!d?.lastPrice) return null;
  const price = parseFloat(d.lastPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    exchange: 'Binance',
    currency: 'USDT',
    nativePrice: price,
    usdPrice: price,
    volume24h: parseFloat(d.quoteVolume) || 0,
  };
}

async function getCoinbase(symbol: 'BTC' | 'ETH'): Promise<Venue | null> {
  const pair = symbol === 'BTC' ? 'BTC-USD' : 'ETH-USD';
  // Coinbase Advanced Trade — /products/:id/ticker
  const d = await safeFetch<{ price: string; volume: string }>(
    `https://api.exchange.coinbase.com/products/${pair}/ticker`,
  );
  if (!d?.price) return null;
  const price = parseFloat(d.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    exchange: 'Coinbase',
    currency: 'USD',
    nativePrice: price,
    usdPrice: price,
    volume24h: parseFloat(d.volume) || 0,
  };
}

async function getUpbit(symbol: 'BTC' | 'ETH', usdKrw: number): Promise<Venue | null> {
  const d = await safeFetch<Array<{ trade_price: number; acc_trade_price_24h: number }>>(
    `https://api.upbit.com/v1/ticker?markets=KRW-${symbol}`,
  );
  const t = Array.isArray(d) ? d[0] : null;
  if (!t?.trade_price) return null;
  const usdPrice = t.trade_price / usdKrw;
  if (!Number.isFinite(usdPrice) || usdPrice <= 0) return null;
  return {
    exchange: 'Upbit',
    currency: 'KRW',
    nativePrice: t.trade_price,
    usdPrice,
    volume24h: (t.acc_trade_price_24h || 0) / usdKrw,
  };
}

async function getBitflyer(symbol: 'BTC' | 'ETH', usdJpy: number): Promise<Venue | null> {
  // bitFlyer Japan spot tickers
  const pair = symbol === 'BTC' ? 'BTC_JPY' : 'ETH_JPY';
  const d = await safeFetch<{ ltp: number; volume_by_product: number }>(
    `https://api.bitflyer.com/v1/ticker?product_code=${pair}`,
  );
  if (!d?.ltp) return null;
  const usdPrice = d.ltp / usdJpy;
  if (!Number.isFinite(usdPrice) || usdPrice <= 0) return null;
  return {
    exchange: 'bitFlyer',
    currency: 'JPY',
    nativePrice: d.ltp,
    usdPrice,
    volume24h: (d.volume_by_product || 0) * usdPrice,
  };
}

function gapPct(regional: number, global: number): number {
  if (!Number.isFinite(global) || global <= 0) return 0;
  return ((regional - global) / global) * 100;
}

export async function GET(_request: NextRequest) {
  const cacheKey = 'premiums:v1';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.body, { headers: { 'X-Cache': 'HIT' } });
  }

  const fx = await getFxRates();

  // Fetch all venues in parallel
  const [btcBin, ethBin, btcCb, ethCb, btcUp, ethUp, btcBf, ethBf] = await Promise.all([
    getBinanceSpot('BTC'),
    getBinanceSpot('ETH'),
    getCoinbase('BTC'),
    getCoinbase('ETH'),
    getUpbit('BTC', fx.usdKrw),
    getUpbit('ETH', fx.usdKrw),
    getBitflyer('BTC', fx.usdJpy),
    getBitflyer('ETH', fx.usdJpy),
  ]);

  const rows: PremiumRow[] = [];

  const buildRow = (
    sym: 'BTC' | 'ETH',
    bin: Venue | null,
    cb: Venue | null,
    up: Venue | null,
    bf: Venue | null,
  ): PremiumRow | null => {
    const globalUsd = bin?.usdPrice ?? 0;
    if (globalUsd <= 0) return null;
    return {
      symbol: sym,
      globalUsd,
      usGap:    { venue: cb, gapPct: cb ? gapPct(cb.usdPrice, globalUsd) : null },
      kimchi:   { venue: up, gapPct: up ? gapPct(up.usdPrice, globalUsd) : null },
      japanGap: { venue: bf, gapPct: bf ? gapPct(bf.usdPrice, globalUsd) : null },
    };
  };

  const btc = buildRow('BTC', btcBin, btcCb, btcUp, btcBf);
  const eth = buildRow('ETH', ethBin, ethCb, ethUp, ethBf);
  if (btc) rows.push(btc);
  if (eth) rows.push(eth);

  const body: PremiumsResponse = {
    rows,
    meta: {
      timestamp: Date.now(),
      fxRates: fx,
      sources: ['Binance', 'Coinbase', 'Upbit', 'bitFlyer', 'open.er-api'],
    },
  };

  cache.set(cacheKey, { body, ts: Date.now() });
  return NextResponse.json(body, {
    headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=90' },
  });
}
