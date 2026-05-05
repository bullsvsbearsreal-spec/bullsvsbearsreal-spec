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
}

// Re-export for callers
export type { NormalizedPosition } from '@/lib/exchange-clients/types';
