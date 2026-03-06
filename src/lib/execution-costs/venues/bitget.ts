import { RawBookData, OrderbookLevel } from '../types';

export async function fetchBitgetBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const pair = `${asset}USDT`;
    const res = await fetchFn(`https://api.bitget.com/api/v2/mix/market/merge-depth?symbol=${pair}&productType=USDT-FUTURES&limit=20`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== '00000') return null;
    const depthData = json.data || {};

    const bids: OrderbookLevel[] = (depthData.bids || []).map(([p, q]: [string, string]) => ({ price: +p, size: +q }));
    const asks: OrderbookLevel[] = (depthData.asks || []).map(([p, q]: [string, string]) => ({ price: +p, size: +q }));
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Bitget', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
