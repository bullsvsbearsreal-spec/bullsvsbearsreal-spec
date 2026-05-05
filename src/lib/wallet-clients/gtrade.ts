/**
 * gTrade (Gains Network) wallet position fetcher.
 *
 * gTrade trades synthetic perps on Arbitrum + Polygon backed by their gDAI
 * vault. Their public backend at backend-arbitrum.gains.trade exposes
 * /personal-trading-stats/<address> which returns open trades + lifetime
 * stats per wallet.
 *
 * No auth required. We fetch both Arbitrum and Polygon and concatenate.
 *
 * Endpoints (verified May 2026):
 *   GET https://backend-arbitrum.gains.trade/personal-trading-stats/<address>
 *   GET https://backend-polygon.gains.trade/personal-trading-stats/<address>
 */
import type { NormalizedPosition, WalletClient } from './types';

const ENDPOINTS = {
  arbitrum: 'https://backend-arbitrum.gains.trade/personal-trading-stats',
  polygon:  'https://backend-polygon.gains.trade/personal-trading-stats',
} as const;

type GTradeChain = keyof typeof ENDPOINTS;

const TIMEOUT_MS = 12_000;

interface GTradeOpenTrade {
  /** Pair index — maps to pair config (BTC=0, ETH=1, etc.). gTrade keeps
   *  this list at https://backend-arbitrum.gains.trade/pairs but shipping
   *  with a curated symbol map keeps us robust to their list reordering. */
  pairIndex: number;
  /** "long" or "short" buy/sell flag — varies by API revision. */
  buy?: boolean;
  long?: boolean;
  /** Open price in PRECISION_10 (10 decimals). */
  openPrice: string | number;
  /** Position size in collateral units (e.g. DAI on Arbitrum). 1e18 BigInt string. */
  positionSizeDai?: string;
  positionSize?: string;
  /** Leverage as integer (e.g. 50). */
  leverage: string | number;
  /** Take-profit / stop-loss prices in PRECISION_10. 0 means unset. */
  tp?: string | number;
  sl?: string | number;
  /** SUM of borrowing/funding fees accrued since open (collateral units, 1e18). */
  initialPosToken?: string;
  /** Whether trade is still open. */
  status?: number; // 0 = open
}

interface GTradeStatsResponse {
  /** Some endpoints nest under data, others top-level. We accept both. */
  data?: { openTrades?: GTradeOpenTrade[] };
  openTrades?: GTradeOpenTrade[];
  trades?: GTradeOpenTrade[];
}

// Hand-curated subset of the most-traded gTrade pairs. The full list has 200+
// entries and changes occasionally; we only need the index→symbol mapping for
// the pairs people actually trade. Unknown pair indices fall back to "PAIR-N".
const PAIR_INDEX_TO_SYMBOL: Record<number, string> = {
  0: 'BTC', 1: 'ETH', 2: 'LINK', 3: 'DOGE', 4: 'MATIC', 5: 'ADA',
  6: 'SUSHI', 7: 'AAVE', 8: 'ALGO', 9: 'BAT', 10: 'COMP',
  11: 'DOT', 12: 'EOS', 13: 'LTC', 14: 'MANA', 15: 'OMG',
  16: 'SNX', 17: 'UNI', 18: 'XLM', 19: 'XRP', 20: 'ZEC',
  21: 'ATOM', 22: 'AXS', 23: 'CHZ', 24: 'CRV', 25: 'DASH',
  26: 'ENJ', 27: 'FTM', 28: 'GRT', 29: 'ICP', 30: 'KAVA',
  31: 'KSM', 32: 'NEAR', 33: 'QTUM', 34: 'SOL', 35: 'TRX',
  36: 'VET', 37: 'WAVES', 38: 'XLM', 39: 'XMR', 40: 'XTZ',
  41: 'YFI', 42: 'BCH', 43: 'BNB', 44: 'AVAX', 45: 'TRB',
  100: 'TIA', 101: 'TON', 102: 'WLD', 103: 'PYTH', 104: 'JTO',
  105: 'JUP', 106: 'SEI', 107: 'INJ', 108: 'ORDI', 109: 'BLUR',
  110: 'ARB', 111: 'OP', 112: 'PEPE', 113: 'SHIB', 114: 'WIF',
};

function pairToSymbol(pairIndex: number): string {
  return PAIR_INDEX_TO_SYMBOL[pairIndex] ?? `PAIR-${pairIndex}`;
}

/** gTrade uses 1e10 fixed-point for prices and 1e18 for collateral. */
const PREC_PRICE = 1e10;
const PREC_COLLATERAL = 1e18;

function bigStrToNumber(s: string | number | undefined, prec: number): number {
  if (s == null) return 0;
  if (typeof s === 'number') return s / prec;
  try {
    return Number(BigInt(s)) / prec;
  } catch {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n / prec : 0;
  }
}

async function fetchChain(address: string, chain: GTradeChain): Promise<NormalizedPosition[]> {
  try {
    const res = await fetch(`${ENDPOINTS[chain]}/${address}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'InfoHub/1.0 (+https://info-hub.io)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as GTradeStatsResponse;
    const trades = json.openTrades ?? json.data?.openTrades ?? json.trades ?? [];
    if (!Array.isArray(trades)) return [];

    const out: NormalizedPosition[] = [];
    for (const t of trades) {
      // Skip closed trades
      if (typeof t.status === 'number' && t.status !== 0) continue;
      const isLong = t.buy ?? t.long ?? false;
      const symbol = pairToSymbol(Number(t.pairIndex));
      const entryPrice = bigStrToNumber(t.openPrice, PREC_PRICE);
      const lev = typeof t.leverage === 'number' ? t.leverage : parseFloat(String(t.leverage)) || 1;
      const collateral = bigStrToNumber(t.positionSizeDai ?? t.positionSize ?? '0', PREC_COLLATERAL);
      const positionValue = collateral * lev;
      const sizeTokens = entryPrice > 0 ? positionValue / entryPrice : 0;

      const tp = bigStrToNumber(t.tp, PREC_PRICE);
      const sl = bigStrToNumber(t.sl, PREC_PRICE);

      out.push({
        symbol: chain === 'polygon' ? `${symbol} (Poly)` : symbol,
        side: isLong ? 'long' : 'short',
        size: sizeTokens,
        entryPrice,
        markPrice: null, // gTrade uses Chainlink oracle; surface via a separate price stream if we need it
        positionValue,
        unrealizedPnl: null, // not in this endpoint shape
        leverage: lev > 0 ? lev : null,
        marginUsed: collateral > 0 ? collateral : null,
        liquidationPrice: null, // computed contract-side, would need RPC call
        tpPrice: tp > 0 ? tp : null,
        slPrice: sl > 0 ? sl : null,
        cumulativeFunding: null, // gTrade aggregates fees in collateral; not exposed on open-trade endpoint
      });
    }
    return out;
  } catch (e) {
    console.warn(`[gtrade ${chain}] fetch failed: ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

export const gtradeWalletClient: WalletClient = {
  chain: 'arbitrum',
  async fetchPositions(address: string): Promise<NormalizedPosition[]> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];
    const [arb, poly] = await Promise.all([
      fetchChain(address, 'arbitrum'),
      fetchChain(address, 'polygon'),
    ]);
    return [...arb, ...poly];
  },
};
