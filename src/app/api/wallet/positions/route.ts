import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

import type { HLClearingHouseState } from '../../_shared/hyperliquid-types';

interface DexPosition {
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  positionValue: number;
  unrealizedPnl: number;
  roe: number;
  leverage: number;
  liquidationPrice: number | null;
  marginUsed: number;
  // Extended Hyperliquid fields
  marginType?: 'cross' | 'isolated';
  maxLeverage?: number;
  fundingSinceOpen?: number;
  fundingAllTime?: number;
}

interface HLOpenOrder {
  coin: string;
  side: 'B' | 'A'; // Buy / Ask(Sell)
  limitPx: string;
  sz: string;
  oid: number;
  timestamp: number;
  orderType: string;
  reduceOnly?: boolean;
  triggerPx?: string;
  triggerCondition?: string;
}

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

const cache = new Map<string, { data: unknown; time: number }>();
const CACHE_TTL = 60_000; // 60s

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data as T;
  return null;
}

function setMem(key: string, data: unknown) {
  cache.set(key, { data, time: Date.now() });
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid helpers                                                */
/* ------------------------------------------------------------------ */

async function fetchClearinghouseState(address: string): Promise<HLClearingHouseState | null> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: address }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as HLClearingHouseState;
  } catch {
    return null;
  }
}

async function fetchMarkPrices(): Promise<Record<string, number>> {
  // Check cache first
  const cached = getCached<Record<string, number>>('hl:markPrices');
  if (cached) return cached;

  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return {};
    const [meta, assetCtxs] = await res.json();
    const map: Record<string, number> = {};
    const symbols: string[] = meta?.universe?.map((u: { name: string }) => u.name) ?? [];
    for (let i = 0; i < symbols.length && i < assetCtxs.length; i++) {
      const px = parseFloat(assetCtxs[i]?.markPx);
      if (!isNaN(px)) map[symbols[i]] = px;
    }
    setMem('hl:markPrices', map);
    return map;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid open orders                                            */
/* ------------------------------------------------------------------ */

async function fetchHLOpenOrders(address: string): Promise<HLOpenOrder[]> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'openOrders', user: address }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid recent fills (trade history)                           */
/* ------------------------------------------------------------------ */

interface HLFill {
  coin: string;
  px: string;
  sz: string;
  side: 'B' | 'A';
  time: number;
  fee: string;
  closedPnl: string;
  crossed: boolean;
  oid: number;
}

async function fetchHLFills(address: string): Promise<HLFill[]> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userFills', user: address }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 50) : []; // last 50
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid funding payment history                                */
/* ------------------------------------------------------------------ */

interface HLFundingPayment {
  coin: string;
  usdc: string;
  szi: string;
  fundingRate: string;
  time: number;
}

async function fetchHLFundingHistory(address: string): Promise<HLFundingPayment[]> {
  try {
    // Get last 7 days of funding payments
    const startTime = Date.now() - 7 * 24 * 3600_000;
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userFunding', user: address, startTime }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid spot balances                                          */
/* ------------------------------------------------------------------ */

interface HLSpotBalance {
  coin: string;
  token: number;
  hold: string;
  total: string;
  entryNtl: string;
}

async function fetchHLSpotBalances(address: string): Promise<HLSpotBalance[]> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'spotClearinghouseState', user: address }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.balances) ? data.balances : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid portfolio (equity curve + PnL)                         */
/* ------------------------------------------------------------------ */

async function fetchHLPortfolio(address: string): Promise<any[]> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'portfolio', user: address }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid user fees + volume                                     */
/* ------------------------------------------------------------------ */

async function fetchHLUserFees(address: string): Promise<any> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userFees', user: address }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid account ledger (deposits/withdrawals/transfers)        */
/* ------------------------------------------------------------------ */

async function fetchHLLedger(address: string): Promise<any[]> {
  try {
    const startTime = Date.now() - 30 * 24 * 3600_000; // last 30 days
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'userNonFundingLedgerUpdates', user: address, startTime }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 50) : []; // last 50
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Hyperliquid enhanced open orders (frontendOpenOrders)              */
/* ------------------------------------------------------------------ */

async function fetchHLFrontendOrders(address: string): Promise<any[]> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'frontendOpenOrders', user: address }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  GMX V2 position fetching (Arbitrum)                                */
/* ------------------------------------------------------------------ */

async function fetchGMXPositions(address: string): Promise<DexPosition[]> {
  try {
    // GMX V2 uses subgraph for position data
    const query = `{
      positions(where: { account: "${address.toLowerCase()}", status: "Open" }, first: 50) {
        market { indexToken { symbol } marketToken }
        isLong
        sizeInUsd
        collateralAmount
        entryPrice
        liquidationPrice
        borrowingFactor
      }
    }`;
    const res = await fetch('https://subgraph.satsuma-prod.com/3b2ced13c8d9/gmx/synthetics-arbitrum-stats/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rawPositions = json?.data?.positions;
    if (!Array.isArray(rawPositions)) return [];

    const safeBigInt = (v: any): bigint => {
      try { return BigInt(v || '0'); } catch { return BigInt(0); }
    };

    return rawPositions.map((p: any) => {
      const sizeUsd = Number(safeBigInt(p.sizeInUsd)) / 1e30;
      const entryPrice = Number(safeBigInt(p.entryPrice)) / 1e30;
      const collateralUsd = Number(safeBigInt(p.collateralAmount)) / 1e30;
      const liqPrice = p.liquidationPrice ? Number(safeBigInt(p.liquidationPrice)) / 1e30 : null;
      const symbol = p.market?.indexToken?.symbol?.replace('WBTC', 'BTC').replace('WETH', 'ETH') || '?';
      const markPrice = entryPrice; // Subgraph doesn't give live mark — entryPrice as fallback
      const leverage = collateralUsd > 0 ? sizeUsd / collateralUsd : 0;
      return {
        exchange: 'GMX',
        symbol,
        side: p.isLong ? 'long' as const : 'short' as const,
        size: entryPrice > 0 ? sizeUsd / entryPrice : 0,
        entryPrice,
        markPrice,
        positionValue: sizeUsd,
        unrealizedPnl: 0, // Not available from subgraph
        roe: 0,
        leverage: Math.round(leverage * 10) / 10,
        liquidationPrice: liqPrice,
        marginUsed: collateralUsd,
      };
    }).filter((p: DexPosition) => p.positionValue > 1);
  } catch (e) {
    console.error('[wallet/positions] GMX fetch error:', e);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  dYdX V4 position fetching                                          */
/* ------------------------------------------------------------------ */

async function fetchDYDXPositions(address: string): Promise<DexPosition[]> {
  try {
    // dYdX V4 uses a REST indexer API
    const res = await fetch(`https://indexer.dydx.trade/v4/addresses/${address}/subaccounts/0/perpetualPositions?status=OPEN`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rawPositions = json?.positions;
    if (!Array.isArray(rawPositions)) return [];

    return rawPositions.map((p: any) => {
      const size = Math.abs(parseFloat(p.size) || 0);
      const entryPrice = parseFloat(p.entryPrice) || 0;
      const unrealizedPnl = parseFloat(p.unrealizedPnl) || 0;
      const symbol = (p.market || '').replace('-USD', '');
      const side = parseFloat(p.size) >= 0 ? 'long' as const : 'short' as const;
      const positionValue = size * entryPrice;
      return {
        exchange: 'dYdX',
        symbol,
        side,
        size,
        entryPrice,
        markPrice: entryPrice, // Approximate — live mark not in this endpoint
        positionValue,
        unrealizedPnl,
        roe: positionValue > 0 ? (unrealizedPnl / positionValue) * 100 : 0,
        leverage: 0, // dYdX V4 indexer doesn't expose per-position leverage
        liquidationPrice: null, // Would need oracle prices + subaccount equity to compute
        marginUsed: 0,
      };
    }).filter((p: DexPosition) => p.positionValue > 1);
  } catch (e) {
    console.error('[wallet/positions] dYdX fetch error:', e);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Route handler — multi-DEX aggregation                              */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get('address');
  const exchange = new URL(request.url).searchParams.get('exchange'); // Optional: 'hyperliquid', 'gmx', 'dydx', or 'all' (default)
  if (!address) {
    return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
  }

  // Check cache
  const cacheKey = `positions:${(exchange || 'all').toLowerCase()}:${address.toLowerCase()}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  const target = (exchange || 'all').toLowerCase();
  const allPositions: DexPosition[] = [];
  const exchanges: { name: string; accountValue: number; totalMarginUsed: number; positionCount: number; withdrawable?: number }[] = [];
  let hlOpenOrders: HLOpenOrder[] = [];
  let hlFills: HLFill[] = [];
  let hlFundingPayments: HLFundingPayment[] = [];
  let hlSpotBalances: HLSpotBalance[] = [];
  let hlPortfolio: any[] = [];
  let hlUserFees: any = null;
  let hlLedger: any[] = [];
  const errors: string[] = [];

  // Fetch from requested exchanges in parallel
  const fetchers: Promise<void>[] = [];

  // Hyperliquid
  if (target === 'all' || target === 'hyperliquid') {
    fetchers.push((async () => {
      const [state, markPriceMap, feOrders, fills, fundingPayments, spotBalances, portfolio, userFees, ledger] = await Promise.all([
        fetchClearinghouseState(address),
        fetchMarkPrices(),
        fetchHLFrontendOrders(address),
        fetchHLFills(address),
        fetchHLFundingHistory(address),
        fetchHLSpotBalances(address),
        fetchHLPortfolio(address),
        fetchHLUserFees(address),
        fetchHLLedger(address),
      ]);
      // Map frontend orders to our format
      hlOpenOrders = feOrders.map((o: any) => ({
        coin: o.coin,
        side: o.side,
        limitPx: o.limitPx,
        sz: o.sz,
        oid: o.oid,
        timestamp: o.timestamp,
        orderType: o.orderType || 'limit',
        reduceOnly: o.reduceOnly,
        triggerPx: o.triggerPx,
        triggerCondition: o.triggerCondition,
        tpsl: o.tpsl, // TP/SL metadata from frontendOpenOrders
        children: o.children, // child orders (linked TP/SL)
      }));
      hlFills = fills;
      hlFundingPayments = fundingPayments;
      hlSpotBalances = spotBalances.filter((b: any) => parseFloat(b.total) > 0);
      hlPortfolio = portfolio;
      hlUserFees = userFees;
      hlLedger = ledger;
      if (!state) {
        exchanges.push({ name: 'Hyperliquid', accountValue: 0, totalMarginUsed: 0, positionCount: 0 });
        errors.push('Hyperliquid API unavailable');
        return;
      }
      const accountValue = parseFloat(state.marginSummary.accountValue) || 0;
      const totalMarginUsed = parseFloat(state.marginSummary.totalMarginUsed) || 0;
      let count = 0;
      for (const ap of state.assetPositions) {
        const p = ap.position;
        const size = parseFloat(p.szi) || 0;
        if (Math.abs(parseFloat(p.positionValue) || 0) < 1) continue;
        allPositions.push({
          exchange: 'Hyperliquid',
          symbol: p.coin,
          side: size >= 0 ? 'long' : 'short',
          size: Math.abs(size),
          entryPrice: parseFloat(p.entryPx) || 0,
          markPrice: markPriceMap[p.coin] || parseFloat(p.entryPx) || 0,
          positionValue: Math.abs(parseFloat(p.positionValue) || 0),
          unrealizedPnl: parseFloat(p.unrealizedPnl) || 0,
          roe: (parseFloat(p.returnOnEquity) || 0) * 100,
          leverage: p.leverage?.value ?? 1,
          liquidationPrice: p.liquidationPx ? parseFloat(p.liquidationPx) : null,
          marginUsed: parseFloat(p.marginUsed) || 0,
          marginType: (p.leverage?.type === 'isolated' ? 'isolated' : 'cross') as 'cross' | 'isolated',
          maxLeverage: p.maxLeverage || undefined,
          fundingSinceOpen: parseFloat(p.cumFunding?.sinceOpen) || 0,
          fundingAllTime: parseFloat(p.cumFunding?.allTime) || 0,
        });
        count++;
      }
      const withdrawable = parseFloat(state.withdrawable) || 0;
      exchanges.push({ name: 'Hyperliquid', accountValue, totalMarginUsed, positionCount: count, withdrawable });
    })());
  }

  // GMX V2 (Arbitrum) — use HL mark prices to fix GMX's missing live prices
  if (target === 'all' || target === 'gmx') {
    fetchers.push((async () => {
      const [positions, hlPrices] = await Promise.all([
        fetchGMXPositions(address),
        fetchMarkPrices(), // reuse HL prices as mark price source
      ]);
      // Patch GMX positions with live mark prices where available
      for (const p of positions) {
        const livePrice = hlPrices[p.symbol];
        if (livePrice && livePrice > 0) {
          p.markPrice = livePrice;
          // Recalculate PnL with live price
          const priceDiff = p.side === 'long'
            ? livePrice - p.entryPrice
            : p.entryPrice - livePrice;
          p.unrealizedPnl = priceDiff * p.size;
          p.roe = p.marginUsed > 0 ? (p.unrealizedPnl / p.marginUsed) * 100 : 0;
        }
      }
      allPositions.push(...positions);
      const totalValue = positions.reduce((s, p) => s + p.positionValue, 0);
      exchanges.push({ name: 'GMX', accountValue: totalValue, totalMarginUsed: 0, positionCount: positions.length });
    })());
  }

  // dYdX V4
  if (target === 'all' || target === 'dydx') {
    fetchers.push((async () => {
      const positions = await fetchDYDXPositions(address);
      allPositions.push(...positions);
      const totalValue = positions.reduce((s, p) => s + p.positionValue, 0);
      exchanges.push({ name: 'dYdX', accountValue: totalValue, totalMarginUsed: 0, positionCount: positions.length });
    })());
  }

  await Promise.all(fetchers);

  // Sort all positions by value descending
  allPositions.sort((a, b) => b.positionValue - a.positionValue);

  const totalAccountValue = exchanges.reduce((s, e) => s + e.accountValue, 0);
  const totalMarginUsed = exchanges.reduce((s, e) => s + e.totalMarginUsed, 0);

  const result = {
    exchanges,
    totalAccountValue,
    totalMarginUsed,
    totalPositions: allPositions.length,
    positions: allPositions,
    hlOpenOrders: hlOpenOrders.map(o => ({
      coin: o.coin,
      side: o.side === 'B' ? 'buy' as const : 'sell' as const,
      price: parseFloat(o.limitPx),
      size: parseFloat(o.sz),
      value: parseFloat(o.limitPx) * parseFloat(o.sz),
      oid: o.oid,
      timestamp: o.timestamp,
      reduceOnly: o.reduceOnly || false,
      triggerPx: o.triggerPx ? parseFloat(o.triggerPx) : undefined,
    })),
    hlFills: hlFills.map(f => ({
      coin: f.coin,
      side: f.side === 'B' ? 'buy' as const : 'sell' as const,
      price: parseFloat(f.px),
      size: parseFloat(f.sz),
      value: parseFloat(f.px) * parseFloat(f.sz),
      time: f.time,
      fee: parseFloat(f.fee),
      closedPnl: parseFloat(f.closedPnl),
      crossed: f.crossed,
    })),
    hlFundingPayments: hlFundingPayments.slice(0, 100).map((fp: HLFundingPayment) => ({
      coin: fp.coin,
      amount: parseFloat(fp.usdc),
      rate: parseFloat(fp.fundingRate),
      positionSize: parseFloat(fp.szi),
      time: fp.time,
    })),
    hlSpotBalances: hlSpotBalances.map((b: HLSpotBalance) => ({
      coin: b.coin,
      total: parseFloat(b.total),
      hold: parseFloat(b.hold),
      available: parseFloat(b.total) - parseFloat(b.hold),
    })),
    hlPortfolio: (() => {
      // Parse portfolio into a clean format for each period
      const periods: Record<string, { equity: [number, number][]; pnl: [number, number][]; volume: number }> = {};
      for (const [period, data] of hlPortfolio) {
        if (!data) continue;
        periods[period] = {
          equity: (data.accountValueHistory || []).map((p: any) => [p[0], parseFloat(p[1]) || 0]),
          pnl: (data.pnlHistory || []).map((p: any) => [p[0], parseFloat(p[1]) || 0]),
          volume: parseFloat(data.vlm) || 0,
        };
      }
      return Object.keys(periods).length > 0 ? periods : undefined;
    })(),
    hlUserFees: hlUserFees ? {
      makerRate: parseFloat(hlUserFees.userAddRate) || 0,
      takerRate: parseFloat(hlUserFees.userCrossRate) || 0,
      dailyVolume: (hlUserFees.dailyUserVlm || []).map((d: any) => ({
        date: d.date,
        taker: parseFloat(d.userCross) || 0,
        maker: parseFloat(d.userAdd) || 0,
      })),
    } : undefined,
    hlLedger: hlLedger.slice(0, 30).map((entry: any) => ({
      type: entry.delta?.type || 'unknown',
      amount: parseFloat(entry.delta?.usdc || entry.delta?.amount || entry.delta?.usdcValue || '0'),
      fee: parseFloat(entry.delta?.fee || '0'),
      time: entry.time,
      token: entry.delta?.token,
      destination: entry.delta?.destination,
    })).filter((e: any) => Math.abs(e.amount) > 0),
    errors: errors.length > 0 ? errors : undefined,
  };

  setMem(cacheKey, result);
  if (cache.size > 500) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
