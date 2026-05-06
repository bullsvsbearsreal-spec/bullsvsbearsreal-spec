/**
 * GMX V2 wallet position fetcher — supports BOTH Arbitrum and Avalanche.
 *
 * Data source: GMX synthetics subsquid GraphQL.
 *   https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql
 *   https://gmx.squids.live/gmx-synthetics-avalanche:prod/api/graphql
 *
 * The public REST `/positions` endpoint only returns
 *   { account, marketAddress, collateralToken, isLong,
 *     sizeInUsd, sizeInTokens, totalFeesUsd, pnl }
 * which is missing collateralAmount, leverage, fees, etc. — so the
 * earlier version of this client could never populate the leverage,
 * marginUsed, or unrealizedFees columns. The subsquid GraphQL exposes
 * the full Position struct including a pre-computed `leverage` field.
 *
 * We hit GraphQL per-account (cheap — just the user's open rows) instead
 * of caching the full per-chain dump. Two parallel queries (Arb + Avax)
 * give a single user's full GMX exposure. Symbols get a chain suffix
 * only when there's an actual collision so the UI stays clean for
 * single-chain traders.
 */
import type { NormalizedPosition, WalletClient } from './types';
import { getGMXMarkets, getGMXTickers } from '@/lib/gmx/markets';

const SUBSQUID_ENDPOINTS = {
  arbitrum:  'https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql',
  avalanche: 'https://gmx.squids.live/gmx-synthetics-avalanche:prod/api/graphql',
} as const;

type GmxChain = keyof typeof SUBSQUID_ENDPOINTS;

const TIMEOUT_MS = 15_000;

// GMX V2 fixed-point precision (1e30 for USD-denominated values)
const PREC_USD = 1e30;
// `leverage` field on the subsquid is leverage × 10000 (so 1.0x = 10000).
const PREC_LEVERAGE = 10_000;
// Default index-token precision when we can't resolve it from tickers.
const PREC_TOKENS_DEFAULT = 1e18;
// Dust threshold — positions smaller than this in USD are residual state
// from positions that closed/got liquidated and should be filtered out.
const DUST_USD_MIN = 1;

interface SubsquidPosition {
  id: string;
  account: string;            // checksum addr
  market: string;             // checksum market address
  collateralToken: string;    // checksum collateral token addr
  isLong: boolean;
  sizeInUsd: string;          // 1e30 BigInt string
  sizeInTokens: string;       // index-token-precision BigInt string
  collateralAmount: string;   // collateral-token-precision BigInt string
  entryPrice: string;
  leverage: string;           // BigInt × 1e4 (so "37757" = 3.7757x)
  unrealizedPnl: string;      // 1e30 BigInt string (signed)
  unrealizedFees: string;     // 1e30 BigInt string
}

interface SubsquidQueryResponse {
  data?: { positions?: SubsquidPosition[] };
  errors?: Array<{ message: string }>;
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

async function querySubsquid(chain: GmxChain, address: string): Promise<SubsquidPosition[]> {
  const query = `
    query AccountPositions($account: String!) {
      positions(
        where: { account_eq: $account, isSnapshot_eq: false, sizeInUsd_gt: "0" }
        limit: 200
      ) {
        id
        account
        market
        collateralToken
        isLong
        sizeInUsd
        sizeInTokens
        collateralAmount
        entryPrice
        leverage
        unrealizedPnl
        unrealizedFees
      }
    }
  `.trim();

  const res = await fetch(SUBSQUID_ENDPOINTS[chain], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'InfoHub/2.0 (info-hub.io)',
    },
    body: JSON.stringify({ query, variables: { account: address } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GMX ${chain} subsquid HTTP ${res.status}`);
  const json = (await res.json()) as SubsquidQueryResponse;
  if (json.errors?.length) {
    throw new Error(`GMX ${chain} subsquid: ${json.errors.map(e => e.message).join('; ')}`);
  }
  return json.data?.positions ?? [];
}

/**
 * Build NormalizedPosition rows for a given chain. Returns [] if the wallet
 * has no positions on that chain or the upstream fetch fails (we swallow
 * fetch errors so one chain failing doesn't block the other).
 */
async function fetchForChain(address: string, chain: GmxChain): Promise<NormalizedPosition[]> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return [];

  // Subsquid is case-sensitive on `account_eq` — query both the lowercased
  // form and the user-supplied form so we don't depend on whether the
  // caller normalized to checksum or not.
  let positions: SubsquidPosition[];
  try {
    const [a, b] = await Promise.all([
      querySubsquid(chain, address),
      address === address.toLowerCase()
        ? Promise.resolve([] as SubsquidPosition[])
        : querySubsquid(chain, address.toLowerCase()),
    ]);
    // Dedupe by position id when both queries returned data.
    const byId = new Map<string, SubsquidPosition>();
    for (const p of [...a, ...b]) byId.set(p.id, p);
    positions = Array.from(byId.values());
  } catch (e) {
    console.warn(`[gmx ${chain}] subsquid query failed:`, e instanceof Error ? e.message : e);
    return [];
  }

  if (positions.length === 0) return [];

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
  for (const p of positions) {
    const sizeUsd = bigToNumber(p.sizeInUsd, PREC_USD);
    if (sizeUsd < DUST_USD_MIN) continue;

    const market = markets.get(p.market.toLowerCase());
    if (!market) continue;

    // Resolve index-token decimals from the ticker table (BTC=8, SOL=9,
    // etc.). Without this, sizeInTokens for non-18-decimal tokens divides
    // by the wrong precision and renders as ~0 even for multi-million
    // dollar positions.
    const indexTicker = market.indexToken
      ? tickers.byAddress.get(market.indexToken)
      : tickers.bySymbol.get(market.symbol);
    const tokenPrec = indexTicker?.decimals
      ? Math.pow(10, indexTicker.decimals)
      : PREC_TOKENS_DEFAULT;

    const sizeTokens = bigToNumber(p.sizeInTokens, tokenPrec);
    const entryPrice = sizeTokens > 0 ? sizeUsd / sizeTokens : 0;

    const markPrice = indexTicker?.priceUsd ?? null;
    const positionValue = markPrice && sizeTokens > 0 ? sizeTokens * markPrice : sizeUsd;

    // Collateral → marginUsed in USD. Look up collateral token decimals
    // + price the same way as the index token. Collateral is usually
    // USDC (6 decimals) but a long can use the index asset itself.
    const colTicker = tickers.byAddress.get(p.collateralToken.toLowerCase());
    const colPrec = colTicker?.decimals ? Math.pow(10, colTicker.decimals) : 1e6;
    const collateralAmount = bigToNumber(p.collateralAmount, colPrec);
    const colPrice = colTicker?.priceUsd ?? 1; // USDC ≈ $1 fallback
    const marginUsed = collateralAmount * colPrice;

    const leverage = bigToNumber(p.leverage, PREC_LEVERAGE);
    const pnl = bigToNumber(p.unrealizedPnl, PREC_USD);
    const fees = bigToNumber(p.unrealizedFees, PREC_USD);

    // Liquidation price approximation. The exact GMX V2 formula reads
    // per-market maintenance-margin factor + pending borrow / funding fees
    // off the on-chain DataStore — we don't have those without an RPC
    // call. The standard textbook formula gets us within a few percent:
    //
    //   long  : liq = entry × (1 − (collateralUsd − pendingFees) / sizeUsd × (1 − mmf))
    //   short : liq = entry × (1 + (collateralUsd − pendingFees) / sizeUsd × (1 − mmf))
    //
    // We use mmf = 0.5% (typical for major GMX markets — synthetics like
    // PENGU run higher but this is a "ballpark" not a precise warning
    // level). Mark the value as approximate by clamping to the visible
    // range; downstream UI can label it "≈" when it knows it came from
    // GMX. Pending fees are the `unrealizedFees` we already parsed.
    const collateralUsd = marginUsed;
    const pendingFees = fees;            // already in USD
    const buffer = collateralUsd - pendingFees;
    const MMF = 0.005;                   // 0.5% maintenance margin assumption
    let liqPrice: number | null = null;
    if (entryPrice > 0 && sizeUsd > 0 && buffer > 0) {
      const ratio = (buffer / sizeUsd) * (1 - MMF);
      liqPrice = p.isLong
        ? entryPrice * Math.max(0, 1 - ratio)
        : entryPrice * (1 + ratio);
      if (!Number.isFinite(liqPrice) || liqPrice <= 0) liqPrice = null;
    }

    out.push({
      symbol: market.symbol,
      side: p.isLong ? 'long' : 'short',
      size: sizeTokens,
      entryPrice,
      markPrice,
      positionValue,
      unrealizedPnl: Number.isFinite(pnl) ? pnl : null,
      leverage: Number.isFinite(leverage) && leverage > 0 ? leverage : null,
      marginUsed: Number.isFinite(marginUsed) && marginUsed > 0 ? marginUsed : null,
      liquidationPrice: liqPrice,  // Approximation (mmf=0.5%); within a
                                   // few % of the on-chain value for major
                                   // markets, looser for synthetics.
      tpPrice: null,               // GMX TP/SL are separate orders, not on Position
      slPrice: null,
      // Cumulative funding paid over position life — subsquid `unrealizedFees`
      // is the closest proxy (open funding + borrowing fees). Negate to
      // align with our convention (positive = received by user).
      cumulativeFunding: Number.isFinite(fees) ? -fees : null,
    });
  }
  return out;
}

export const gmxWalletClient: WalletClient = {
  // Default chain label — actual fetcher tries BOTH Arbitrum AND Avalanche
  // and concatenates. The router exposes this client under `arbitrum` since
  // most users add their EVM wallet there; Avalanche is a transparent bonus.
  chain: 'arbitrum',
  displayName: 'GMX',

  async fetchPositions(address: string): Promise<NormalizedPosition[]> {
    const [arbPositions, avaxPositions] = await Promise.all([
      fetchForChain(address, 'arbitrum'),
      fetchForChain(address, 'avalanche'),
    ]);

    // Tag avalanche-only symbols with a suffix when they collide with
    // arbitrum symbols, so the table can disambiguate. The funding-snapshots
    // join in /api/account/positions strips this suffix back to the
    // canonical ticker so the rate columns still populate.
    if (avaxPositions.length > 0 && arbPositions.length > 0) {
      const arbSyms = new Set(arbPositions.map(p => p.symbol));
      avaxPositions.forEach(p => {
        if (arbSyms.has(p.symbol)) p.symbol = `${p.symbol} (Avax)`;
      });
    }

    return [...arbPositions, ...avaxPositions];
  },
};
