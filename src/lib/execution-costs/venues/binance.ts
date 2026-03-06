import { RawBookData, OrderbookLevel } from '../types';

export async function fetchBinanceBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const pair = `${asset}USDT`;
    const res = await fetchFn(`https://fapi.binance.com/fapi/v1/depth?symbol=${pair}&limit=20`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const bids: OrderbookLevel[] = (data.bids || []).map(([p, q]: [string, string]) => ({ price: +p, size: +q }));
    const asks: OrderbookLevel[] = (data.asks || []).map(([p, q]: [string, string]) => ({ price: +p, size: +q }));
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Binance', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
