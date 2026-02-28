import { RawBookData, OrderbookLevel } from '../types';

export async function fetchHyperliquidBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const res = await fetchFn('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'l2Book', coin: asset }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const levels = data.levels;
    if (!levels || levels.length < 2) return null;

    const bids: OrderbookLevel[] = levels[0].map((l: any) => ({ price: parseFloat(l.px), size: parseFloat(l.sz) }));
    const asks: OrderbookLevel[] = levels[1].map((l: any) => ({ price: parseFloat(l.px), size: parseFloat(l.sz) }));
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Hyperliquid', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
