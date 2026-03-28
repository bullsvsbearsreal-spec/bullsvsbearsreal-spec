'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type HistogramData,
  type LineData,
  type SeriesMarker,
} from 'lightweight-charts';

export interface CVDBucket {
  time: number;
  buyVol: number;
  sellVol: number;
  delta: number;
  cvd: number;
  price?: number;
}

interface CVDChartProps {
  buckets: CVDBucket[];
  height?: number;
  showDivergences?: boolean;
  className?: string;
}

export default function CVDChart({ buckets, height = 400, showDivergences = true, className }: CVDChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const cvdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const deltaSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(255,255,255,0.5)',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(234,179,8,0.3)', labelBackgroundColor: '#eab308' },
        horzLine: { color: 'rgba(255,255,255,0.2)', labelBackgroundColor: '#333' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, secondsVisible: false },
    });

    // CVD line — primary series
    const cvdSeries = chart.addLineSeries({
      color: '#eab308',
      lineWidth: 2,
      priceScaleId: 'right',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    // Volume delta histogram — overlay at bottom 25%
    const deltaSeries = chart.addHistogramSeries({
      priceScaleId: 'delta',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.priceScale('delta').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    chartRef.current = chart;
    cvdSeriesRef.current = cvdSeries;
    deltaSeriesRef.current = deltaSeries;

    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [height]);

  // Update data
  useEffect(() => {
    if (!cvdSeriesRef.current || !deltaSeriesRef.current || !buckets.length) return;

    const cvdData: LineData<Time>[] = buckets.map((b) => ({
      time: (b.time / 1000) as Time,
      value: b.cvd,
    }));

    const deltaData: HistogramData<Time>[] = buckets.map((b) => ({
      time: (b.time / 1000) as Time,
      value: Math.abs(b.delta),
      color: b.delta >= 0
        ? 'rgba(34, 197, 94, 0.6)'
        : 'rgba(239, 68, 68, 0.6)',
    }));

    cvdSeriesRef.current.setData(cvdData);
    deltaSeriesRef.current.setData(deltaData);
    chartRef.current?.timeScale().fitContent();
  }, [buckets]);

  // Divergence markers
  useEffect(() => {
    if (!showDivergences || !cvdSeriesRef.current || buckets.length < 20) return;

    const markers = detectDivergences(buckets);
    cvdSeriesRef.current.setMarkers(markers);
  }, [buckets, showDivergences]);

  return <div ref={containerRef} className={className} role="img" aria-label="CVD line chart with volume delta histogram and divergence markers" />;
}

/* ─── Divergence Detection ───────────────────────────────────────────── */

function detectDivergences(buckets: CVDBucket[]): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];
  const LOOKBACK = 8;

  if (buckets.length < LOOKBACK * 3) return markers;

  // Find swing highs/lows in price
  const priceHighs: number[] = [];
  const priceLows: number[] = [];

  for (let i = LOOKBACK; i < buckets.length - LOOKBACK; i++) {
    const b = buckets[i];
    if (!b.price) continue;

    const window = buckets.slice(i - LOOKBACK, i + LOOKBACK + 1);
    const isHigh = window.every((x) => (x.price ?? -Infinity) <= b.price!);
    const isLow = window.every((x) => (x.price ?? Infinity) >= b.price!);

    if (isHigh) priceHighs.push(i);
    if (isLow) priceLows.push(i);
  }

  // Bearish divergence: price higher high + CVD lower high
  for (let i = 1; i < priceHighs.length; i++) {
    const curr = priceHighs[i];
    const prev = priceHighs[i - 1];
    const currB = buckets[curr];
    const prevB = buckets[prev];
    if (!currB.price || !prevB.price) continue;

    if (currB.price > prevB.price && currB.cvd < prevB.cvd) {
      markers.push({
        time: (currB.time / 1000) as Time,
        position: 'aboveBar',
        color: '#ef4444',
        shape: 'arrowDown',
        text: 'Bear Div',
      });
    }
  }

  // Bullish divergence: price lower low + CVD higher low
  for (let i = 1; i < priceLows.length; i++) {
    const curr = priceLows[i];
    const prev = priceLows[i - 1];
    const currB = buckets[curr];
    const prevB = buckets[prev];
    if (!currB.price || !prevB.price) continue;

    if (currB.price < prevB.price && currB.cvd > prevB.cvd) {
      markers.push({
        time: (currB.time / 1000) as Time,
        position: 'belowBar',
        color: '#22c55e',
        shape: 'arrowUp',
        text: 'Bull Div',
      });
    }
  }

  return markers;
}

/* ─── Absorption Detection (exported for use by parent page) ─────── */

export interface AbsorptionSignal {
  time: number;
  type: 'buy-absorption' | 'sell-absorption';
  volume: number;
  priceChangePct: number;
}

export function detectAbsorption(buckets: CVDBucket[], priceThresholdPct = 0.02): AbsorptionSignal[] {
  const signals: AbsorptionSignal[] = [];
  if (buckets.length < 5) return signals;

  const avgAbsDelta = buckets.reduce((s, b) => s + Math.abs(b.delta), 0) / buckets.length;

  for (let i = 1; i < buckets.length; i++) {
    const b = buckets[i];
    const prev = buckets[i - 1];
    if (!b.price || !prev.price) continue;

    const pctChange = Math.abs(b.price - prev.price) / prev.price * 100;
    const isHighVol = Math.abs(b.delta) > avgAbsDelta * 2;

    if (b.delta > 0 && isHighVol && pctChange < priceThresholdPct) {
      signals.push({ time: b.time, type: 'sell-absorption', volume: b.buyVol, priceChangePct: pctChange });
    }
    if (b.delta < 0 && isHighVol && pctChange < priceThresholdPct) {
      signals.push({ time: b.time, type: 'buy-absorption', volume: b.sellVol, priceChangePct: pctChange });
    }
  }
  return signals;
}
