import { RawBookData, OrderbookLevel } from '../types';
import { nativeSymbol, nativePriceScale } from '../symbol-map';

export async function fetchBinanceBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    // Sub-cent perps trade as 1000<TICKER> on Binance USDT-M Futures
    // (e.g. PEPEUSDT doesn't exist; 1000PEPEUSDT does). Rescale price /
    // size so the book is in canonical $/token units after parsing.
    const native = nativeSymbol('Binance', asset);
    const scale = nativePriceScale('Binance', asset);
    const pair = `${native}USDT`;
    const res = await fetchFn(`https://fapi.binance.com/fapi/v1/depth?symbol=${pair}&limit=20`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const bids: OrderbookLevel[] = (data.bids || []).map(([p, q]: [string, string]) => ({
      price: +p / scale, size: +q * scale,
    }));
    const asks: OrderbookLevel[] = (data.asks || []).map(([p, q]: [string, string]) => ({
      price: +p / scale, size: +q * scale,
    }));
    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    return { exchange: 'Binance', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
