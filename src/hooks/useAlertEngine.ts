'use client';

import { useEffect, useRef, useCallback } from 'react';
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
      interface RawTicker { symbol: string; lastPrice?: number; priceChangePercent24h?: number; change24h?: number }
      (tickerRes.data as RawTicker[]).forEach((t) => {
        const sym = t.symbol;
        if (!map.has(sym)) {
          map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0 });
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
      });
    }

    // Funding rates: average per symbol
    if (fundingRes?.data) {
      const fundingSums = new Map<string, { sum: number; count: number }>();
      interface RawFunding { symbol: string; rate?: number; fundingRate?: number }
      (fundingRes.data as RawFunding[]).forEach((f) => {
        const sym = f.symbol;
        const rate = f.rate ?? f.fundingRate;
        if (rate != null) {
          const cur = fundingSums.get(sym) || { sum: 0, count: 0 };
          cur.sum += rate;
          cur.count++;
          fundingSums.set(sym, cur);
        }
      });
      fundingSums.forEach((v, sym) => {
        if (!map.has(sym)) {
          map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0 });
        }
        map.get(sym)!.fundingRate = v.count > 0 ? v.sum / v.count : 0;
      });
    }

    // OI: sum per symbol
    if (oiRes?.data) {
      interface RawOI { symbol: string; openInterestValue?: number }
      (oiRes.data as RawOI[]).forEach((o) => {
        const sym = o.symbol;
        if (!map.has(sym)) {
          map.set(sym, { symbol: sym, price: 0, change24h: 0, fundingRate: 0, openInterest: 0 });
        }
        map.get(sym)!.openInterest += o.openInterestValue || 0;
      });
    }
  } catch {
    // Silently fail — will retry next cycle
  }

  return map;
}

function getMetricValue(data: MarketData, metric: AlertMetric): number {
  switch (metric) {
    case 'price': return data.price;
    case 'fundingRate': return data.fundingRate;
    case 'openInterest': return data.openInterest;
    case 'change24h': return data.change24h;
  }
}

function checkAlert(alert: Alert, data: MarketData): boolean {
  const val = getMetricValue(data, alert.metric);
  return alert.operator === 'gt' ? val > alert.value : val < alert.value;
}

export function useAlertEngine(intervalMs: number = 60_000) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cooldown: don't re-fire the same alert within 30 minutes
  const lastFiredRef = useRef<Map<string, number>>(new Map());
  const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

  const runCheck = useCallback(async () => {
    const alerts = getAlerts().filter((a) => a.enabled);
    if (alerts.length === 0) return;

    const marketData = await fetchMarketData();
    const now = Date.now();

    // Prune stale cooldown entries (deleted alerts or entries older than 2x cooldown)
    const pruneCutoff = now - ALERT_COOLDOWN_MS * 2;
    const activeIds = new Set(alerts.map(a => a.id));
    lastFiredRef.current.forEach((ts, id) => {
      if (ts < pruneCutoff || !activeIds.has(id)) lastFiredRef.current.delete(id);
    });

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

        // Browser notification (if permitted)
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const opLabel = alert.operator === 'gt' ? 'above' : 'below';
          new Notification(`InfoHub Alert: ${alert.symbol}`, {
            body: `${alert.metric} is ${opLabel} ${alert.value} (current: ${actualValue.toFixed(4)})`,
            icon: '/favicon.png',
          });
        }
      }
    });
  }, []);

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
