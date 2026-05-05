/**
 * GMX V2 wallet position fetcher — supports BOTH Arbitrum and Avalanche.
 *
 * GMX doesn't expose a clean per-account REST endpoint. The public
 * /positions list returns the full protocol-wide snapshot per chain
 * (~1.8MB on Arbitrum, ~400KB on Avalanche). Strategy:
 *   1. Cache the full list per-chain for 60s at module level (one fetch
 *      per cron cycle benefits every user with a GMX wallet).
 *   2. Filter client-side by `account` (case-insensitive).
 *   3. Map marketAddress → symbol via existing getGMXMarkets() helper.
 *   4. Convert GMX 1e30-precision BigInt strings to JS numbers.
 *
 * For users who have positions on both chains, we look up both and
 * concatenate. Symbols get a chain suffix only when there's an actual
 * collision so the UI stays clean for single-chain traders.
 */
import type { NormalizedPosition, WalletClient } from './types';
import { getGMXMarkets, getGMXTickers } from '@/lib/gmx/markets';

const CHAIN_ENDPOINTS = {
  arbitrum:  'https://arbitrum-api.gmxinfra.io/positions',
  avalanche: 'https://avalanche-api.gmxinfra.io/positions',
} as const;

type GmxChain = keyof typeof CHAIN_ENDPOINTS;

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

const cache: Record<GmxChain, { rows: GmxRawPosition[]; ts: number } | null> = {
  arbitrum: null,
  avalanche: null,
};
const inflight: Record<GmxChain, Promise<GmxRawPosition[]> | null> = {
  arbitrum: null,
  avalanche: null,
};

async function loadAllPositions(chain: GmxChain): Promise<GmxRawPosition[]> {
  const cached = cache[chain];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.rows;
  if (inflight[chain]) return inflight[chain]!;
  inflight[chain] = (async () => {
    try {
      const res = await fetch(CHAIN_ENDPOINTS[chain], {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'InfoHub/1.0 (+https://info-hub.io)',
          'Accept': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`GMX ${chain} positions HTTP ${res.status}`);
      const json = (await res.json()) as GmxPositionsResponse;
      const rows = Array.isArray(json.positions) ? json.positions : [];
      cache[chain] = { rows, ts: Date.now() };
      return rows;
    } finally {
      inflight[chain] = null;
    }
  })();
  return inflight[chain]!;
}

/** Parse a GMX BigInt string (in the given precision) to a JS number. */
function bigToNumber(s: string, prec: number): number {
  if (!s) return 0;
  try {
    const bi = BigInt(s);
    return Number(bi) / prec;
  } catch {
    return 0;
  }
}

/**
 * Build NormalizedPosition rows for a given chain. Returns [] if the wallet
 * has no positions on that chain or the upstream fetch fails (we swallow
 * fetch errors so one chain failing doesn't block the other).
 */
async function fetchForChain(address: string, chain: GmxChain): Promise<NormalizedPosition[]> {
  const lower = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(lower)) return [];

  let all: GmxRawPosition[] = [];
  try {
    [all] = await Promise.all([loadAllPositions(chain)]);
  } catch (e) {
    console.warn(`[gmx ${chain}] fetch failed: ${e instanceof Error ? e.message : e}`);
    return [];
  }

  const mine = all.filter(p => p.account?.toLowerCase() === lower);
  if (mine.length === 0) return [];

  let markets, tickers;
  try {
    [markets, tickers] = await Promise.all([
      getGMXMarkets(chain),
      getGMXTickers(chain),
    ]);
  } catch {
    return [];
  }

  const out: NormalizedPosition[] = [];
  for (const p of mine) {
    const sizeUsd = bigToNumber(p.sizeInUsd, PREC_USD);
    if (sizeUsd <= 0) continue;

    const market = markets.get(p.marketAddress.toLowerCase());
    if (!market) continue;

    const sizeTokens = bigToNumber(p.sizeInTokens, PREC_TOKENS);
    const entryPrice = sizeTokens > 0 ? sizeUsd / sizeTokens : 0;

    const ticker = tickers.bySymbol.get(market.symbol);
    const markPrice = ticker?.priceUsd ?? null;
    const positionValue = markPrice && sizeTokens > 0 ? sizeTokens * markPrice : sizeUsd;

    const pnl = bigToNumber(p.pnl, PREC_USD);

    out.push({
      symbol: market.symbol,
      side: p.isLong ? 'long' : 'short',
      size: sizeTokens,
      entryPrice,
      markPrice,
      positionValue,
      unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
      leverage: null,
      marginUsed: null,
      liquidationPrice: null,
      tpPrice: null,
      slPrice: null,
      cumulativeFunding: -bigToNumber(p.totalFeesUsd, PREC_USD),
    });
  }
  return out;
}

export const gmxWalletClient: WalletClient = {
  // Default chain label — actual fetcher tries BOTH Arbitrum AND Avalanche
  // and concatenates. The router exposes this client under `arbitrum` since
  // most users add their EVM wallet there; Avalanche is a transparent bonus.
  chain: 'arbitrum',

  async fetchPositions(address: string): Promise<NormalizedPosition[]> {
    const [arbPositions, avaxPositions] = await Promise.all([
      fetchForChain(address, 'arbitrum'),
      fetchForChain(address, 'avalanche'),
    ]);

    // Tag avalanche-only symbols with a suffix when they collide with
    // arbitrum symbols, so the table can disambiguate.
    if (avaxPositions.length > 0 && arbPositions.length > 0) {
      const arbSyms = new Set(arbPositions.map(p => p.symbol));
      avaxPositions.forEach(p => {
        if (arbSyms.has(p.symbol)) p.symbol = `${p.symbol} (Avax)`;
      });
    }

    return [...arbPositions, ...avaxPositions];
  },
};
