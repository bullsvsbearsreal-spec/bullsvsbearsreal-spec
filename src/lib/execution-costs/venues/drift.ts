import { RawBookData, OrderbookLevel } from '../types';

// Drift precision: PRICE_PRECISION = 1e6, BASE_PRECISION = 1e9
const PRICE_PRECISION = 1e6;
const BASE_PRECISION = 1e9;

export async function fetchDriftBook(asset: string, fetchFn: typeof fetch): Promise<RawBookData | null> {
  try {
    const market = `${asset}-PERP`;
    const res = await fetchFn(`https://dlob.drift.trade/l2?marketName=${market}&depth=50&includeVamm=true&includeOracle=true`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.bids || !data.asks) return null;

    const bids: OrderbookLevel[] = data.bids.map((b: any) => ({
      price: parseFloat(b.price) / PRICE_PRECISION,
      size: parseFloat(b.size) / BASE_PRECISION,
    }));
    const asks: OrderbookLevel[] = data.asks.map((a: any) => ({
      price: parseFloat(a.price) / PRICE_PRECISION,
      size: parseFloat(a.size) / BASE_PRECISION,
    }));

    // Oracle price is in top-level `oracle` field at PRICE_PRECISION
    const oracleRaw = data.oracle || data.oracleData?.price;
    const midPrice = oracleRaw
      ? parseFloat(String(oracleRaw)) / PRICE_PRECISION
      : ((bids[0]?.price ?? 0) + (asks[0]?.price ?? 0)) / 2;

    return { exchange: 'Drift', bids, asks, midPrice, symbol: market, method: 'clob' };
  } catch { return null; }
}
