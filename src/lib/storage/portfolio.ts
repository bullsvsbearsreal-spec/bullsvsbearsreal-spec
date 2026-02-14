/**
 * Portfolio holdings stored in localStorage.
 * Key: ih_portfolio
 * Value: JSON array of Holding objects
 */

const STORAGE_KEY = 'ih_portfolio';

export interface Holding {
  symbol: string;   // e.g. "BTC"
  quantity: number;  // e.g. 0.5
  avgPrice: number;  // e.g. 42000
  addedAt: number;   // timestamp
}

function read(): Holding[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (h): h is Holding =>
        typeof h === 'object' &&
        h !== null &&
        typeof h.symbol === 'string' &&
        typeof h.quantity === 'number' &&
        typeof h.avgPrice === 'number' &&
        typeof h.addedAt === 'number',
    );
  } catch {
    return [];
  }
}

function write(holdings: Holding[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  } catch {
    // localStorage full or unavailable -- silently ignore
  }
}

/** Return all portfolio holdings. */
export function getHoldings(): Holding[] {
  return read();
}

/** Add a new holding. Symbols are stored uppercase. */
export function addHolding(holding: Omit<Holding, 'addedAt'>): void {
  const upper = holding.symbol.toUpperCase().trim();
  if (!upper || holding.quantity <= 0) return;
  const list = read();
  // If symbol already exists, merge into existing position
  const existing = list.find((h) => h.symbol === upper);
  if (existing) {
    const totalQty = existing.quantity + holding.quantity;
    existing.avgPrice =
      (existing.avgPrice * existing.quantity + holding.avgPrice * holding.quantity) / totalQty;
    existing.quantity = totalQty;
  } else {
    list.push({
      symbol: upper,
      quantity: holding.quantity,
      avgPrice: holding.avgPrice,
      addedAt: Date.now(),
    });
  }
  write(list);
}

/** Update quantity and/or avgPrice for an existing holding. */
export function updateHolding(
  symbol: string,
  updates: Partial<Pick<Holding, 'quantity' | 'avgPrice'>>,
): void {
  const upper = symbol.toUpperCase().trim();
  const list = read();
  const holding = list.find((h) => h.symbol === upper);
  if (!holding) return;
  if (updates.quantity !== undefined) holding.quantity = updates.quantity;
  if (updates.avgPrice !== undefined) holding.avgPrice = updates.avgPrice;
  write(list);
}

/** Remove a holding by symbol. */
export function removeHolding(symbol: string): void {
  const upper = symbol.toUpperCase().trim();
  const list = read().filter((h) => h.symbol !== upper);
  write(list);
}

/** Clear all holdings. */
export function clearHoldings(): void {
  write([]);
}
