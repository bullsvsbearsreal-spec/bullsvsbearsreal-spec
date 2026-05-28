/**
 * Shared edgeX upstream fetcher. Three of our routes pull from the
 * same two edgeX endpoints (meta + per-contract getTicker): funding,
 * tickers, openinterest. Each used to inline its own copy of the
 * same fetch loop, all using 3-batch × 10-call sequential pattern
 * with 8-10s per-call timeouts.
 *
 * That math didn't fit under the global `FETCHER_TIMEOUT_MS = 12000`:
 *   meta 10s + 3 batches × 10s per-batch = up to ~40s worst case
 * → any slow batch triggered the outer race kill and lost ALL rows.
 *
 * Production symptom (verified 2026-05-28): /api/funding showed 30
 * edgeX rows (the limit) about a third of the time, while /api/tickers
 * and /api/openinterest showed 0 rows almost always. Same upstream,
 * same UA, same network egress — the only thing different was timing
 * luck on which batched call hung first.
 *
 * Fix: single fan-out of all 30 contracts in parallel (edgeX handles
 * 30 concurrent /getTicker fine — verified by 30-burst probe returning
 * 30×200 in under 1 s), shorter per-call timeouts, return whatever
 * comes back. With meta 5s + parallel-getTicker 4s, worst case is 9s
 * — fits comfortably under the 12s outer cap.
 */

import { fetchWithTimeout } from './fetch';

const EDGEX_HEADERS = {
  headers: {
    // CF WAF blocks both browser-like and empty UAs on edgeX. The
    // "honest data-aggregator" UA passes CF's "good bot" policy
    // (programmatic clients that identify themselves with a contact
    // URL get whitelisted). Don't change to Mozilla/* — last time we
    // tried that the WAF 403'd every request.
    'User-Agent': 'InfoHub/1.0 (+https://info-hub.io; data-aggregator)',
    'Accept': 'application/json',
  },
};

/** Tighter than the historical 10s/8s. EdgeX getTicker p99 from
 *  FRA1 → pro.edgex.exchange is ~250 ms when alive. 4s catches the
 *  long tail of CF cold-paths without blowing the FETCHER_TIMEOUT_MS
 *  budget. Meta is one call so it gets a bit more slack. */
const META_TIMEOUT_MS = 5000;
const TICKER_TIMEOUT_MS = 4000;

/** CF rate-limits at ~50 requests/sec/IP from sustained sources.
 *  30 concurrent /getTicker calls in a 1-second window is well under.
 *  Each call is small (~500 bytes). The original 3×10 sequential
 *  batches were leftover defensive code from a 186-call (all venues)
 *  attempt that did get IP-blocked — irrelevant at 30. */
const CONTRACT_LIMIT = 30;

export interface EdgeXContract {
  contractId: string;
  contractName: string;
  /** True when this contract is a real-money tradable perp. */
  enableTrade: boolean;
  /** True when this is a stock perp (skip for crypto-only callers). */
  isStock?: boolean;
}

export interface EdgeXTicker {
  /** Original contract (so callers can read contractName, isStock, etc.) */
  contract: EdgeXContract;
  /** Parsed ticker payload — string-typed at the wire level, parse
   *  selectively in the caller (different routes care about different
   *  fields). Null when the upstream returned non-200 or null body. */
  ticker: EdgeXTickerPayload | null;
}

/** Shape of one row from edgeX getTicker `data[0]`. All numeric
 *  fields arrive as strings on the wire — parse in callers. Fields
 *  we know exist as of 2026-05; future fields just live alongside. */
export interface EdgeXTickerPayload {
  contractId: string;
  contractName: string;
  lastPrice?: string;
  close?: string;
  open?: string;
  high?: string;
  low?: string;
  /** Decimal fraction (-0.032 = -3.2%). NOT a percent. */
  priceChangePercent?: string;
  priceChangePercent24h?: string;
  priceChange?: string;
  /** Base-asset 24h volume (units of the underlying). */
  size?: string;
  /** Quote-asset 24h volume (USD-equivalent). */
  value?: string;
  /** Open interest in CONTRACTS (multiply by mark/oracle for USD). */
  openInterest?: string;
  /** Funding rate as decimal fraction (0.00005 = 0.005%). */
  fundingRate?: string;
  fundingTime?: string;
  nextFundingTime?: string;
  /** Venue mark price (used for PnL + liquidation). */
  markPrice?: string;
  /** Oracle-derived spot reference (acts as the "index"). */
  oraclePrice?: string;
  /** Explicit index price when edgeX provides it. */
  indexPrice?: string;
  // Other fields exist; callers extract by name.
}

interface MetaResponse {
  code?: string;
  data?: {
    contractList?: EdgeXContract[];
  };
}

interface TickerResponse {
  code?: string;
  data?: EdgeXTickerPayload[];
}

/** Fetch edgeX contract list + each contract's ticker. Returns an
 *  empty array when meta itself fails (logged); per-ticker failures
 *  return `ticker: null` in the row so callers can skip them while
 *  still counting how many made it through.
 *
 *  `callerTag` is just for logging — pass 'funding' / 'tickers' / 'oi'
 *  so the warn line identifies which route is hitting the failure.
 *
 *  `includeStocks` defaults to false so funding can call this and
 *  still skip edgeX stock perps without re-filtering. */
export async function fetchEdgeXTickers(
  fetchFn: typeof fetchWithTimeout,
  callerTag: string,
  options: { includeStocks?: boolean } = {},
): Promise<EdgeXTicker[]> {
  const metaRes = await fetchFn(
    'https://pro.edgex.exchange/api/v1/public/meta/getMetaData',
    EDGEX_HEADERS,
    META_TIMEOUT_MS,
  );
  if (!metaRes.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[${callerTag}/edgeX] meta fetch failed: ${metaRes.status} ${metaRes.statusText || ''}`);
    return [];
  }

  const metaData = (await metaRes.json()) as MetaResponse;
  const allContracts = metaData?.data?.contractList ?? [];
  const tradable = allContracts.filter((c) => c.enableTrade && (options.includeStocks || !c.isStock));
  if (tradable.length === 0) return [];

  const limited = tradable.slice(0, CONTRACT_LIMIT);

  // Single parallel fan-out. EdgeX handles 30 concurrent /getTicker
  // calls fine (verified by burst probe). Each call has its own
  // catch → null so one slow/erroring contract doesn't stall the rest.
  const tickerResults = await Promise.all(
    limited.map((c) =>
      fetchFn(
        `https://pro.edgex.exchange/api/v1/public/quote/getTicker?contractId=${c.contractId}`,
        EDGEX_HEADERS,
        TICKER_TIMEOUT_MS,
      )
        .then(async (r): Promise<EdgeXTickerPayload | null> => {
          if (!r.ok) return null;
          const json = (await r.json()) as TickerResponse;
          return json?.data?.[0] ?? null;
        })
        .catch(() => null),
    ),
  );

  return limited.map((contract, i) => ({
    contract,
    ticker: tickerResults[i],
  }));
}

/** Parse a contract name like "BTCUSD" / "ETHUSDT" into the base
 *  symbol ("BTC" / "ETH"). Returns '' if unparseable. The regex is
 *  case-insensitive to defensively cope with any future lowercasing
 *  upstream — edgeX always returns uppercase today. */
export function edgeXBaseSymbol(contractName: string | undefined): string {
  if (!contractName) return '';
  return contractName.toUpperCase().replace(/USD.*/, '');
}
