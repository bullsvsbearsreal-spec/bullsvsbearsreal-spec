/**
 * Lighter (lighter.xyz) wallet position fetcher.
 *
 * Lighter is a zk-rollup perp DEX. They expose a clean public REST API
 * at mainnet.zklighter.elliot.ai that maps an L1 (Ethereum) address →
 * Lighter account index → open positions per market.
 *
 * No auth required for read endpoints. Verified May 2026.
 *
 * Endpoints used:
 *   GET /api/v1/account?l1_address=<addr>
 *      → returns { accounts: [{ index, ... }] }
 *   GET /api/v1/account_positions?account_index=<n>
 *      → returns open positions per market_id
 *   GET /api/v1/order_books
 *      → maps market_id → symbol (cached at module level)
 */
import type { NormalizedPosition, WalletClient } from './types';

const BASE_URL = 'https://mainnet.zklighter.elliot.ai/api/v1';
const TIMEOUT_MS = 10_000;

interface LighterAccountResp {
  accounts?: Array<{ index: number; status?: number }>;
}

interface LighterPositionsResp {
  positions?: Array<{
    market_id: number;
    open_size: string;       // signed; positive = long, negative = short. Decimals vary per market.
    avg_entry_price: string; // decimal price
    /** Some endpoints expose unrealizedPnl; prefer it when present. */
    unrealized_pnl?: string;
    funding?: string;        // cumulative funding paid (signed; positive = received)
  }>;
}

interface LighterOrderBooksResp {
  order_books?: Array<{ market_id: number; symbol: string; size_decimals: number; price_decimals: number }>;
}

interface LighterMarketMeta {
  symbol: string;
  sizeDecimals: number;
  priceDecimals: number;
}

let marketsCache: { byId: Map<number, LighterMarketMeta>; ts: number } | null = null;
const MARKETS_TTL_MS = 5 * 60_000;

async function loadMarkets(): Promise<Map<number, LighterMarketMeta>> {
  if (marketsCache && Date.now() - marketsCache.ts < MARKETS_TTL_MS) {
    return marketsCache.byId;
  }
  try {
    const res = await fetch(`${BASE_URL}/order_books`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return new Map();
    const json = (await res.json()) as LighterOrderBooksResp;
    const map = new Map<number, LighterMarketMeta>();
    for (const ob of (json.order_books ?? [])) {
      if (!ob.symbol) continue;
      map.set(ob.market_id, {
        symbol: ob.symbol,
        sizeDecimals: ob.size_decimals ?? 0,
        priceDecimals: ob.price_decimals ?? 0,
      });
    }
    marketsCache = { byId: map, ts: Date.now() };
    return map;
  } catch {
    return marketsCache?.byId ?? new Map();
  }
}

async function fetchAccountIndex(l1Address: string): Promise<number | null> {
  try {
    // Lighter's /account endpoint takes `by` (filter type) + `value` (filter
    // value). For wallet lookups we use by=l1_address. A 404-shaped response
    // means "account not registered" — totally fine, return null.
    const url = `${BASE_URL}/account?by=l1_address&value=${encodeURIComponent(l1Address)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as LighterAccountResp & { code?: number };
    // Lighter wraps errors in 200 OK with `code` !== 200. Code 21100 = account not found.
    if (json.code != null && json.code !== 200) return null;
    const first = (json.accounts ?? [])[0];
    return first?.index ?? null;
  } catch {
    return null;
  }
}

export const lighterWalletClient: WalletClient = {
  chain: 'ethereum',  // Lighter resolves L1 addresses; users register on Ethereum mainnet
  async fetchPositions(address: string): Promise<NormalizedPosition[]> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];

    const accountIndex = await fetchAccountIndex(address);
    if (accountIndex == null) return [];

    let posResp: LighterPositionsResp;
    try {
      const res = await fetch(
        `${BASE_URL}/account_positions?account_index=${accountIndex}`,
        { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'Accept': 'application/json' } },
      );
      if (!res.ok) return [];
      posResp = (await res.json()) as LighterPositionsResp;
    } catch (e) {
      console.warn(`[lighter] fetch positions failed: ${e instanceof Error ? e.message : e}`);
      return [];
    }

    const positions = posResp.positions ?? [];
    if (positions.length === 0) return [];

    const markets = await loadMarkets();
    const out: NormalizedPosition[] = [];

    for (const p of positions) {
      const meta = markets.get(p.market_id);
      const symbol = meta?.symbol ?? `MKT-${p.market_id}`;
      const sizeRaw = parseFloat(p.open_size);
      if (!Number.isFinite(sizeRaw) || sizeRaw === 0) continue;

      const sizeAbs = Math.abs(sizeRaw);
      const side: 'long' | 'short' = sizeRaw > 0 ? 'long' : 'short';
      const entryPrice = parseFloat(p.avg_entry_price);
      const positionValue = Number.isFinite(entryPrice) && entryPrice > 0 ? sizeAbs * entryPrice : 0;
      const unrealizedPnl = p.unrealized_pnl != null ? parseFloat(p.unrealized_pnl) : null;
      const cumulativeFunding = p.funding != null ? parseFloat(p.funding) : null;

      out.push({
        symbol,
        side,
        size: sizeAbs,
        entryPrice: Number.isFinite(entryPrice) ? entryPrice : 0,
        markPrice: null,
        positionValue: positionValue > 0 ? positionValue : null,
        unrealizedPnl: Number.isFinite(unrealizedPnl) ? unrealizedPnl : null,
        leverage: null,
        marginUsed: null,
        liquidationPrice: null,
        tpPrice: null,
        slPrice: null,
        cumulativeFunding: Number.isFinite(cumulativeFunding) ? cumulativeFunding : null,
      });
    }
    return out;
  },
};
