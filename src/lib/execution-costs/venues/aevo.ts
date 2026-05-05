import { RawBookData, OrderbookLevel } from '../types';

export async function fetchAevoBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    // Aevo expects `instrument_name=BTC-PERP` (not `asset=BTC`). The old
    // shape was returning HTTP 400 silently → venue invisible in /trade-optimizer.
    // Sub-cent assets like PEPE list as `1000000PEPE-PERP` on Aevo —
    // rescale price/size on the way out so the book is in canonical units.
    const { nativeSymbol, nativePriceScale } = await import('../symbol-map');
    const native = nativeSymbol('Aevo', asset);
    const scale = nativePriceScale('Aevo', asset);
    const res = await fetchFn(`https://api.aevo.xyz/orderbook?instrument_name=${native}-PERP`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    // Aevo format: [[price, amount, iv], ...]
    const bids: OrderbookLevel[] = data.bids.map((b: any[]) => ({
      price: parseFloat(b[0]) / scale, size: parseFloat(b[1]) * scale,
    }));
    const asks: OrderbookLevel[] = data.asks.map((a: any[]) => ({
      price: parseFloat(a[0]) / scale, size: parseFloat(a[1]) * scale,
    }));
    const midPrice = ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'Aevo', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
