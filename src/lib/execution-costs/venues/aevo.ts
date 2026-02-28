import { RawBookData, OrderbookLevel } from '../types';

export async function fetchAevoBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const res = await fetchFn(`https://api.aevo.xyz/orderbook?asset=${asset}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    // Aevo format: [[price, amount, iv], ...]
    const bids: OrderbookLevel[] = data.bids.map((b: any[]) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) }));
    const asks: OrderbookLevel[] = data.asks.map((a: any[]) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) }));
    const midPrice = ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'Aevo', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
