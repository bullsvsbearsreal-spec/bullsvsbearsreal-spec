import { RawBookData, OrderbookLevel } from '../types';

export async function fetchLighterBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const marketsRes = await fetchFn('https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails', { signal: AbortSignal.timeout(5000) });
    if (!marketsRes.ok) return null;
    const markets = await marketsRes.json();

    const marketList = Array.isArray(markets) ? markets : markets.order_books || [];
    const market = marketList.find((m: any) => {
      const name = (m.ticker || m.name || '').toUpperCase();
      return name.startsWith(asset) && (name.includes('USD') || name.includes('USDT'));
    });
    if (!market) return null;

    const marketId = market.order_book_id ?? market.market_id;
    const decimals = market.price_decimals ?? 2;
    const sizeDecimals = market.size_decimals ?? 4;

    const ordersRes = await fetchFn(`https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders?market_id=${marketId}&limit=250`, { signal: AbortSignal.timeout(5000) });
    if (!ordersRes.ok) return null;
    const ordersData = await ordersRes.json();

    const parseOrders = (orders: any[]): OrderbookLevel[] => {
      const map = new Map<number, number>();
      for (const o of orders) {
        const price = parseFloat(o.price) / Math.pow(10, decimals);
        const size = parseFloat(o.remaining_base_amount) / Math.pow(10, sizeDecimals);
        map.set(price, (map.get(price) || 0) + size);
      }
      return Array.from(map.entries()).map(([price, size]) => ({ price, size }));
    };

    const bids = parseOrders(ordersData.buy_orders || []).sort((a, b) => b.price - a.price);
    const asks = parseOrders(ordersData.sell_orders || []).sort((a, b) => a.price - b.price);
    const midPrice = ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'Lighter', bids, asks, midPrice, symbol: asset, method: 'clob' };
  } catch { return null; }
}
