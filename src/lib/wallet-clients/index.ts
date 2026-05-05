/**
 * Routes a SupportedChain to one or more WalletClient implementations.
 *
 * A chain can have multiple DEX clients running in parallel. For example,
 * an Arbitrum address might have positions on GMX V2 AND gTrade
 * simultaneously — we fetch both and concatenate.
 *
 * Currently supported:
 *   - hyperliquid → Hyperliquid native
 *   - arbitrum    → GMX V2 (Arb + Avax) + gTrade (Arb + Polygon)
 *   - ethereum    → Lighter (zk-rollup, registers via L1 ETH address)
 */
import type { SupportedChain } from '@/lib/portfolio/supported-exchanges';
import type { WalletClient, NormalizedPosition } from './types';
import { hyperliquidWalletClient } from './hyperliquid';
import { gmxWalletClient } from './gmx';
import { gtradeWalletClient } from './gtrade';
import { lighterWalletClient } from './lighter';

const CLIENTS: Partial<Record<SupportedChain, WalletClient[]>> = {
  hyperliquid: [hyperliquidWalletClient],
  arbitrum: [gmxWalletClient, gtradeWalletClient],
  ethereum: [lighterWalletClient],
};

/**
 * A position tagged with the DEX it came from. Used by sync-positions so
 * persisted rows carry the per-DEX `exchange` label (which the funding-
 * rate join in /api/account/positions matches against funding_snapshots).
 */
export interface TaggedPosition extends NormalizedPosition {
  /** DEX display name — "Hyperliquid", "GMX", "gTrade", "Lighter", etc. */
  exchange: string;
}

/**
 * Returns the FIRST registered client for a chain (back-compat for callers
 * that still expect a single client). Most callers should use
 * `getWalletClients()` and aggregate.
 */
export function getWalletClient(chain: SupportedChain): WalletClient | null {
  return CLIENTS[chain]?.[0] ?? null;
}

/** Returns ALL registered clients for a chain. */
export function getWalletClients(chain: SupportedChain): WalletClient[] {
  return CLIENTS[chain] ?? [];
}

/**
 * Fetch positions from every client registered for the chain in parallel
 * and concatenate, tagging each row with the source DEX's display name.
 * One client failing doesn't block the others.
 */
export async function fetchAllPositionsForChain(
  chain: SupportedChain,
  address: string,
): Promise<TaggedPosition[]> {
  const clients = getWalletClients(chain);
  if (clients.length === 0) return [];
  const results = await Promise.allSettled(
    clients.map(async c => ({ name: c.displayName, rows: await c.fetchPositions(address) })),
  );
  const out: TaggedPosition[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const p of r.value.rows) out.push({ ...p, exchange: r.value.name });
    }
  }
  return out;
}

export type { WalletClient, NormalizedPosition } from './types';
