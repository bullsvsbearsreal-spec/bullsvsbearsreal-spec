# Execution Cost Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `/execution-costs` page that compares real-time execution costs (fees + spread + price impact) across all 11 DEX perpetual exchanges.

**Architecture:** Single API endpoint fetches orderbook depth / AMM parameters from all 11 DEXes in parallel, computes execution cost per venue using 4 strategies (CLOB book walk, L3 aggregation, AMM formula, quote interpolation), returns ranked results. Client page shows ranked venue cards, sortable breakdown table, and depth visualization chart.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Recharts, existing `fetchWithTimeout` and `ExchangeFetcherConfig` patterns.

**Design doc:** `docs/plans/2026-02-28-execution-costs-design.md`

---

## Task 1: Types & Book Walker Core

**Files:**
- Create: `src/lib/execution-costs/types.ts`
- Create: `src/lib/execution-costs/book-walker.ts`

**Step 1: Create types file**

Create `src/lib/execution-costs/types.ts`:

```typescript
export type Direction = 'long' | 'short';

export interface OrderbookLevel {
  price: number;
  size: number;  // in base asset units
}

export interface RawBookData {
  exchange: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  midPrice: number;
  symbol: string;
  method: 'clob' | 'amm_formula' | 'amm_rpc' | 'quote';
}

export interface VenueCost {
  exchange: string;
  available: boolean;
  fee: number;              // %
  spread: number;           // %
  priceImpact: number;      // %
  totalCost: number;        // fee + spread + priceImpact
  executionPrice: number;
  midPrice: number;
  maxFillableSize: number;  // USD
  depthLevels?: number;
  method: 'clob' | 'amm_formula' | 'amm_rpc' | 'quote';
  error?: string;
}

export interface ExecutionCostResponse {
  asset: string;
  size: number;
  direction: Direction;
  timestamp: number;
  venues: VenueCost[];
}

export interface BookWalkResult {
  vwap: number;
  filledUsd: number;
  levelsConsumed: number;
}

export interface DepthPoint {
  exchange: string;
  priceOffset: number;  // % from mid
  cumulativeUsd: number;
}
```

**Step 2: Create book-walker.ts**

Create `src/lib/execution-costs/book-walker.ts`:

```typescript
import { OrderbookLevel, BookWalkResult, DepthPoint } from './types';

/**
 * Walk an orderbook to compute VWAP for a given USD order size.
 * `levels` must be sorted best-to-worst (asks ascending, bids descending).
 */
export function walkBook(
  levels: OrderbookLevel[],
  orderSizeUsd: number,
  midPrice: number,
): BookWalkResult {
  let remaining = orderSizeUsd;
  let weightedPriceSum = 0;
  let levelsConsumed = 0;

  for (const level of levels) {
    if (remaining <= 0) break;
    const levelValueUsd = level.size * level.price;
    const fillUsd = Math.min(remaining, levelValueUsd);
    // Weight by price: sum of (fillUsd * price / price) simplifies,
    // but we want VWAP = sum(qty_i * price_i) / sum(qty_i)
    // Since qty_i = fillUsd / level.price:
    // VWAP = sum(fillUsd) / sum(fillUsd / level.price) ... NO
    // Simpler: VWAP = sum(fillUsd_i * level.price_i / levelValueUsd_i * levelValueUsd_i) ...
    // Actually: for a fill of $X at price P, the qty is X/P.
    // VWAP = totalUsd / totalQty = totalUsd / sum(fillUsd_i / price_i)
    weightedPriceSum += fillUsd / level.price; // accumulate base qty
    remaining -= fillUsd;
    levelsConsumed++;
  }

  const filledUsd = orderSizeUsd - remaining;
  // VWAP = total USD spent / total base qty acquired
  const vwap = weightedPriceSum > 0 ? filledUsd / weightedPriceSum : midPrice;

  return { vwap, filledUsd, levelsConsumed };
}

/**
 * Compute spread and price impact from a book walk result.
 * Returns percentages.
 */
export function computeCostFromWalk(
  walkResult: BookWalkResult,
  midPrice: number,
): { spread: number; priceImpact: number } {
  if (walkResult.filledUsd <= 0 || midPrice <= 0) {
    return { spread: 0, priceImpact: 0 };
  }
  // Total slippage = |VWAP - midPrice| / midPrice * 100
  const totalSlippage = Math.abs(walkResult.vwap - midPrice) / midPrice * 100;
  // For simplicity, spread = slippage at the best level, impact = rest
  // But most venues don't separate these clearly, so:
  // spread = total slippage (includes both spread and impact)
  // We report it all as priceImpact since fee is separate
  return { spread: 0, priceImpact: totalSlippage };
}

/**
 * Compute max fillable size: the total USD depth available in the book.
 */
export function maxFillableUsd(levels: OrderbookLevel[]): number {
  let total = 0;
  for (const level of levels) {
    total += level.size * level.price;
  }
  return total;
}

/**
 * Build cumulative depth curve for charting.
 * Returns array of { priceOffset%, cumulativeUsd } points.
 */
export function buildDepthCurve(
  levels: OrderbookLevel[],
  midPrice: number,
  exchange: string,
): DepthPoint[] {
  const points: DepthPoint[] = [];
  let cumulative = 0;

  for (const level of levels) {
    cumulative += level.size * level.price;
    const offset = Math.abs(level.price - midPrice) / midPrice * 100;
    points.push({
      exchange,
      priceOffset: Math.round(offset * 1000) / 1000,
      cumulativeUsd: Math.round(cumulative),
    });
  }

  return points;
}
```

**Step 3: Commit**

```bash
git add src/lib/execution-costs/types.ts src/lib/execution-costs/book-walker.ts
git commit -m "feat(execution-costs): add types and book-walker algorithm"
```

---

## Task 2: Symbol Mapping

**Files:**
- Create: `src/lib/execution-costs/symbol-map.ts`

**Step 1: Create symbol mapping**

This maps a normalized asset name (BTC, ETH) to each venue's native format. Also provides the reverse: a list of which assets each venue supports (fetched dynamically from existing data, with a static fallback for the top assets).

Create `src/lib/execution-costs/symbol-map.ts`:

```typescript
/**
 * Maps normalized asset symbols to venue-native formats.
 * For venues using pair indices (gTrade) or market IDs (Lighter),
 * we need the metadata fetch to resolve these dynamically.
 */

export type VenueSymbolFormat = {
  formatSymbol: (asset: string) => string;
};

// Static symbol formatters for each venue
export const VENUE_SYMBOL_FORMATS: Record<string, VenueSymbolFormat> = {
  Hyperliquid: {
    formatSymbol: (asset) => asset, // "BTC"
  },
  dYdX: {
    formatSymbol: (asset) => `${asset}-USD`, // "BTC-USD"
  },
  Drift: {
    formatSymbol: (asset) => `${asset}-PERP`, // "BTC-PERP"
  },
  Aster: {
    formatSymbol: (asset) => `${asset}USDT`, // "BTCUSDT"
  },
  Aevo: {
    formatSymbol: (asset) => asset, // "BTC"
  },
  Lighter: {
    formatSymbol: (asset) => asset, // resolved to market_id at runtime
  },
  Extended: {
    formatSymbol: (asset) => `${asset}-USD`, // approximate
  },
  edgeX: {
    formatSymbol: (asset) => `${asset}USD`, // approximate
  },
  gTrade: {
    formatSymbol: (asset) => asset, // resolved to pair index at runtime
  },
  GMX: {
    formatSymbol: (asset) => asset, // resolved to market key at runtime
  },
  Variational: {
    formatSymbol: (asset) => asset, // resolved at runtime
  },
};

// Top crypto assets supported across most DEXes
export const DEFAULT_ASSETS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT',
  'MATIC', 'UNI', 'NEAR', 'ARB', 'OP', 'SUI', 'APT', 'FIL', 'ATOM', 'LTC',
  'TIA', 'SEI', 'INJ', 'JUP', 'WIF', 'PEPE', 'BONK', 'RENDER', 'FET', 'TAO',
  'AAVE', 'MKR', 'CRV', 'PENDLE', 'STX', 'IMX', 'MANA', 'SAND', 'GALA', 'AXS',
  'ORDI', 'WLD', 'STRK', 'BLUR', 'JTO', 'PYTH', 'W', 'ENA', 'ONDO', 'TON',
] as const;

export type SupportedAsset = (typeof DEFAULT_ASSETS)[number] | string;
```

**Step 2: Commit**

```bash
git add src/lib/execution-costs/symbol-map.ts
git commit -m "feat(execution-costs): add venue symbol mapping"
```

---

## Task 3: CLOB Venue Fetchers (Hyperliquid, dYdX, Drift, Aster, Aevo)

**Files:**
- Create: `src/lib/execution-costs/venues/hyperliquid.ts`
- Create: `src/lib/execution-costs/venues/dydx.ts`
- Create: `src/lib/execution-costs/venues/drift.ts`
- Create: `src/lib/execution-costs/venues/aster.ts`
- Create: `src/lib/execution-costs/venues/aevo.ts`

Each fetcher follows the same pattern: fetch orderbook → normalize to `OrderbookLevel[]` → return `RawBookData`.

**Step 1: Create Hyperliquid fetcher**

`src/lib/execution-costs/venues/hyperliquid.ts`:

```typescript
import { RawBookData, OrderbookLevel } from '../types';

export async function fetchHyperliquidBook(
  asset: string,
  fetchFn: typeof fetch,
): Promise<RawBookData | null> {
  try {
    const res = await fetchFn('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'l2Book', coin: asset }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const levels = data.levels;
    if (!levels || levels.length < 2) return null;

    // levels[0] = bids (sorted high→low), levels[1] = asks (sorted low→high)
    const bids: OrderbookLevel[] = levels[0].map((l: any) => ({
      price: parseFloat(l.px),
      size: parseFloat(l.sz),
    }));
    const asks: OrderbookLevel[] = levels[1].map((l: any) => ({
      price: parseFloat(l.px),
      size: parseFloat(l.sz),
    }));

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Hyperliquid', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch {
    return null;
  }
}
```

**Step 2: Create dYdX fetcher**

`src/lib/execution-costs/venues/dydx.ts`:

```typescript
import { RawBookData, OrderbookLevel } from '../types';

export async function fetchDydxBook(
  asset: string,
  fetchFn: typeof fetch,
): Promise<RawBookData | null> {
  try {
    const market = `${asset}-USD`;
    const res = await fetchFn(
      `https://indexer.dydx.trade/v4/orderbooks/perpetualMarket/${market}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    const bids: OrderbookLevel[] = data.bids.map((b: any) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }));
    const asks: OrderbookLevel[] = data.asks.map((a: any) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }));

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'dYdX', bids, asks, midPrice, symbol: market, method: 'clob' };
  } catch {
    return null;
  }
}
```

**Step 3: Create Drift fetcher**

`src/lib/execution-costs/venues/drift.ts`:

```typescript
import { RawBookData, OrderbookLevel } from '../types';

export async function fetchDriftBook(
  asset: string,
  fetchFn: typeof fetch,
): Promise<RawBookData | null> {
  try {
    const market = `${asset}-PERP`;
    const res = await fetchFn(
      `https://dlob.drift.trade/l2?marketName=${market}&depth=50&includeVamm=true&includeOracle=true`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    const bids: OrderbookLevel[] = data.bids.map((b: any) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }));
    const asks: OrderbookLevel[] = data.asks.map((a: any) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }));

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = data.oraclePrice ? parseFloat(data.oraclePrice) : (bestBid + bestAsk) / 2;

    return { exchange: 'Drift', bids, asks, midPrice, symbol: market, method: 'clob' };
  } catch {
    return null;
  }
}
```

**Step 4: Create Aster fetcher**

`src/lib/execution-costs/venues/aster.ts`:

```typescript
import { RawBookData, OrderbookLevel } from '../types';

export async function fetchAsterBook(
  asset: string,
  fetchFn: typeof fetch,
): Promise<RawBookData | null> {
  try {
    const symbol = `${asset}USDT`;
    const res = await fetchFn(
      `https://fapi.asterdex.com/fapi/v1/depth?symbol=${symbol}&limit=500`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    // Binance-style: [[price, qty], ...]
    const bids: OrderbookLevel[] = data.bids.map((b: [string, string]) => ({
      price: parseFloat(b[0]),
      size: parseFloat(b[1]),
    }));
    const asks: OrderbookLevel[] = data.asks.map((a: [string, string]) => ({
      price: parseFloat(a[0]),
      size: parseFloat(a[1]),
    }));

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Aster', bids, asks, midPrice, symbol, method: 'clob' };
  } catch {
    return null;
  }
}
```

**Step 5: Create Aevo fetcher**

`src/lib/execution-costs/venues/aevo.ts`:

```typescript
import { RawBookData, OrderbookLevel } from '../types';

export async function fetchAevoBook(
  asset: string,
  fetchFn: typeof fetch,
): Promise<RawBookData | null> {
  try {
    const res = await fetchFn(
      `https://api.aevo.xyz/orderbook?asset=${asset}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    // Aevo format: [[price, amount, iv], ...]
    const bids: OrderbookLevel[] = data.bids.map((b: any[]) => ({
      price: parseFloat(b[0]),
      size: parseFloat(b[1]),
    }));
    const asks: OrderbookLevel[] = data.asks.map((a: any[]) => ({
      price: parseFloat(a[0]),
      size: parseFloat(a[1]),
    }));

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Aevo', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch {
    return null;
  }
}
```

**Step 6: Commit**

```bash
git add src/lib/execution-costs/venues/
git commit -m "feat(execution-costs): add 5 CLOB venue fetchers (Hyperliquid, dYdX, Drift, Aster, Aevo)"
```

---

## Task 4: L3/Alternative Venue Fetchers (Lighter, Extended, edgeX)

**Files:**
- Create: `src/lib/execution-costs/venues/lighter.ts`
- Create: `src/lib/execution-costs/venues/extended.ts`
- Create: `src/lib/execution-costs/venues/edgex.ts`

**Step 1: Create Lighter fetcher (L3 → aggregate)**

`src/lib/execution-costs/venues/lighter.ts`:

```typescript
import { RawBookData, OrderbookLevel } from '../types';

export async function fetchLighterBook(
  asset: string,
  fetchFn: typeof fetch,
): Promise<RawBookData | null> {
  try {
    // First get market list to find market_id
    const marketsRes = await fetchFn(
      'https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails',
      { signal: AbortSignal.timeout(5000) },
    );
    if (!marketsRes.ok) return null;
    const markets = await marketsRes.json();

    // Find market matching asset (e.g. "BTC-USDT" or "BTC-USDC")
    const market = (markets.order_books || markets).find((m: any) => {
      const name = (m.ticker || m.name || '').toUpperCase();
      return name.startsWith(asset) && (name.includes('USD') || name.includes('USDT'));
    });
    if (!market) return null;

    const marketId = market.order_book_id ?? market.market_id;
    const decimals = market.price_decimals ?? 2;
    const sizeDecimals = market.size_decimals ?? 4;

    // Fetch L3 orders
    const ordersRes = await fetchFn(
      `https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders?market_id=${marketId}&limit=250`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!ordersRes.ok) return null;
    const ordersData = await ordersRes.json();

    // Separate buy/sell orders and aggregate to L2 levels
    const buyOrders = (ordersData.buy_orders || []).map((o: any) => ({
      price: parseFloat(o.price) / Math.pow(10, decimals),
      size: parseFloat(o.remaining_base_amount) / Math.pow(10, sizeDecimals),
    }));
    const sellOrders = (ordersData.sell_orders || []).map((o: any) => ({
      price: parseFloat(o.price) / Math.pow(10, decimals),
      size: parseFloat(o.remaining_base_amount) / Math.pow(10, sizeDecimals),
    }));

    // Aggregate L3 → L2: group by price, sum sizes
    const aggregateToL2 = (orders: OrderbookLevel[]): OrderbookLevel[] => {
      const map = new Map<number, number>();
      for (const o of orders) {
        map.set(o.price, (map.get(o.price) || 0) + o.size);
      }
      return Array.from(map.entries()).map(([price, size]) => ({ price, size }));
    };

    const bids = aggregateToL2(buyOrders).sort((a, b) => b.price - a.price);
    const asks = aggregateToL2(sellOrders).sort((a, b) => a.price - b.price);

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Lighter', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch {
    return null;
  }
}
```

**Step 2: Create Extended fetcher (REST fallback — try REST first, WS is complex for server-side)**

`src/lib/execution-costs/venues/extended.ts`:

```typescript
import { RawBookData } from '../types';

export async function fetchExtendedBook(
  asset: string,
  fetchFn: typeof fetch,
): Promise<RawBookData | null> {
  // Extended primarily uses WebSocket for orderbook.
  // For server-side, we try their REST market info endpoint.
  // If no depth data is available via REST, return null (v2: add WS snapshot).
  try {
    const res = await fetchFn(
      `https://api.starknet.extended.exchange/api/v1/info/markets`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Find the asset's market and check for any depth/price data
    const markets = Array.isArray(data) ? data : data.markets || [];
    const market = markets.find((m: any) => {
      const sym = (m.symbol || m.name || '').replace(/-.*/, '').toUpperCase();
      return sym === asset;
    });

    if (!market || !market.markPrice) return null;

    const midPrice = parseFloat(market.markPrice);

    // Extended doesn't provide depth via REST — return minimal data with fee-only cost
    return {
      exchange: 'Extended',
      bids: [],
      asks: [],
      midPrice,
      symbol: asset,
      method: 'clob',
    };
  } catch {
    return null;
  }
}
```

**Step 3: Create edgeX fetcher**

`src/lib/execution-costs/venues/edgex.ts`:

```typescript
import { RawBookData, OrderbookLevel } from '../types';

export async function fetchEdgexBook(
  asset: string,
  fetchFn: typeof fetch,
): Promise<RawBookData | null> {
  try {
    // edgeX uses contract IDs. Try to find the right contract.
    const metaRes = await fetchFn(
      'https://pro.edgex.exchange/api/v1/public/contract/list',
      { signal: AbortSignal.timeout(5000) },
    );
    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();

    const contracts = metaData.data || metaData;
    const contract = (Array.isArray(contracts) ? contracts : []).find((c: any) => {
      const sym = (c.contractName || c.symbol || '').replace(/USD.*/, '').toUpperCase();
      return sym === asset;
    });

    if (!contract) return null;
    const contractId = contract.contractId || contract.id;

    // Try REST depth endpoint
    const depthRes = await fetchFn(
      `https://pro.edgex.exchange/api/v1/public/quote/depth?contractId=${contractId}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!depthRes.ok) return null;
    const depthData = await depthRes.json();

    const rawBids = depthData.data?.bids || depthData.bids || [];
    const rawAsks = depthData.data?.asks || depthData.asks || [];

    const bids: OrderbookLevel[] = rawBids.map((b: any) => ({
      price: parseFloat(b.price || b[0]),
      size: parseFloat(b.qty || b.size || b[1]),
    }));
    const asks: OrderbookLevel[] = rawAsks.map((a: any) => ({
      price: parseFloat(a.price || a[0]),
      size: parseFloat(a.qty || a.size || a[1]),
    }));

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'edgeX', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch {
    return null;
  }
}
```

**Step 4: Commit**

```bash
git add src/lib/execution-costs/venues/lighter.ts src/lib/execution-costs/venues/extended.ts src/lib/execution-costs/venues/edgex.ts
git commit -m "feat(execution-costs): add Lighter L3, Extended, edgeX fetchers"
```

---

## Task 5: AMM Venue Fetchers (gTrade, GMX) + Variational

**Files:**
- Create: `src/lib/execution-costs/venues/gtrade.ts`
- Create: `src/lib/execution-costs/venues/gmx.ts`
- Create: `src/lib/execution-costs/venues/variational.ts`

**Step 1: Create gTrade formula fetcher**

`src/lib/execution-costs/venues/gtrade.ts`:

Uses the existing `/trading-variables` endpoint. The dynamic spread formula from gTrade docs:
`spread% = (existingOI + newSize/2) / depth1pct`

```typescript
import { RawBookData } from '../types';
import { Direction } from '../types';

interface GTradeParams {
  pairIndex: number;
  midPrice: number;
  depthAbove: number;  // 1% depth in USD (for longs)
  depthBelow: number;  // 1% depth in USD (for shorts)
  longOi: number;      // USD
  shortOi: number;     // USD
}

export async function fetchGTradeParams(
  asset: string,
  fetchFn: typeof fetch,
): Promise<GTradeParams | null> {
  try {
    const res = await fetchFn(
      'https://backend-arbitrum.gains.trade/trading-variables',
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();

    const pairs = data.pairs || [];
    // Find pair by matching "from" field (e.g. "BTC", "ETH")
    const pairIndex = pairs.findIndex((p: any) => {
      const from = (p.from || '').toUpperCase();
      return from === asset && (p.to || '').toUpperCase() === 'USD';
    });
    if (pairIndex === -1) return null;

    const pair = pairs[pairIndex];
    // Skip delisted pairs
    if (pair.groupIndex === undefined && pair.group === undefined) return null;

    const depths = data.pairDepths?.[pairIndex] || data.pairSkewDepths?.[pairIndex];
    if (!depths) return null;

    const ois = data.pairOis?.[pairIndex];
    const oiWindows = data.oiWindows?.[pairIndex];

    const depthAbove = parseFloat(depths.onePercentDepthAboveUsd || depths[0] || '0');
    const depthBelow = parseFloat(depths.onePercentDepthBelowUsd || depths[1] || '0');
    const longOi = parseFloat(ois?.longOiUsd || ois?.long || '0');
    const shortOi = parseFloat(ois?.shortOiUsd || ois?.short || '0');

    // Get mark price from pair info or prices array
    const prices = data.prices || [];
    const midPrice = parseFloat(prices[pairIndex] || pair.price || '0');

    return { pairIndex, midPrice, depthAbove, depthBelow, longOi, shortOi };
  } catch {
    return null;
  }
}

export function computeGTradeCost(
  params: GTradeParams,
  orderSizeUsd: number,
  direction: Direction,
): { priceImpact: number; executionPrice: number; midPrice: number } {
  const depth = direction === 'long' ? params.depthAbove : params.depthBelow;
  const currentOi = direction === 'long' ? params.longOi : params.shortOi;

  // gTrade formula: spread% = (existingOI + newSize/2) / depth1pct
  const priceImpact = depth > 0 ? (currentOi + orderSizeUsd / 2) / depth : 0;

  // Execution price adjusted by impact
  const sign = direction === 'long' ? 1 : -1;
  const executionPrice = params.midPrice * (1 + sign * priceImpact / 100);

  return { priceImpact, executionPrice, midPrice: params.midPrice };
}
```

**Step 2: Create GMX RPC fetcher**

`src/lib/execution-costs/venues/gmx.ts`:

For MVP, we use the existing `/markets/info` endpoint to get OI imbalance and estimate price impact. Full Reader contract call is complex and requires ABI encoding — defer to v2.

```typescript
import { RawBookData } from '../types';
import { Direction } from '../types';

interface GMXMarketInfo {
  marketToken: string;
  midPrice: number;
  longOiUsd: number;
  shortOiUsd: number;
  // Impact factors from on-chain config
  positionImpactFactorPositive: number;
  positionImpactFactorNegative: number;
  positionImpactExponentFactor: number;
}

export async function fetchGMXParams(
  asset: string,
  fetchFn: typeof fetch,
): Promise<GMXMarketInfo | null> {
  try {
    const res = await fetchFn(
      'https://arbitrum-api.gmxinfra.io/markets/info',
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Find market matching asset — symbol format: "BTC/USD [WBTC.b-USDC]"
    const markets = Object.values(data) as any[];
    const market = markets.find((m: any) => {
      const sym = (m.name || '').split('/')[0].replace(/\.v\d+$/i, '').toUpperCase();
      return sym === asset;
    });
    if (!market) return null;

    const parse30 = (v: string | undefined) => v ? Number(BigInt(v)) / 1e30 : 0;

    return {
      marketToken: market.marketToken || '',
      midPrice: parse30(market.indexTokenPrice?.max || market.indexTokenPrice?.min),
      longOiUsd: parse30(market.longOpenInterest || market.longOpenInterestInTokens),
      shortOiUsd: parse30(market.shortOpenInterest || market.shortOpenInterestInTokens),
      positionImpactFactorPositive: parse30(market.positionImpactFactorPositive),
      positionImpactFactorNegative: parse30(market.positionImpactFactorNegative),
      positionImpactExponentFactor: parse30(market.positionImpactExponentFactor),
    };
  } catch {
    return null;
  }
}

/**
 * Estimate GMX V2 price impact using the on-chain formula approximation:
 * impact = impactFactor * (|nextDiff|^exponent - |currentDiff|^exponent)
 * where diff = longOI - shortOI
 */
export function computeGMXCost(
  market: GMXMarketInfo,
  orderSizeUsd: number,
  direction: Direction,
): { priceImpact: number; executionPrice: number; midPrice: number } {
  const currentDiff = Math.abs(market.longOiUsd - market.shortOiUsd);
  const newLong = market.longOiUsd + (direction === 'long' ? orderSizeUsd : 0);
  const newShort = market.shortOiUsd + (direction === 'short' ? orderSizeUsd : 0);
  const nextDiff = Math.abs(newLong - newShort);

  // Determine if trade improves or worsens balance
  const improves = nextDiff < currentDiff;
  const factor = improves
    ? market.positionImpactFactorPositive
    : market.positionImpactFactorNegative;
  const exponent = market.positionImpactExponentFactor || 2;

  // price impact formula (simplified from GMX contracts)
  let impactUsd = 0;
  if (factor > 0) {
    impactUsd = factor * (Math.pow(nextDiff, exponent) - Math.pow(currentDiff, exponent));
  }

  const priceImpact = market.midPrice > 0 && orderSizeUsd > 0
    ? Math.abs(impactUsd) / orderSizeUsd * 100
    : 0;

  const sign = direction === 'long' ? 1 : -1;
  const executionPrice = market.midPrice * (1 + sign * priceImpact / 100);

  return { priceImpact, executionPrice, midPrice: market.midPrice };
}
```

**Step 3: Create Variational quote fetcher**

`src/lib/execution-costs/venues/variational.ts`:

```typescript
import { RawBookData, OrderbookLevel } from '../types';

export async function fetchVariationalQuotes(
  asset: string,
  fetchFn: typeof fetch,
): Promise<RawBookData | null> {
  try {
    const res = await fetchFn(
      'https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats',
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();

    const listings = data.listings || data;
    const listing = (Array.isArray(listings) ? listings : Object.values(listings)).find((l: any) => {
      const sym = (l.symbol || l.underlying || '').replace(/-.*/, '').toUpperCase();
      return sym === asset;
    });
    if (!listing) return null;

    const markPrice = parseFloat(listing.markPrice || listing.mark_price || '0');
    if (markPrice <= 0) return null;

    // Variational provides bid/ask at 3 size tiers: $1K, $100K, $1M
    // We create synthetic book levels from these quotes
    const tiers = [
      { size: 1000, bid: listing.bid1k || listing.bidPrice, ask: listing.ask1k || listing.askPrice },
      { size: 100000, bid: listing.bid100k, ask: listing.ask100k },
      { size: 1000000, bid: listing.bid1m, ask: listing.ask1m },
    ];

    const bids: OrderbookLevel[] = [];
    const asks: OrderbookLevel[] = [];

    for (const tier of tiers) {
      const bidPrice = parseFloat(tier.bid || '0');
      const askPrice = parseFloat(tier.ask || '0');
      if (bidPrice > 0) {
        bids.push({ price: bidPrice, size: tier.size / bidPrice });
      }
      if (askPrice > 0) {
        asks.push({ price: askPrice, size: tier.size / askPrice });
      }
    }

    return { exchange: 'Variational', bids, asks, midPrice: markPrice, symbol: asset, method: 'quote' };
  } catch {
    return null;
  }
}
```

**Step 4: Commit**

```bash
git add src/lib/execution-costs/venues/gtrade.ts src/lib/execution-costs/venues/gmx.ts src/lib/execution-costs/venues/variational.ts
git commit -m "feat(execution-costs): add gTrade formula, GMX estimation, Variational quote fetchers"
```

---

## Task 6: Venue Index & Cost Calculator

**Files:**
- Create: `src/lib/execution-costs/venues/index.ts`
- Create: `src/lib/execution-costs/calculator.ts`

**Step 1: Create venue index**

`src/lib/execution-costs/venues/index.ts`:

```typescript
export { fetchHyperliquidBook } from './hyperliquid';
export { fetchDydxBook } from './dydx';
export { fetchDriftBook } from './drift';
export { fetchAsterBook } from './aster';
export { fetchAevoBook } from './aevo';
export { fetchLighterBook } from './lighter';
export { fetchExtendedBook } from './extended';
export { fetchEdgexBook } from './edgex';
export { fetchGTradeParams, computeGTradeCost } from './gtrade';
export { fetchGMXParams, computeGMXCost } from './gmx';
export { fetchVariationalQuotes } from './variational';
```

**Step 2: Create calculator**

`src/lib/execution-costs/calculator.ts` — orchestrates all venue fetchers and computes final `VenueCost[]`:

```typescript
import { Direction, VenueCost, RawBookData } from './types';
import { walkBook, computeCostFromWalk, maxFillableUsd } from './book-walker';
import { EXCHANGE_FEES } from '@/lib/constants/exchanges';
import {
  fetchHyperliquidBook, fetchDydxBook, fetchDriftBook,
  fetchAsterBook, fetchAevoBook, fetchLighterBook,
  fetchExtendedBook, fetchEdgexBook, fetchVariationalQuotes,
  fetchGTradeParams, computeGTradeCost,
  fetchGMXParams, computeGMXCost,
} from './venues';

type FetchFn = typeof fetch;

function clobToVenueCost(
  book: RawBookData | null,
  orderSizeUsd: number,
  direction: Direction,
): VenueCost {
  if (!book) {
    return { exchange: '', available: false, fee: 0, spread: 0, priceImpact: 0, totalCost: 0, executionPrice: 0, midPrice: 0, maxFillableSize: 0, method: 'clob', error: 'Failed to fetch' };
  }

  const levels = direction === 'long' ? book.asks : book.bids;
  const fee = EXCHANGE_FEES[book.exchange]?.taker ?? 0;

  if (levels.length === 0) {
    // No depth data — fee-only
    return {
      exchange: book.exchange, available: true, fee, spread: 0, priceImpact: 0,
      totalCost: fee, executionPrice: book.midPrice, midPrice: book.midPrice,
      maxFillableSize: 0, depthLevels: 0, method: book.method,
    };
  }

  const result = walkBook(levels, orderSizeUsd, book.midPrice);
  const costs = computeCostFromWalk(result, book.midPrice);
  const maxFill = maxFillableUsd(levels);

  return {
    exchange: book.exchange,
    available: true,
    fee,
    spread: costs.spread,
    priceImpact: costs.priceImpact,
    totalCost: fee + costs.spread + costs.priceImpact,
    executionPrice: result.vwap,
    midPrice: book.midPrice,
    maxFillableSize: maxFill,
    depthLevels: result.levelsConsumed,
    method: book.method,
  };
}

export async function calculateAllVenueCosts(
  asset: string,
  orderSizeUsd: number,
  direction: Direction,
  fetchFn: FetchFn = fetch,
): Promise<VenueCost[]> {
  // Fetch all venues in parallel
  const [
    hlBook, dydxBook, driftBook, asterBook, aevoBook,
    lighterBook, extendedBook, edgexBook,
    gtradeParams, gmxParams,
    variationalBook,
  ] = await Promise.all([
    fetchHyperliquidBook(asset, fetchFn),
    fetchDydxBook(asset, fetchFn),
    fetchDriftBook(asset, fetchFn),
    fetchAsterBook(asset, fetchFn),
    fetchAevoBook(asset, fetchFn),
    fetchLighterBook(asset, fetchFn),
    fetchExtendedBook(asset, fetchFn),
    fetchEdgexBook(asset, fetchFn),
    fetchGTradeParams(asset, fetchFn),
    fetchGMXParams(asset, fetchFn),
    fetchVariationalQuotes(asset, fetchFn),
  ]);

  const results: VenueCost[] = [];

  // CLOB venues
  for (const book of [hlBook, dydxBook, driftBook, asterBook, aevoBook, lighterBook, extendedBook, edgexBook]) {
    const cost = clobToVenueCost(book, orderSizeUsd, direction);
    if (book) cost.exchange = book.exchange;
    if (cost.exchange) results.push(cost);
  }

  // gTrade (AMM formula)
  if (gtradeParams) {
    const fee = EXCHANGE_FEES['gTrade']?.taker ?? 0.05;
    const gtCost = computeGTradeCost(gtradeParams, orderSizeUsd, direction);
    results.push({
      exchange: 'gTrade',
      available: true,
      fee,
      spread: 0,
      priceImpact: gtCost.priceImpact,
      totalCost: fee + gtCost.priceImpact,
      executionPrice: gtCost.executionPrice,
      midPrice: gtCost.midPrice,
      maxFillableSize: Infinity, // AMM always fills
      method: 'amm_formula',
    });
  } else {
    results.push({ exchange: 'gTrade', available: false, fee: 0, spread: 0, priceImpact: 0, totalCost: 0, executionPrice: 0, midPrice: 0, maxFillableSize: 0, method: 'amm_formula', error: 'Pair not found' });
  }

  // GMX (AMM estimation)
  if (gmxParams && gmxParams.midPrice > 0) {
    const fee = EXCHANGE_FEES['GMX']?.taker ?? 0.07;
    const gmxCost = computeGMXCost(gmxParams, orderSizeUsd, direction);
    results.push({
      exchange: 'GMX',
      available: true,
      fee,
      spread: 0,
      priceImpact: gmxCost.priceImpact,
      totalCost: fee + gmxCost.priceImpact,
      executionPrice: gmxCost.executionPrice,
      midPrice: gmxCost.midPrice,
      maxFillableSize: Infinity,
      method: 'amm_rpc',
    });
  } else {
    results.push({ exchange: 'GMX', available: false, fee: 0, spread: 0, priceImpact: 0, totalCost: 0, executionPrice: 0, midPrice: 0, maxFillableSize: 0, method: 'amm_rpc', error: 'Market not found' });
  }

  // Variational (quote-based) — treated as CLOB walk over synthetic levels
  const varCost = clobToVenueCost(variationalBook, orderSizeUsd, direction);
  if (variationalBook) varCost.exchange = 'Variational';
  if (varCost.exchange) results.push(varCost);

  // Sort by total cost (cheapest first), unavailable venues at end
  results.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.totalCost - b.totalCost;
  });

  return results;
}
```

**Step 3: Commit**

```bash
git add src/lib/execution-costs/venues/index.ts src/lib/execution-costs/calculator.ts
git commit -m "feat(execution-costs): add cost calculator orchestrating all 11 venues"
```

---

## Task 7: API Route

**Files:**
- Create: `src/app/api/execution-costs/route.ts`

**Step 1: Create API route**

`src/app/api/execution-costs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { calculateAllVenueCosts } from '@/lib/execution-costs/calculator';
import { Direction, ExecutionCostResponse } from '@/lib/execution-costs/types';
import { DEFAULT_ASSETS } from '@/lib/execution-costs/symbol-map';

export const runtime = 'nodejs';
export const preferredRegion = 'dxb1';
export const dynamic = 'force-dynamic';

// L1 cache: raw venue results keyed by asset (direction-agnostic caching of params)
// We cache the full computed results per asset+direction+size for 10 seconds
interface CachedResult {
  data: ExecutionCostResponse;
  timestamp: number;
}
const resultCache = new Map<string, CachedResult>();
const CACHE_TTL = 10_000; // 10 seconds

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const asset = (searchParams.get('asset') || 'BTC').toUpperCase();
  const size = Math.max(1000, Math.min(10_000_000, Number(searchParams.get('size')) || 100_000));
  const direction = (searchParams.get('direction') || 'long') as Direction;

  if (!['long', 'short'].includes(direction)) {
    return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
  }

  // Check cache
  const cacheKey = `${asset}:${direction}:${size}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, {
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });
  }

  try {
    const venues = await calculateAllVenueCosts(asset, size, direction);

    const response: ExecutionCostResponse = {
      asset,
      size,
      direction,
      timestamp: Date.now(),
      venues,
    };

    // Update cache
    resultCache.set(cacheKey, { data: response, timestamp: Date.now() });

    // Prune old entries
    if (resultCache.size > 200) {
      const now = Date.now();
      for (const [key, val] of resultCache) {
        if (now - val.timestamp > CACHE_TTL * 6) resultCache.delete(key);
      }
    }

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Execution cost API error:', error);
    // Return stale cache if available
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: { 'X-Cache': 'STALE' },
      });
    }
    return NextResponse.json({ error: 'Failed to calculate execution costs' }, { status: 502 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/execution-costs/route.ts
git commit -m "feat(execution-costs): add API route with 10s cache"
```

---

## Task 8: Client-Side Aggregator Function

**Files:**
- Modify: `src/lib/api/aggregator.ts` — add `fetchExecutionCosts` function

**Step 1: Add fetcher to aggregator**

Add to the end of `src/lib/api/aggregator.ts`:

```typescript
export async function fetchExecutionCosts(
  asset: string = 'BTC',
  size: number = 100000,
  direction: 'long' | 'short' = 'long',
): Promise<ExecutionCostResponse> {
  const url = `/api/execution-costs?asset=${asset}&size=${size}&direction=${direction}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch execution costs');
  return response.json();
}
```

Also add the import for the type at the top of the file (from `@/lib/execution-costs/types`).

**Step 2: Commit**

```bash
git add src/lib/api/aggregator.ts
git commit -m "feat(execution-costs): add client-side fetcher to aggregator"
```

---

## Task 9: Page Components — Controls (AssetSelector, SizeSelector, DirectionToggle)

**Files:**
- Create: `src/app/execution-costs/components/AssetSelector.tsx`
- Create: `src/app/execution-costs/components/SizeSelector.tsx`
- Create: `src/app/execution-costs/components/DirectionToggle.tsx`

**Step 1: AssetSelector** — dropdown for picking the asset

```typescript
'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { DEFAULT_ASSETS } from '@/lib/execution-costs/symbol-map';

interface Props {
  value: string;
  onChange: (asset: string) => void;
}

export default function AssetSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = DEFAULT_ASSETS.filter(a =>
    a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors text-white font-mono text-sm"
      >
        <span className="font-semibold">{value}</span>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-48 max-h-64 overflow-auto rounded-lg bg-[#1a1a1a] border border-white/[0.08] shadow-xl">
          <div className="p-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.04]">
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-sm text-white outline-none w-full"
                autoFocus
              />
            </div>
          </div>
          {filtered.map(asset => (
            <button
              key={asset}
              onClick={() => { onChange(asset); setOpen(false); setSearch(''); }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/[0.06] transition-colors ${
                asset === value ? 'text-hub-yellow font-semibold' : 'text-neutral-300'
              }`}
            >
              {asset}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: SizeSelector** — preset buttons + custom input

```typescript
'use client';
import { useState } from 'react';

const PRESETS = [10_000, 50_000, 100_000, 500_000, 1_000_000];

interface Props {
  value: number;
  onChange: (size: number) => void;
}

export default function SizeSelector({ value, onChange }: Props) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const formatSize = (n: number) => {
    if (n >= 1_000_000) return `$${n / 1_000_000}M`;
    if (n >= 1_000) return `$${n / 1_000}K`;
    return `$${n}`;
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESETS.map(size => (
        <button
          key={size}
          onClick={() => { onChange(size); setShowCustom(false); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
            value === size && !showCustom
              ? 'bg-hub-yellow text-black'
              : 'bg-white/[0.05] text-neutral-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'
          }`}
        >
          {formatSize(size)}
        </button>
      ))}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={showCustom ? custom : ''}
          onFocus={() => setShowCustom(true)}
          onChange={e => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            setCustom(val);
            const num = parseInt(val);
            if (num >= 1000) onChange(num);
          }}
          placeholder="Custom $"
          className={`w-24 px-3 py-1.5 rounded-lg text-xs font-mono bg-white/[0.05] border text-white outline-none transition-colors ${
            showCustom ? 'border-hub-yellow/50' : 'border-white/[0.06]'
          }`}
        />
      </div>
    </div>
  );
}
```

**Step 3: DirectionToggle**

```typescript
'use client';

interface Props {
  value: 'long' | 'short';
  onChange: (dir: 'long' | 'short') => void;
}

export default function DirectionToggle({ value, onChange }: Props) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
      <button
        onClick={() => onChange('long')}
        className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
          value === 'long'
            ? 'bg-green-500/20 text-green-400'
            : 'bg-white/[0.03] text-neutral-500 hover:text-neutral-300'
        }`}
      >
        Long
      </button>
      <button
        onClick={() => onChange('short')}
        className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
          value === 'short'
            ? 'bg-red-500/20 text-red-400'
            : 'bg-white/[0.03] text-neutral-500 hover:text-neutral-300'
        }`}
      >
        Short
      </button>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/execution-costs/components/
git commit -m "feat(execution-costs): add AssetSelector, SizeSelector, DirectionToggle controls"
```

---

## Task 10: Page Components — VenueCard & CostBreakdownTable

**Files:**
- Create: `src/app/execution-costs/components/VenueCard.tsx`
- Create: `src/app/execution-costs/components/CostBreakdownTable.tsx`

**Step 1: VenueCard** — ranked card showing a venue's total cost breakdown

```typescript
'use client';
import { VenueCost } from '@/lib/execution-costs/types';
import { EXCHANGE_BADGE_COLORS, getExchangeTradeUrl } from '@/lib/constants/exchanges';
import { ExternalLink } from 'lucide-react';

interface Props {
  venue: VenueCost;
  rank: number;
  asset: string;
}

const medals = ['', '#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze

export default function VenueCard({ venue, rank, asset }: Props) {
  const tradeUrl = getExchangeTradeUrl(venue.exchange, asset);
  const badgeColor = EXCHANGE_BADGE_COLORS[venue.exchange] || 'bg-neutral-500/20 text-neutral-400';
  const medalColor = medals[rank] || '';

  if (!venue.available) {
    return (
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3 opacity-50">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{venue.exchange}</span>
        </div>
        <p className="text-neutral-600 text-xs">{venue.error || 'Unavailable'}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {rank <= 3 && (
            <span className="text-lg" style={{ color: medalColor }}>
              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{venue.exchange}</span>
          <span className="text-[10px] text-neutral-600 uppercase">{venue.method}</span>
        </div>
      </div>

      <div className="text-xl font-bold text-white font-mono mb-2">
        {venue.totalCost.toFixed(4)}%
      </div>

      <div className="space-y-0.5 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-neutral-500">Fee</span>
          <span className="text-neutral-300">{venue.fee.toFixed(4)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Spread</span>
          <span className="text-neutral-300">{venue.spread.toFixed(4)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Impact</span>
          <span className="text-neutral-300">{venue.priceImpact.toFixed(4)}%</span>
        </div>
        {venue.midPrice > 0 && (
          <div className="flex justify-between mt-1 pt-1 border-t border-white/[0.04]">
            <span className="text-neutral-500">Exec Price</span>
            <span className="text-neutral-300">${venue.executionPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      {tradeUrl && (
        <a
          href={tradeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-hub-yellow/10 text-hub-yellow text-xs font-medium hover:bg-hub-yellow/20 transition-colors"
        >
          Trade Now <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
```

**Step 2: CostBreakdownTable** — sortable table of all venues

```typescript
'use client';
import { useState } from 'react';
import { VenueCost } from '@/lib/execution-costs/types';
import { EXCHANGE_BADGE_COLORS, getExchangeTradeUrl } from '@/lib/constants/exchanges';
import { ArrowUpDown, ExternalLink } from 'lucide-react';

interface Props {
  venues: VenueCost[];
  asset: string;
}

type SortKey = 'exchange' | 'fee' | 'spread' | 'priceImpact' | 'totalCost' | 'maxFillableSize';

export default function CostBreakdownTable({ venues, asset }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('totalCost');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = [...venues].sort((a, b) => {
    // Unavailable venues always last
    if (a.available !== b.available) return a.available ? -1 : 1;
    const mul = sortAsc ? 1 : -1;
    if (sortKey === 'exchange') return mul * a.exchange.localeCompare(b.exchange);
    return mul * ((a[sortKey] as number) - (b[sortKey] as number));
  });

  const th = (label: string, key: SortKey) => (
    <th
      className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-neutral-300 select-none"
      onClick={() => handleSort(key)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </span>
    </th>
  );

  const fmt = (v: number) => v.toFixed(4) + '%';
  const fmtUsd = (v: number) => {
    if (v === Infinity) return '∞';
    if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K';
    return '$' + v.toFixed(0);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.02]">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-8">#</th>
            {th('Exchange', 'exchange')}
            {th('Fee', 'fee')}
            {th('Spread', 'spread')}
            {th('Impact', 'priceImpact')}
            {th('Total Cost', 'totalCost')}
            {th('Max Fill', 'maxFillableSize')}
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Method</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((v, i) => {
            const badgeColor = EXCHANGE_BADGE_COLORS[v.exchange] || 'bg-neutral-500/20 text-neutral-400';
            const tradeUrl = getExchangeTradeUrl(v.exchange, asset);
            return (
              <tr
                key={v.exchange}
                className={`border-t border-white/[0.04] ${!v.available ? 'opacity-40' : 'hover:bg-white/[0.02]'}`}
              >
                <td className="px-3 py-2 text-neutral-600 font-mono text-xs">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{v.exchange}</span>
                </td>
                <td className="px-3 py-2 text-neutral-300 font-mono text-xs">{v.available ? fmt(v.fee) : '—'}</td>
                <td className="px-3 py-2 text-neutral-300 font-mono text-xs">{v.available ? fmt(v.spread) : '—'}</td>
                <td className="px-3 py-2 text-neutral-300 font-mono text-xs">{v.available ? fmt(v.priceImpact) : '—'}</td>
                <td className="px-3 py-2 font-mono text-xs font-semibold text-white">{v.available ? fmt(v.totalCost) : '—'}</td>
                <td className="px-3 py-2 text-neutral-400 font-mono text-xs">{v.available ? fmtUsd(v.maxFillableSize) : '—'}</td>
                <td className="px-3 py-2 text-neutral-600 text-[10px] uppercase">{v.method}</td>
                <td className="px-3 py-2">
                  {tradeUrl && v.available && (
                    <a href={tradeUrl} target="_blank" rel="noopener noreferrer" className="text-hub-yellow/60 hover:text-hub-yellow">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/execution-costs/components/VenueCard.tsx src/app/execution-costs/components/CostBreakdownTable.tsx
git commit -m "feat(execution-costs): add VenueCard and CostBreakdownTable components"
```

---

## Task 11: Page Component — DepthChart

**Files:**
- Create: `src/app/execution-costs/components/DepthChart.tsx`

**Step 1: Create depth chart** — Recharts area chart showing cumulative depth per venue

```typescript
'use client';
import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { VenueCost } from '@/lib/execution-costs/types';

interface Props {
  venues: VenueCost[];
  orderSizeUsd: number;
}

// Generate chart-friendly depth data from venue costs
// For MVP: show max fillable size as a bar/comparison since we don't have
// per-level depth curves from the API response. Full depth curves would
// require passing raw book data to the client (v2).
export default function DepthChart({ venues, orderSizeUsd }: Props) {
  const available = venues.filter(v => v.available && v.maxFillableSize > 0 && v.maxFillableSize !== Infinity);

  if (available.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-neutral-600 text-sm">
        No depth data available for chart
      </div>
    );
  }

  // Colors for venues
  const COLORS = ['#FACC15', '#22D3EE', '#A78BFA', '#F87171', '#34D399', '#FB923C', '#818CF8', '#E879F9'];

  const chartData = available
    .sort((a, b) => b.maxFillableSize - a.maxFillableSize)
    .map((v, i) => ({
      exchange: v.exchange,
      depth: v.maxFillableSize,
      fill: COLORS[i % COLORS.length],
    }));

  const formatUsd = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v}`;
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Available Depth by Venue</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="exchange"
            tick={{ fill: '#737373', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          />
          <YAxis
            tickFormatter={formatUsd}
            tick={{ fill: '#737373', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: number) => [formatUsd(value), 'Depth']}
          />
          <ReferenceLine y={orderSizeUsd} stroke="#FACC15" strokeDasharray="5 5" label={{ value: `Order: ${formatUsd(orderSizeUsd)}`, fill: '#FACC15', fontSize: 10 }} />
          <Area
            type="monotone"
            dataKey="depth"
            stroke="#22D3EE"
            fill="rgba(34,211,238,0.1)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/execution-costs/components/DepthChart.tsx
git commit -m "feat(execution-costs): add DepthChart component"
```

---

## Task 12: Main Page

**Files:**
- Create: `src/app/execution-costs/page.tsx`

**Step 1: Create the main page**

Follow existing pattern from `/funding/page.tsx`: `'use client'`, import Header/Footer, `useApiData` hook, state management, responsive layout.

```typescript
'use client';

import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import { ExecutionCostResponse } from '@/lib/execution-costs/types';
import AssetSelector from './components/AssetSelector';
import SizeSelector from './components/SizeSelector';
import DirectionToggle from './components/DirectionToggle';
import VenueCard from './components/VenueCard';
import CostBreakdownTable from './components/CostBreakdownTable';
import DepthChart from './components/DepthChart';
import { RefreshCw, Loader2 } from 'lucide-react';

export default function ExecutionCostsPage() {
  const [asset, setAsset] = useState('BTC');
  const [size, setSize] = useState(100_000);
  const [direction, setDirection] = useState<'long' | 'short'>('long');

  const fetcher = useCallback(async () => {
    const res = await fetch(`/api/execution-costs?asset=${asset}&size=${size}&direction=${direction}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json() as Promise<ExecutionCostResponse>;
  }, [asset, size, direction]);

  const { data, error, isLoading, isRefreshing, lastUpdate, refresh } = useApiData({
    fetcher,
    refreshInterval: 15_000, // 15s auto-refresh
  });

  const venues = data?.venues || [];
  const available = venues.filter(v => v.available);
  const top3 = available.slice(0, 3);

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Execution <span className="text-gradient">Costs</span>
            </h1>
            <p className="text-neutral-600 text-sm mt-1">
              Compare real-time execution costs across {venues.length} DEX venues
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-neutral-600 text-xs">
                Updated {Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 text-neutral-400" />
              )}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <AssetSelector value={asset} onChange={setAsset} />
          <DirectionToggle value={direction} onChange={setDirection} />
          <SizeSelector value={size} onChange={setSize} />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-6 animate-pulse">
                <div className="h-4 bg-white/[0.06] rounded w-20 mb-3" />
                <div className="h-8 bg-white/[0.06] rounded w-24 mb-3" />
                <div className="space-y-2">
                  <div className="h-3 bg-white/[0.04] rounded" />
                  <div className="h-3 bg-white/[0.04] rounded" />
                  <div className="h-3 bg-white/[0.04] rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Top 3 venue cards */}
        {!isLoading && top3.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {top3.map((venue, i) => (
              <VenueCard key={venue.exchange} venue={venue} rank={i + 1} asset={asset} />
            ))}
          </div>
        )}

        {/* Full cost breakdown table */}
        {!isLoading && venues.length > 0 && (
          <div className="mb-6">
            <CostBreakdownTable venues={venues} asset={asset} />
          </div>
        )}

        {/* Depth chart */}
        {!isLoading && available.length > 0 && (
          <DepthChart venues={available} orderSizeUsd={size} />
        )}

        {/* No data */}
        {!isLoading && venues.length === 0 && !error && (
          <div className="text-center py-20 text-neutral-600">
            No execution cost data available for {asset}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/execution-costs/page.tsx
git commit -m "feat(execution-costs): add main page with controls, venue cards, table, depth chart"
```

---

## Task 13: Navigation Integration

**Files:**
- Modify: `src/components/Header.tsx` — add Execution Costs to nav

**Step 1: Add to navigation**

Find the nav items array in `Header.tsx` (look for existing items like 'Funding Rates', 'Open Interest'). Add a new entry:

```typescript
{ name: 'Execution Costs', href: '/execution-costs', icon: Zap },
```

Import `Zap` from `lucide-react` if not already imported.

Place it in the "Trading" category near "Open Interest" or in a logical position.

**Step 2: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(execution-costs): add page to navigation"
```

---

## Task 14: TypeScript Check & Fix

**Step 1: Run TypeScript compiler**

```bash
npx tsc --noEmit
```

**Step 2: Fix any type errors**

Common issues to watch for:
- Import paths (use `@/lib/execution-costs/...`)
- Missing type annotations on API response parsing (`as any` where needed)
- `BigInt` usage in GMX fetcher (ensure `target: "ES2020"` or higher in tsconfig)
- Unused imports

**Step 3: Commit fixes if any**

```bash
git add -A && git commit -m "fix(execution-costs): resolve TypeScript errors"
```

---

## Task 15: Manual Verification

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test API endpoint directly**

Open in browser or curl:
```
http://localhost:3000/api/execution-costs?asset=BTC&size=100000&direction=long
```

Verify:
- Returns JSON with `venues` array
- At least 3-4 venues return `available: true`
- Hyperliquid and dYdX should work reliably
- `totalCost` values are reasonable (0.01% to 1%)
- Failed venues show `available: false` with error

**Step 3: Test page**

Navigate to `http://localhost:3000/execution-costs`

Verify:
- Page loads with default BTC / $100K / Long
- Top 3 venue cards render with medal icons
- Cost breakdown table is sortable
- Clicking different assets loads new data
- Changing direction (Long/Short) refetches
- Changing size updates costs
- "Trade Now" links open correct exchange pages
- Depth chart renders
- Loading skeleton shows during fetch
- 15s auto-refresh works

**Step 4: Test edge cases**

- Try an obscure asset (e.g. ONDO) — fewer venues, some unavailable
- Try $1M size — slippage should be visibly higher than $10K
- Try Short direction — should show different costs than Long
- Check mobile responsiveness

**Step 5: Commit any fixes**

---

## Task 16: Push to Vercel

**Step 1: Final git status check**

```bash
git status
git log --oneline -10
```

**Step 2: Push**

```bash
git push origin main
```

Verify Vercel deployment succeeds. Check `/execution-costs` on production.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Types & book walker | 2 new files |
| 2 | Symbol mapping | 1 new file |
| 3 | CLOB fetchers (5 venues) | 5 new files |
| 4 | L3/WS fetchers (3 venues) | 3 new files |
| 5 | AMM + quote fetchers (3 venues) | 3 new files |
| 6 | Venue index + calculator | 2 new files |
| 7 | API route | 1 new file |
| 8 | Client aggregator | 1 modified file |
| 9 | Control components | 3 new files |
| 10 | VenueCard + table | 2 new files |
| 11 | Depth chart | 1 new file |
| 12 | Main page | 1 new file |
| 13 | Navigation | 1 modified file |
| 14 | TypeScript check | fixes as needed |
| 15 | Manual verification | no files |
| 16 | Push to Vercel | no files |

**Total: ~24 new files, 2 modified files, 16 tasks**
