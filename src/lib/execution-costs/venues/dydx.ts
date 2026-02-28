import { RawBookData, OrderbookLevel } from '../types';

export async function fetchDydxBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const market = `${asset}-USD`;
    const res = await fetchFn(`https://indexer.dydx.trade/v4/orderbooks/perpetualMarket/${market}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    const bids: OrderbookLevel[] = data.bids.map((b: any) => ({ price: parseFloat(b.price), size: parseFloat(b.size) }));
    const asks: OrderbookLevel[] = data.asks.map((a: any) => ({ price: parseFloat(a.price), size: parseFloat(a.size) }));
    const midPrice = ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'dYdX', bids, asks, midPrice, symbol: market, method: 'clob' };
  } catch { return null; }
}
