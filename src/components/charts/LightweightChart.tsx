'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type Time,
} from 'lightweight-charts';

type SeriesConfig =
  | { type: 'candlestick'; data: CandlestickData<Time>[]; options?: Record<string, any> }
  | { type: 'line'; data: LineData<Time>[]; options?: Record<string, any> }
  | { type: 'histogram'; data: HistogramData<Time>[]; options?: Record<string, any> };

interface LightweightChartProps {
  series: SeriesConfig[];
  height?: number;
  darkMode?: boolean;
}

export default function LightweightChart({ series, height = 400, darkMode = true }: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const buildChart = useCallback(() => {
    if (!containerRef.current) return;

    // Clean up old chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: darkMode ? '#9ca3af' : '#6b7280',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)' },
        horzLines: { color: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)' },
      },
      rightPriceScale: {
        borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      },
      timeScale: {
        borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
    });

    for (const s of series) {
      if (s.data.length === 0) continue;

      if (s.type === 'candlestick') {
        const cs = chart.addCandlestickSeries({
          upColor: '#eab308',
          downColor: '#ef4444',
          borderUpColor: '#eab308',
          borderDownColor: '#ef4444',
          wickUpColor: '#eab308',
          wickDownColor: '#ef4444',
          ...s.options,
        });
        cs.setData(s.data as CandlestickData<Time>[]);
      } else if (s.type === 'line') {
        const ls = chart.addLineSeries({
          color: '#eab308',
          lineWidth: 2,
          ...s.options,
        });
        ls.setData(s.data as LineData<Time>[]);
      } else if (s.type === 'histogram') {
        const hs = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          ...s.options,
        });
        hs.setData(s.data as HistogramData<Time>[]);
      }
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;
  }, [series, height, darkMode]);

  useEffect(() => {
    buildChart();

    const container = containerRef.current;
    if (!container || !chartRef.current) return;

    const ro = new ResizeObserver(() => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({ width: container.clientWidth });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  return <div ref={containerRef} className="w-full" />;
}
