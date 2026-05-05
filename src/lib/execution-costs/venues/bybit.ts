import { RawBookData, OrderbookLevel } from '../types';
import { nativeSymbol, nativePriceScale } from '../symbol-map';

export async function fetchBybitBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    // Sub-cent perps use a 1000-prefix on Bybit (or "SHIB1000" suffix).
    const native = nativeSymbol('Bybit', asset);
    const scale = nativePriceScale('Bybit', asset);
    const pair = `${native}USDT`;
    const res = await fetchFn(`https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${pair}&limit=25`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.retCode !== 0) return null;
    const depthData = json.result || {};

    const bids: OrderbookLevel[] = (depthData.b || []).map(([p, q]: [string, string]) => ({
      price: +p / scale, size: +q * scale,
    }));
    const asks: OrderbookLevel[] = (depthData.a || []).map(([p, q]: [string, string]) => ({
      price: +p / scale, size: +q * scale,
    }));
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Bybit', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
