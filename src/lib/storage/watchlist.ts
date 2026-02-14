/**
 * Watchlist stored in localStorage.
 * Key: ih_watchlist
 * Value: JSON array of uppercase symbol strings, e.g. ["BTC","ETH","SOL"]
 */

const STORAGE_KEY = 'ih_watchlist';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}

function write(symbols: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Return the current watchlist as an array of uppercase symbols. */
export function getWatchlist(): string[] {
  return read();
}

/** Add a symbol to the watchlist (no-op if already present). */
export function addToWatchlist(symbol: string): void {
  const upper = symbol.toUpperCase().trim();
  if (!upper) return;
  const list = read();
  if (list.includes(upper)) return;
  list.push(upper);
  write(list);
}

/** Remove a symbol from the watchlist. */
export function removeFromWatchlist(symbol: string): void {
  const upper = symbol.toUpperCase().trim();
  const list = read().filter((s) => s !== upper);
  write(list);
}

/** Check whether a symbol is in the watchlist. */
export function isInWatchlist(symbol: string): boolean {
  return read().includes(symbol.toUpperCase().trim());
}

/** Clear the entire watchlist. */
export function clearWatchlist(): void {
  write([]);
}
