/**
 * Saved wallet addresses stored in localStorage.
 * Key: ih_wallets
 * Value: JSON array of SavedWallet objects
 * Max 10 saved wallets.
 */

const STORAGE_KEY = 'ih_wallets';
const MAX_WALLETS = 10;

export interface SavedWallet {
  address: string;
  chain: 'eth' | 'btc' | 'sol';
  label?: string;
  addedAt: number;
}

/* ------------------------------------------------------------------ */
/*  Internal read/write helpers (SSR-safe)                             */
/* ------------------------------------------------------------------ */

function read(): SavedWallet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w): w is SavedWallet =>
        typeof w === 'object' &&
        w !== null &&
        typeof w.address === 'string' &&
        typeof w.chain === 'string' &&
        typeof w.addedAt === 'number',
    );
  } catch {
    return [];
  }
}

function write(wallets: SavedWallet[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  } catch {
    // localStorage full or unavailable -- silently ignore
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Return all saved wallets. */
export function getSavedWallets(): SavedWallet[] {
  return read();
}

/** Add a wallet address. No-op if already saved or at max capacity. */
export function addWallet(
  address: string,
  chain: 'eth' | 'btc' | 'sol',
  label?: string,
): void {
  const list = read();
  if (list.length >= MAX_WALLETS) return;
  const normalized = address.trim();
  if (!normalized) return;
  if (list.some((w) => w.address.toLowerCase() === normalized.toLowerCase())) return;
  list.push({
    address: normalized,
    chain,
    label: label?.trim() || undefined,
    addedAt: Date.now(),
  });
  write(list);
}

/** Remove a wallet by address. */
export function removeWallet(address: string): void {
  const normalized = address.trim().toLowerCase();
  const list = read().filter((w) => w.address.toLowerCase() !== normalized);
  write(list);
}

/** Get the label for a saved wallet, if any. */
export function getWalletLabel(address: string): string | undefined {
  const normalized = address.trim().toLowerCase();
  const wallet = read().find((w) => w.address.toLowerCase() === normalized);
  return wallet?.label;
}

/* ------------------------------------------------------------------ */
/*  Chain detection from address format                                */
/* ------------------------------------------------------------------ */

/**
 * Auto-detect chain from address format:
 *  - ETH: starts with 0x, 42 chars total
 *  - BTC: starts with 1, 3, or bc1
 *  - SOL: base58 encoded, 32-44 chars, no 0/O/I/l
 */
export function detectChain(address: string): 'eth' | 'btc' | 'sol' | null {
  const trimmed = address.trim();
  if (!trimmed) return null;

  // ETH: 0x followed by 40 hex chars (42 total)
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return 'eth';
  }

  // BTC: Legacy (1...), P2SH (3...), or Bech32 (bc1...)
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed) || /^bc1[a-z0-9]{25,90}$/i.test(trimmed)) {
    return 'btc';
  }

  // SOL: base58 (no 0, O, I, l), 32-44 chars
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
    return 'sol';
  }

  return null;
}
