import { RawBookData, OrderbookLevel } from '../types';

// Hyperliquid lists low-priced memecoins as "k<TOKEN>" (1000× units) so e.g.
// PEPE is `kPEPE`, BONK is `kBONK`, etc. Map the canonical ticker to HL's
// per-pair name so /trade-optimizer can quote them. The price returned by
// HL is per-1000-units — but since /api/execution-costs passes a USD-sized
// order to walkBook (which divides by price), the resulting fee/spread/impact
// percentages are scale-invariant, so no extra normalization is needed.
const HL_K_PREFIX = new Set(['PEPE', 'SHIB', 'BONK', 'FLOKI', 'LUNC', 'NEIRO', 'DOGS']);

function hlCoinName(asset: string): string {
  const upper = asset.toUpperCase();
  return HL_K_PREFIX.has(upper) ? `k${upper}` : upper;
}

export async function fetchHyperliquidBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const coin = hlCoinName(asset);
    // For "k" pairs, HL prices are per-1000-units. We rescale the book so
    // every venue is on the same canonical unit (1 token), otherwise the
    // cross-venue oracle sanity check trips "stale price" on these.
    const isKPrefix = coin !== asset.toUpperCase();
    const scale = isKPrefix ? 1000 : 1;

    const res = await fetchFn('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'l2Book', coin }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    const levels = data.levels;
    if (!levels || levels.length < 2) return null;

    // Scaling: divide price by 1000 and multiply size by 1000 so that
    // (price × size) USD value is preserved while the per-unit price now
    // matches the convention used by Binance/Bybit/etc.
    const bids: OrderbookLevel[] = levels[0].map((l: any) => ({
      price: parseFloat(l.px) / scale,
      size: parseFloat(l.sz) * scale,
    }));
    const asks: OrderbookLevel[] = levels[1].map((l: any) => ({
      price: parseFloat(l.px) / scale,
      size: parseFloat(l.sz) * scale,
    }));
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Hyperliquid', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
