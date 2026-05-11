'use client';

/**
 * useChartIndicators — fetches Binance perp klines for a symbol and
 * computes the classic technical indicators that the chart's stats bar
 * needs (RSI(14), ATR(14)). Klines are cached in-process and refreshed
 * every 60s so the bar updates without thrashing the public API.
 *
 * Why client-side: Binance fapi.binance.com supports CORS for public
 * endpoints, so we can fetch directly from the browser without an
 * internal proxy. Falls back gracefully to nulls when geo-blocked or
 * when the symbol isn't on Binance perp.
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

const BINANCE_FAPI_BASES = [
  'https://fapi.binance.com',
  'https://fapi.binance.me',
];

/** Map TradingView interval string ('60', 'D', etc.) to Binance interval. */
function toBinanceInterval(tvInterval: string): string {
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
      // Try the standard BTCUSDT-style pair (Binance perp linear).
      const binanceSym = `${symbol.toUpperCase()}USDT`;
      const interval = toBinanceInterval(tvInterval);
      const path = `/fapi/v1/klines?symbol=${binanceSym}&interval=${interval}&limit=100`;

      for (const base of BINANCE_FAPI_BASES) {
        try {
          const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) continue;
          const arr = await res.json();
          if (!Array.isArray(arr) || arr.length === 0) continue;
          return arr.map((row: unknown) => {
            const r = row as (string | number)[];
            return {
              open: Number(r[1]),
              high: Number(r[2]),
              low: Number(r[3]),
              close: Number(r[4]),
              volume: Number(r[5]),
              closeTime: Number(r[6]),
            };
          });
        } catch { /* try next base */ }
      }
      return null;
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
