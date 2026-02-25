/**
 * Server-side market data aggregation for alert checking.
 * Extracted from hooks/useAlertEngine.ts to work in cron/API routes.
 */

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  fundingRate: number;
  openInterest: number;
}

export type AlertMetric = 'price' | 'fundingRate' | 'openInterest' | 'change24h';
export type AlertOperator = 'gt' | 'lt';

export interface Alert {
  id: string;
  symbol: string;
  metric: AlertMetric;
  operator: AlertOperator;
  value: number;
  enabled: boolean;
  createdAt: number;
}

/** Fetch JSON from an internal API with a 15s timeout. */
async function fetchJSON<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Fetch and aggregate market data from internal APIs.
 * @param origin - The server origin (e.g. request.nextUrl.origin)
 */
export async function fetchMarketDataServer(
  origin: string,
): Promise<Map<string, MarketData>> {
  const map = new Map<string, MarketData>();

  const [tickerRes, fundingRes, oiRes] = await Promise.all([
    fetchJSON<{ data: any[] }>(`${origin}/api/tickers`),
    fetchJSON<{ data: any[] }>(`${origin}/api/funding`),
    fetchJSON<{ data: any[] }>(`${origin}/api/openinterest`),
  ]);

  // Tickers → price + change24h
  if (tickerRes?.data) {
    for (const t of tickerRes.data) {
      const sym = t.symbol as string;
      if (!map.has(sym)) {
        map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0 });
      }
      const entry = map.get(sym)!;
      if (t.lastPrice) {
        entry.price = entry.price > 0 ? (entry.price + t.lastPrice) / 2 : t.lastPrice;
      }
      if (t.priceChangePercent24h != null) {
        entry.change24h = t.priceChangePercent24h;
      } else if (t.change24h != null) {
        entry.change24h = t.change24h;
      }
    }
  }

  // Funding rates → average per symbol
  if (fundingRes?.data) {
    const sums = new Map<string, { sum: number; count: number }>();
    for (const f of fundingRes.data) {
      const sym = f.symbol as string;
      const rate = f.rate ?? f.fundingRate;
      if (rate != null) {
        const cur = sums.get(sym) || { sum: 0, count: 0 };
        cur.sum += rate;
        cur.count++;
        sums.set(sym, cur);
      }
    }
    sums.forEach((v, sym) => {
      if (!map.has(sym)) {
        map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0 });
      }
      map.get(sym)!.fundingRate = v.count > 0 ? v.sum / v.count : 0;
    });
  }

  // OI → sum per symbol
  if (oiRes?.data) {
    for (const o of oiRes.data) {
      const sym = o.symbol as string;
      if (!map.has(sym)) {
        map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0 });
      }
      map.get(sym)!.openInterest += o.openInterest || 0;
    }
  }

  return map;
}

export function getMetricValue(data: MarketData, metric: AlertMetric): number {
  switch (metric) {
    case 'price': return data.price;
    case 'fundingRate': return data.fundingRate;
    case 'openInterest': return data.openInterest;
    case 'change24h': return data.change24h;
  }
}

export function checkAlert(alert: Alert, data: MarketData): boolean {
  const val = getMetricValue(data, alert.metric);
  return alert.operator === 'gt' ? val > alert.value : val < alert.value;
}
