import { RawBookData, OrderbookLevel } from '../types';
import { nativeSymbol, nativePriceScale } from '../symbol-map';

export async function fetchAsterBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    // Aster mirrors Binance's "1000<TICKER>" convention for sub-cent perps.
    const native = nativeSymbol('Aster', asset);
    const scale = nativePriceScale('Aster', asset);
    const symbol = `${native}USDT`;
    const res = await fetchFn(`https://fapi.asterdex.com/fapi/v1/depth?symbol=${symbol}&limit=500`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    const bids: OrderbookLevel[] = data.bids.map((b: [string, string]) => ({
      price: parseFloat(b[0]) / scale, size: parseFloat(b[1]) * scale,
    }));
    const asks: OrderbookLevel[] = data.asks.map((a: [string, string]) => ({
      price: parseFloat(a[0]) / scale, size: parseFloat(a[1]) * scale,
    }));
    const midPrice = ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'Aster', bids, asks, midPrice, symbol, method: 'clob' };
  } catch { return null; }
}
