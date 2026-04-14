'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSound } from '@/hooks/useSound';
import {
  getAlerts,
  addTriggeredAlert,
  type Alert,
  type AlertMetric,
} from '@/lib/storage/alerts';

/**
 * Global alert engine that polls market data every 60s and checks
 * alert conditions. Triggers browser notifications if conditions are met.
 */

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  fundingRate: number;
  openInterest: number;
  volume24h: number;
  liquidations24h: number;
  fundingByExchange?: Record<string, number>;
}

async function fetchMarketData(): Promise<Map<string, MarketData>> {
  const map = new Map<string, MarketData>();

  try {
    const [tickerRes, fundingRes, oiRes] = await Promise.all([
      fetch('/api/tickers').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/funding').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/openinterest').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    // Tickers: build price + change24h (proper averaging across exchanges)
    if (tickerRes?.data) {
      const priceAccum = new Map<string, { sum: number; count: number }>();
      const changeAccum = new Map<string, { sum: number; count: number }>();
      interface RawTicker { symbol: string; lastPrice?: number; priceChangePercent24h?: number; change24h?: number; quoteVolume24h?: number }
      const volAccum = new Map<string, number>();
      (tickerRes.data as RawTicker[]).forEach((t) => {
        const sym = t.symbol;
        if (!map.has(sym)) {
          map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0, volume24h: 0, liquidations24h: 0 });
        }
        const entry = map.get(sym)!;
        // Average price across exchanges using proper sum/count
        if (t.lastPrice && !isNaN(t.lastPrice)) {
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
        if (t.quoteVolume24h && t.quoteVolume24h > 0) {
          volAccum.set(sym, (volAccum.get(sym) || 0) + t.quoteVolume24h);
          entry.volume24h = volAccum.get(sym)!;
        }
      });
    }

    // Funding rates: average per symbol + per-exchange rates
    if (fundingRes?.data) {
      const fundingSums = new Map<string, { sum: number; count: number }>();
      const perExchange = new Map<string, Record<string, number>>();
      interface RawFunding { symbol: string; rate?: number; fundingRate?: number; fundingInterval?: string; exchange?: string }
      (fundingRes.data as RawFunding[]).forEach((f) => {
        const sym = f.symbol;
        const rate = f.rate ?? f.fundingRate;
        if (rate != null) {
          // Normalize to 8h basis for fair averaging across exchanges
          const mult = f.fundingInterval === '1h' ? 8 : f.fundingInterval === '4h' ? 2 : 1;
          const normalized = rate * mult;
          const cur = fundingSums.get(sym) || { sum: 0, count: 0 };
          cur.sum += normalized;
          cur.count++;
          fundingSums.set(sym, cur);
          // Store per-exchange rate
          if (f.exchange) {
            const exMap = perExchange.get(sym) || {};
            exMap[f.exchange] = normalized;
            perExchange.set(sym, exMap);
          }
        }
      });
      fundingSums.forEach((v, sym) => {
        if (!map.has(sym)) {
          map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0, volume24h: 0, liquidations24h: 0 });
        }
        const entry = map.get(sym)!;
        entry.fundingRate = v.count > 0 ? v.sum / v.count : 0;
        entry.fundingByExchange = perExchange.get(sym);
      });
    }

    // OI: sum per symbol
    if (oiRes?.data) {
      interface RawOI { symbol: string; openInterestValue?: number }
      (oiRes.data as RawOI[]).forEach((o) => {
        const sym = o.symbol;
        if (!map.has(sym)) {
          map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0, volume24h: 0, liquidations24h: 0 });
        }
        map.get(sym)!.openInterest += o.openInterestValue || 0;
      });
    }
  } catch {
    // Silently fail — will retry next cycle
  }

  return map;
}

function getMetricValue(data: MarketData, metric: AlertMetric, alert?: Alert): number {
  switch (metric) {
    case 'price': return data.price;
    case 'fundingRate':
      if (alert?.exchange && data.fundingByExchange?.[alert.exchange] != null) {
        return data.fundingByExchange[alert.exchange];
      }
      return data.fundingRate;
    case 'openInterest': return data.openInterest;
    case 'change24h': return data.change24h;
    case 'volume24h': return data.volume24h;
    case 'liquidations24h': return data.liquidations24h;
    case 'liqProximity':
    case 'tpProximity':
      return data.price;
    default: return 0;
  }
}

function checkAlert(alert: Alert, data: MarketData): boolean {
  if (alert.metric === 'liqProximity' || alert.metric === 'tpProximity') {
    if (!alert.proximityPct || data.price <= 0) return false;
    const distancePct = Math.abs(data.price - alert.value) / data.price * 100;
    return distancePct <= alert.proximityPct;
  }
  const val = getMetricValue(data, alert.metric, alert);
  return alert.operator === 'gt' ? val > alert.value : val < alert.value;
}

export function useAlertEngine(intervalMs: number = 60_000) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cooldown: don't re-fire the same alert within 30 minutes
  const lastFiredRef = useRef<Map<string, number>>(new Map());
  const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
  const { playAlert } = useSound();

  const runCheck = useCallback(async () => {
    const alerts = getAlerts().filter((a) => a.enabled);
    const now = Date.now();

    // Prune stale cooldown entries unconditionally (deleted alerts or entries older than 2x cooldown)
    const pruneCutoff = now - ALERT_COOLDOWN_MS * 2;
    const activeIds = new Set(alerts.map(a => a.id));
    lastFiredRef.current.forEach((ts, id) => {
      if (ts < pruneCutoff || !activeIds.has(id)) lastFiredRef.current.delete(id);
    });

    if (alerts.length === 0) return;

    const marketData = await fetchMarketData();

    alerts.forEach((alert) => {
      const data = marketData.get(alert.symbol);
      if (!data) return;

      if (checkAlert(alert, data)) {
        // Skip if this alert fired recently (cooldown)
        const lastFired = lastFiredRef.current.get(alert.id);
        if (lastFired && now - lastFired < ALERT_COOLDOWN_MS) return;

        lastFiredRef.current.set(alert.id, now);
        const actualValue = getMetricValue(data, alert.metric);
        addTriggeredAlert({
          alertId: alert.id,
          symbol: alert.symbol,
          metric: alert.metric,
          operator: alert.operator,
          threshold: alert.value,
          actualValue,
        });

        // Sound notification
        playAlert();

        // Browser notification (if permitted)
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          let body: string;
          if (alert.metric === 'liqProximity' || alert.metric === 'tpProximity') {
            const label = alert.metric === 'liqProximity' ? 'liquidation price' : 'take profit';
            const distPct = data.price > 0 ? (Math.abs(data.price - alert.value) / data.price * 100).toFixed(1) : '?';
            body = `Price ($${data.price.toFixed(2)}) is within ${distPct}% of your ${label} ($${alert.value})`;
          } else {
            const opLabel = alert.operator === 'gt' ? 'above' : 'below';
            const metricLabel = alert.exchange ? `${alert.metric} (${alert.exchange})` : alert.metric;
            body = `${metricLabel} is ${opLabel} ${alert.value} (current: ${isFinite(actualValue) ? actualValue.toFixed(4) : '?'})`;
          }
          new Notification(`InfoHub Alert: ${alert.symbol}`, {
            body,
            icon: '/favicon.png',
          });
        }
      }
    });
  }, [playAlert]);

  useEffect(() => {
    // Initial check after 5s
    const initialTimeout = setTimeout(runCheck, 5000);

    timerRef.current = setInterval(runCheck, intervalMs);

    // Request notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      clearTimeout(initialTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runCheck, intervalMs]);
}
