import { RawBookData, OrderbookLevel } from '../types';

export async function fetchLighterBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const marketsRes = await fetchFn('https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails', { signal: AbortSignal.timeout(5000) });
    if (!marketsRes.ok) return null;
    const markets = await marketsRes.json();

    // Lighter API moved from `{ order_books: [...] }` (older shape) to
    // `{ code, order_book_details: [...] }` with a `symbol` field instead
    // of `ticker`/`name`. Support both for forwards-compat.
    const marketList = Array.isArray(markets)
      ? markets
      : (markets.order_book_details || markets.order_books || []);
    const market = marketList.find((m: any) => {
      const sym = (m.symbol || m.ticker || m.name || '').toUpperCase();
      return sym === asset.toUpperCase()
        || (sym.startsWith(asset.toUpperCase()) && (sym.includes('USD') || sym.includes('USDT')));
    });
    if (!market) return null;

    const marketId = market.market_id ?? market.order_book_id;
    const decimals = market.price_decimals ?? market.supported_price_decimals ?? 2;
    const sizeDecimals = market.size_decimals ?? market.supported_size_decimals ?? 4;

    const ordersRes = await fetchFn(`https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders?market_id=${marketId}&limit=250`, { signal: AbortSignal.timeout(5000) });
    if (!ordersRes.ok) return null;
    const ordersData = await ordersRes.json();

    // Lighter shape changed: levels are now under `asks` / `bids` (was
    // `sell_orders` / `buy_orders`) and prices are already in decimal
    // form ("81421.6"), not raw integers — no /10^decimals division.
    // We still keep the legacy parser as a fallback in case someone
    // hits an older shard that returns `*_orders`.
    type RawOrder = { price: string | number; remaining_base_amount: string | number; size?: string | number };
    const parseDecimal = (orders: RawOrder[]): OrderbookLevel[] => {
      const map = new Map<number, number>();
      for (const o of orders) {
        const price = parseFloat(String(o.price));
        const sizeRaw = o.remaining_base_amount ?? o.size ?? 0;
        const size = parseFloat(String(sizeRaw));
        if (!isFinite(price) || !isFinite(size) || price <= 0 || size <= 0) continue;
        map.set(price, (map.get(price) || 0) + size);
      }
      return Array.from(map.entries()).map(([price, size]) => ({ price, size }));
    };
    const parseLegacy = (orders: any[]): OrderbookLevel[] => {
      const map = new Map<number, number>();
      for (const o of orders) {
        const price = parseFloat(o.price) / Math.pow(10, decimals);
        const size = parseFloat(o.remaining_base_amount) / Math.pow(10, sizeDecimals);
        if (!isFinite(price) || !isFinite(size) || price <= 0 || size <= 0) continue;
        map.set(price, (map.get(price) || 0) + size);
      }
      return Array.from(map.entries()).map(([price, size]) => ({ price, size }));
    };

    const rawAsks = ordersData.asks ?? ordersData.sell_orders ?? [];
    const rawBids = ordersData.bids ?? ordersData.buy_orders ?? [];
    const useDecimal = ordersData.asks !== undefined || ordersData.bids !== undefined;
    const parse = useDecimal ? parseDecimal : parseLegacy;

    const asks = parse(rawAsks).sort((a, b) => a.price - b.price);
    const bids = parse(rawBids).sort((a, b) => b.price - a.price);
    if (asks.length === 0 && bids.length === 0) return null;
    const midPrice = ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'Lighter', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
