import { RawBookData, OrderbookLevel } from '../types';

export async function fetchOKXBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const instId = `${asset}-USDT-SWAP`;
    const res = await fetchFn(`https://www.okx.com/api/v5/market/books?instId=${instId}&sz=20`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const bookData = json?.data?.[0] || {};

    // OKX format: [price, qty, deprecatedField, numOrders]
    const bids: OrderbookLevel[] = (bookData.bids || []).map((b: string[]) => ({ price: +b[0], size: +b[1] }));
    const asks: OrderbookLevel[] = (bookData.asks || []).map((a: string[]) => ({ price: +a[0], size: +a[1] }));
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'OKX', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
