/**
 * Shared types for DEX wallet position fetchers used by the portfolio sync cron.
 *
 * Mirror of src/lib/exchange-clients/types.ts but keyed by chain (the wallet
 * lives on a chain, not an exchange). Each implementation lives in its own
 * file (hyperliquid.ts, ethereum.ts, …) and the router in
 * src/lib/wallet-clients/index.ts dispatches by chain name.
 */
import type { NormalizedPosition } from '@/lib/exchange-clients/types';
import type { SupportedChain } from '@/lib/portfolio/supported-exchanges';

/**
 * One filled trade as returned by a venue's history endpoint. Symbol /
 * size / price are normalized; venueTradeId is the original venue id used
 * for idempotent dedup at the DB layer.
 */
export interface NormalizedTrade {
  symbol: string;
  /** 'buy' / 'sell' (CEX) or venue-specific direction tag. */
  side: 'buy' | 'sell' | string;
  /** Optional finer qualifier for derivatives. */
  direction?: 'open' | 'close' | 'reduce' | 'add';
  /** Size in coin/base units. */
  size: number;
  price: number;
  /** Filled USD notional (size × price for linear). */
  valueUsd: number;
  /** Fees paid in USD (sign-positive). */
  feeUsd?: number | null;
  /** Realised PnL on a closing fill. Null/undefined for opens. */
  realizedPnlUsd?: number | null;
  /** Original venue trade id — must be stable across re-fetches. */
  venueTradeId: string;
  /** Fill timestamp. */
  ts: Date;
}

export interface WalletClient {
  readonly chain: SupportedChain;
  /**
   * Stable display name used as the `exchange` label when persisting positions.
   * Must match the funding_snapshots.exchange value for the per-position
   * funding-rate join in /api/account/positions to work. e.g. "Hyperliquid",
   * "GMX", "Lighter".
   */
  readonly displayName: string;
  /** Fetch open perp positions for this address. Returns empty array if none. */
  fetchPositions(address: string): Promise<NormalizedPosition[]>;
  /**
   * Optional: fetch fills since a high-water-mark timestamp. Implementations
   * should return [] when not implemented or when no new fills exist. The
   * cron caller dedupes by venueTradeId at the DB layer, so re-returning
   * the boundary fills is safe.
   */
  fetchTradeHistory?(address: string, sinceMs?: number): Promise<NormalizedTrade[]>;
}

// Re-export for callers
export type { NormalizedPosition } from '@/lib/exchange-clients/types';
