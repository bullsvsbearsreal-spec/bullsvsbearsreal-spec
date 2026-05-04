/**
 * Which CEXes the portfolio feature can talk to today.
 *
 * Adding a new one is a 4-step process:
 *   1. Add the name here (canonical case — must match what we display in UI)
 *   2. Mark whether it needs a passphrase (OKX-style) below
 *   3. Write src/lib/exchange-clients/<name>.ts implementing
 *      validateKey() + fetchPositions() (Phase B)
 *   4. Wire into src/lib/exchange-clients/index.ts router
 */
export const SUPPORTED_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget'] as const;
export type SupportedExchange = typeof SUPPORTED_EXCHANGES[number];

/** OKX + Bitget API keys also need a user-supplied passphrase as a third secret. */
export const EXCHANGES_WITH_PASSPHRASE: ReadonlySet<SupportedExchange> = new Set<SupportedExchange>([
  'OKX',
  'Bitget',
]);

export function isSupportedExchange(s: unknown): s is SupportedExchange {
  return typeof s === 'string' && (SUPPORTED_EXCHANGES as readonly string[]).includes(s);
}

/**
 * Read-only chains for which we'll track DEX wallet positions.
 * Hyperliquid is its own L1; the rest are EVM addresses (0x...).
 */
export const SUPPORTED_CHAINS = ['hyperliquid', 'ethereum', 'arbitrum', 'base', 'solana'] as const;
export type SupportedChain = typeof SUPPORTED_CHAINS[number];

export function isSupportedChain(s: unknown): s is SupportedChain {
  return typeof s === 'string' && (SUPPORTED_CHAINS as readonly string[]).includes(s);
}

/** Validate a wallet address against its chain. Permissive — exchanges/explorers do the real work. */
export function isValidAddress(chain: SupportedChain, address: string): boolean {
  const a = address.trim();
  if (chain === 'solana') {
    // Base58, 32-44 chars
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
  }
  // EVM + Hyperliquid both use 0x... 40-hex-char addresses
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}
