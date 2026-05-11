'use client';

/**
 * useChartIndicators — fetches perp klines for a symbol and computes
 * the classic technical indicators that the chart's stats bar needs
 * (RSI(14), ATR(14)). Klines are cached in-process and refreshed
 * every 60s so the bar updates without thrashing upstream.
 *
 * Goes through our internal `/api/klines` proxy (Binance fapi →
 * Binance spot → Bybit → OKX fallback chain) instead of hitting
 * fapi.binance.com directly. Two reasons:
 *   1. The site's connect-src CSP only whitelists Binance's WS
 *      (wss://fstream.binance.com), not their HTTP API.
 *   2. The proxy already has geo-block fallbacks — direct browser
 *      fetches would 451 for users in regions where Binance is
 *      blocked.
 *
 * Returns nulls gracefully when every venue fails (rare).
 */

import { useEffect, useState } from 'react';

/* ─── Indicator math ───────────────────────────────────────────────── */

interface Kline {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

/**
 * Wilder's RSI(period). Returns the latest value as a 0-100 percentage,
 * or null when there are fewer than `period+1` closes.
 */
export function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  // Seed avg gain / avg loss from the first `period` deltas
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gainSum += d; else lossSum -= d;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  // Smooth across the remaining closes
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d >= 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Wilder's ATR(period). Returns the absolute price-unit volatility band.
 * Caller typically renders it next to RSI to give a "how big is a typical
 * move on the active timeframe" feel.
 */
export function computeATR(klines: Kline[], period = 14): number | null {
  if (klines.length <= period) return null;
  // True range for each bar (uses prior close, so skip the first bar)
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const k = klines[i];
    const prevClose = klines[i - 1].close;
    const tr = Math.max(
      k.high - k.low,
      Math.abs(k.high - prevClose),
      Math.abs(k.low - prevClose),
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  // Seed with simple average of first `period` TRs
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  // Smooth with Wilder's formula
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

/* ─── Hook ─────────────────────────────────────────────────────────── */

export interface ChartIndicators {
  rsi: number | null;          // 0..100
  atr: number | null;          // price-units (absolute, NOT %)
  atrPct: number | null;       // ATR as % of last close — useful for ranking
  klinesCount: number;         // how many bars were used
}

/** Map TradingView interval string ('60', 'D', etc.) to the lowercase
 *  interval format /api/klines expects (1m / 5m / 15m / 1h / 4h / 1d / 1w). */
function toApiInterval(tvInterval: string): string {
  switch (tvInterval) {
    case '1': return '1m';
    case '5': return '5m';
    case '15': return '15m';
    case '60': return '1h';
    case '240': return '4h';
    case 'D': return '1d';
    case 'W': return '1w';
    default: return '1h';
  }
}

export function useChartIndicators(
  symbol: string,
  tvInterval: string,
  enabled = true,
): ChartIndicators {
  const [state, setState] = useState<ChartIndicators>({
    rsi: null, atr: null, atrPct: null, klinesCount: 0,
  });

  useEffect(() => {
    if (!enabled || !symbol) return;
    let cancelled = false;

    async function fetchKlines(): Promise<Kline[] | null> {
      // Hit our internal /api/klines proxy — it handles the Binance →
      // Bybit → OKX fallback chain server-side and dodges browser CSP.
      const interval = toApiInterval(tvInterval);
      const base = symbol.toUpperCase();
      try {
        const res = await fetch(
          `/api/klines?symbol=${encodeURIComponent(base)}&interval=${interval}&limit=100`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (!res.ok) return null;
        const json = await res.json();
        const candles = Array.isArray(json?.candles) ? json.candles : null;
        if (!candles || candles.length === 0) return null;
        return candles.map((c: { open: number; high: number; low: number; close: number; volume: number; closeTime: number }) => ({
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume),
          closeTime: Number(c.closeTime),
        }));
      } catch {
        return null;
      }
    }

    async function load() {
      const klines = await fetchKlines();
      if (cancelled || !klines) return;
      const closes = klines.map(k => k.close);
      const rsi = computeRSI(closes, 14);
      const atr = computeATR(klines, 14);
      const lastClose = closes[closes.length - 1];
      const atrPct = atr != null && lastClose > 0 ? (atr / lastClose) * 100 : null;
      setState({ rsi, atr, atrPct, klinesCount: klines.length });
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, tvInterval, enabled]);

  return state;
}
