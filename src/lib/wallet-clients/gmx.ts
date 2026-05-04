/**
 * GMX V2 (Arbitrum) wallet position fetcher.
 *
 * GMX doesn't expose a clean per-account REST endpoint. The public
 * /positions list returns ~1.8MB of every open position across every
 * account on the protocol. Strategy:
 *   1. Cache the full list for 60s at module level (one fetch per cron cycle
 *      benefits every user with a GMX wallet — saves 1.8MB × N users).
 *   2. Filter client-side by `account` (case-insensitive).
 *   3. Map marketAddress → symbol via existing getGMXMarkets() helper.
 *   4. Convert GMX 1e30-precision BigInt strings to JS numbers.
 *
 * This is Arbitrum-only — Avalanche GMX could be added later by mirroring
 * the same pattern against avalanche-api.gmxinfra.io.
 */
import type { NormalizedPosition, WalletClient } from './types';
import { getGMXMarkets, getGMXTickers } from '@/lib/gmx/markets';

const POSITIONS_URL = 'https://arbitrum-api.gmxinfra.io/positions';
const TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 60_000;

// GMX V2 fixed-point precision (1e30 for USD-denominated values)
const PREC_USD = 1e30;
const PREC_TOKENS = 1e18;

interface GmxRawPosition {
  key: string;
  account: string;            // checksum addr
  marketAddress: string;      // checksum addr
  collateralToken: string;
  isLong: boolean;
  sizeInUsd: string;          // 1e30 BigInt string
  sizeInTokens: string;       // 1e18 BigInt string for the index token
  totalFeesUsd: string;
  pnl: string;                // 1e30 BigInt string (signed)
}

interface GmxPositionsResponse {
  positions: GmxRawPosition[];
}

let cache: { rows: GmxRawPosition[]; ts: number } | null = null;
let inflight: Promise<GmxRawPosition[]> | null = null;

async function loadAllPositions(): Promise<GmxRawPosition[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.rows;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(POSITIONS_URL, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'InfoHub/1.0 (+https://info-hub.io)',
          'Accept': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`GMX positions HTTP ${res.status}`);
      const json = (await res.json()) as GmxPositionsResponse;
      const rows = Array.isArray(json.positions) ? json.positions : [];
      cache = { rows, ts: Date.now() };
      return rows;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Parse a GMX BigInt string (in the given precision) to a JS number. */
function bigToNumber(s: string, prec: number): number {
  if (!s) return 0;
  // Use BigInt for safe parsing of large strings, then convert to Number via division
  try {
    const bi = BigInt(s);
    // Divide as Number for fractional values; GMX numbers fit comfortably in f64 after scaling
    return Number(bi) / prec;
  } catch {
    return 0;
  }
}

export const gmxWalletClient: WalletClient = {
  chain: 'arbitrum',

  async fetchPositions(address: string): Promise<NormalizedPosition[]> {
    const lower = address.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(lower)) return [];

    const [all, markets, tickers] = await Promise.all([
      loadAllPositions(),
      getGMXMarkets('arbitrum'),
      getGMXTickers('arbitrum'),
    ]);

    const mine = all.filter(p => p.account?.toLowerCase() === lower);
    if (mine.length === 0) return [];

    const out: NormalizedPosition[] = [];
    for (const p of mine) {
      const sizeUsd = bigToNumber(p.sizeInUsd, PREC_USD);
      if (sizeUsd <= 0) continue;

      const market = markets.get(p.marketAddress.toLowerCase());
      if (!market) continue; // unknown / delisted market

      const sizeTokens = bigToNumber(p.sizeInTokens, PREC_TOKENS);
      // entryPrice = sizeUsd / sizeTokens  (USD per index token)
      const entryPrice = sizeTokens > 0 ? sizeUsd / sizeTokens : 0;

      // Try to get a live mark price from the tickers map
      const ticker = tickers.bySymbol.get(market.symbol);
      const markPrice = ticker?.priceUsd ?? null;
      const positionValue = markPrice && sizeTokens > 0 ? sizeTokens * markPrice : sizeUsd;

      // pnl is signed 1e30
      const pnl = bigToNumber(p.pnl, PREC_USD);

      out.push({
        symbol: market.symbol,
        side: p.isLong ? 'long' : 'short',
        size: sizeTokens,
        entryPrice,
        markPrice,
        positionValue,
        unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
        // GMX V2 doesn't surface leverage on the position object directly — it's
        // implicit (size / collateral). Skip rather than show a wrong number.
        leverage: null,
        marginUsed: null,
        liquidationPrice: null, // requires reader-contract call
        tpPrice: null,
        slPrice: null,
        // GMX V2 borrowing+funding fees are aggregated in totalFeesUsd; surface
        // as cumulative funding so the column is meaningful.
        cumulativeFunding: -bigToNumber(p.totalFeesUsd, PREC_USD), // negative = paid
      });
    }
    return out;
  },
};
