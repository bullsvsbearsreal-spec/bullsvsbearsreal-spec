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
 * Convenience: fetch positions across every client registered for the chain
 * in parallel and concatenate. One client failing doesn't block the others.
 */
export async function fetchAllPositionsForChain(
  chain: SupportedChain,
  address: string,
): Promise<NormalizedPosition[]> {
  const clients = getWalletClients(chain);
  if (clients.length === 0) return [];
  const results = await Promise.allSettled(
    clients.map(c => c.fetchPositions(address)),
  );
  const out: NormalizedPosition[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') out.push(...r.value);
  }
  return out;
}

export type { WalletClient, NormalizedPosition } from './types';
