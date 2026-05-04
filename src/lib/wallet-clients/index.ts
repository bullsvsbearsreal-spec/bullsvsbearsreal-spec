/**
 * Routes a SupportedChain to its WalletClient implementation.
 *
 * Today: Hyperliquid only — that's where the bulk of DEX-perp-trader wallet
 * activity lives. EVM chain DEXes (GMX on arbitrum, Aevo on Base, etc.) need
 * per-DEX query logic and land in follow-up commits.
 */
import type { SupportedChain } from '@/lib/portfolio/supported-exchanges';
import type { WalletClient } from './types';
import { hyperliquidWalletClient } from './hyperliquid';

const CLIENTS: Partial<Record<SupportedChain, WalletClient>> = {
  hyperliquid: hyperliquidWalletClient,
};

/** Returns null for chains we haven't implemented a fetcher for yet. */
export function getWalletClient(chain: SupportedChain): WalletClient | null {
  return CLIENTS[chain] ?? null;
}

export type { WalletClient, NormalizedPosition } from './types';
