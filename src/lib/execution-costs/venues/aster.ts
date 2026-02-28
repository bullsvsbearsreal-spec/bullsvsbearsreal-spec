import { RawBookData, OrderbookLevel } from '../types';

export async function fetchAsterBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const symbol = `${asset}USDT`;
    const res = await fetchFn(`https://fapi.asterdex.com/fapi/v1/depth?symbol=${symbol}&limit=500`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    const bids: OrderbookLevel[] = data.bids.map((b: [string, string]) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) }));
    const asks: OrderbookLevel[] = data.asks.map((a: [string, string]) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) }));
    const midPrice = ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'Aster', bids, asks, midPrice, symbol, method: 'clob' };
  } catch { return null; }
}
