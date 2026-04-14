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
  volume24h: number;
  liquidations24h: number;
  spread?: number;
  spreadPct?: number;
  /** Per-exchange funding rates (normalized to 8h) keyed by exchange name */
  fundingByExchange?: Record<string, number>;
}

export type AlertMetric = 'price' | 'fundingRate' | 'openInterest' | 'change24h' | 'volume24h' | 'liquidations24h' | 'spread' | 'spreadPct' | 'liqProximity' | 'tpProximity';
export type AlertOperator = 'gt' | 'lt';

export interface Alert {
  id: string;
  symbol: string;
  metric: AlertMetric;
  operator: AlertOperator;
  value: number;
  enabled: boolean;
  createdAt: number;
  /** Optional: specific exchange for per-exchange funding alerts */
  exchange?: string;
  /** For liqProximity/tpProximity: alert when price is within this % of the target price */
  proximityPct?: number;
  /** Optional: restrict notifications to specific channels. Empty/undefined = use global prefs (all channels). */
  channels?: string[];
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

  const [tickerRes, fundingRes, oiRes, liqRes] = await Promise.all([
    fetchJSON<{ data: any[] }>(`${origin}/api/tickers`),
    fetchJSON<{ data: any[] }>(`${origin}/api/funding`),
    fetchJSON<{ data: any[] }>(`${origin}/api/openinterest`),
    fetchJSON<{ topSymbols: any[] }>(`${origin}/api/liquidation-heatmap?timeframe=24h`),
  ]);

  // Tickers → price + change24h + volume (proper averaging across exchanges)
  if (tickerRes?.data) {
    const priceAccum = new Map<string, { sum: number; count: number }>();
    const changeAccum = new Map<string, { sum: number; count: number }>();
    for (const t of tickerRes.data) {
      const sym = t.symbol as string;
      if (!map.has(sym)) {
        map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0, volume24h: 0, liquidations24h: 0 });
      }
      const entry = map.get(sym)!;
      if (t.lastPrice) {
        const acc = priceAccum.get(sym) || { sum: 0, count: 0 };
        acc.sum += t.lastPrice;
        acc.count++;
        priceAccum.set(sym, acc);
        entry.price = acc.sum / acc.count;
      }
      // Average change24h across exchanges (not just last exchange wins)
      const change = t.priceChangePercent24h ?? t.change24h;
      if (change != null && !isNaN(change)) {
        const acc = changeAccum.get(sym) || { sum: 0, count: 0 };
        acc.sum += change;
        acc.count++;
        changeAccum.set(sym, acc);
        entry.change24h = acc.sum / acc.count;
      }
      // Sum volume across exchanges
      if (t.quoteVolume24h) {
        entry.volume24h += t.quoteVolume24h;
      }
    }
  }

  // Compute spread per symbol from ticker data
  if (tickerRes?.data) {
    const bySymbol = new Map<string, number[]>();
    for (const t of tickerRes.data) {
      if (t.lastPrice > 0) {
        const arr = bySymbol.get(t.symbol) || [];
        arr.push(t.lastPrice);
        bySymbol.set(t.symbol, arr);
      }
    }
    bySymbol.forEach((prices, sym) => {
      if (prices.length < 2) return;
      const sorted = [...prices].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const sane = sorted.filter(p => median > 0 ? Math.abs(p - median) / median < 0.05 : true);
      if (sane.length < 2) return;
      const spread = sane[sane.length - 1] - sane[0];
      const spreadPct = sane[0] > 0 ? (spread / sane[0]) * 100 : 0;
      const entry = map.get(sym);
      if (entry) { entry.spread = spread; entry.spreadPct = spreadPct; }
    });
  }

  // Funding rates → average per symbol + per-exchange rates
  if (fundingRes?.data) {
    const sums = new Map<string, { sum: number; count: number }>();
    const perExchange = new Map<string, Record<string, number>>();
    for (const f of fundingRes.data) {
      const sym = f.symbol as string;
      const rate = f.rate ?? f.fundingRate;
      if (rate != null) {
        // Normalize to 8h basis for fair averaging across exchanges
        const mult = f.fundingInterval === '1h' ? 8 : f.fundingInterval === '4h' ? 2 : 1;
        const normalized = rate * mult;
        const cur = sums.get(sym) || { sum: 0, count: 0 };
        cur.sum += normalized;
        cur.count++;
        sums.set(sym, cur);
        // Store per-exchange rate
        if (f.exchange) {
          const exMap = perExchange.get(sym) || {};
          exMap[f.exchange] = normalized;
          perExchange.set(sym, exMap);
        }
      }
    }
    sums.forEach((v, sym) => {
      if (!map.has(sym)) {
        map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0, volume24h: 0, liquidations24h: 0 });
      }
      const entry = map.get(sym)!;
      entry.fundingRate = v.count > 0 ? v.sum / v.count : 0;
      entry.fundingByExchange = perExchange.get(sym);
    });
  }

  // OI → sum per symbol
  if (oiRes?.data) {
    for (const o of oiRes.data) {
      const sym = o.symbol as string;
      if (!map.has(sym)) {
        map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0, volume24h: 0, liquidations24h: 0 });
      }
      map.get(sym)!.openInterest += o.openInterestValue || 0;
    }
  }

  // Liquidations → 24h value per symbol
  if (liqRes?.topSymbols) {
    for (const l of liqRes.topSymbols) {
      const sym = l.symbol as string;
      if (!map.has(sym)) {
        map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0, volume24h: 0, liquidations24h: 0 });
      }
      map.get(sym)!.liquidations24h = l.value || 0;
    }
  }

  return map;
}

export function getMetricValue(data: MarketData, metric: AlertMetric, alert?: Alert): number {
  switch (metric) {
    case 'price': return data.price;
    case 'fundingRate':
      // Per-exchange funding rate if exchange is specified
      if (alert?.exchange && data.fundingByExchange?.[alert.exchange] != null) {
        return data.fundingByExchange[alert.exchange];
      }
      return data.fundingRate;
    case 'openInterest': return data.openInterest;
    case 'change24h': return data.change24h;
    case 'volume24h': return data.volume24h;
    case 'liquidations24h': return data.liquidations24h;
    case 'spread': return data.spread || 0;
    case 'spreadPct': return data.spreadPct || 0;
    case 'liqProximity':
    case 'tpProximity':
      // For proximity alerts, value is the target price; return current price
      return data.price;
  }
}

export function checkAlert(alert: Alert, data: MarketData): boolean {
  if (alert.metric === 'liqProximity' || alert.metric === 'tpProximity') {
    // Proximity check: fire when price is within proximityPct% of target price
    if (!alert.proximityPct || data.price <= 0 || alert.value <= 0) return false;
    const distancePct = Math.abs(data.price - alert.value) / alert.value * 100;
    return distancePct <= alert.proximityPct;
  }
  const val = getMetricValue(data, alert.metric, alert);
  return alert.operator === 'gt' ? val > alert.value : val < alert.value;
}
