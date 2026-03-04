'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type Time,
} from 'lightweight-charts';

/* ─── Types ──────────────────────────────────────────────────────── */

interface TimeValue {
  time: number;
  value: number;
}

interface TimePrice {
  time: number;
  price: number;
}

interface PiCycleData {
  ma111: TimeValue[];
  ma350x2: TimeValue[];
  signal: 'neutral' | 'approaching_top' | 'approaching_bottom';
}

interface RainbowBand {
  label: string;
  color: string;
  values: TimeValue[];
}

interface RainbowData {
  bands: RainbowBand[];
  currentBand: string;
}

interface WeeklyMA200Data {
  ma: TimeValue[];
  rateOfChange: TimeValue[];
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function getRocColor(roc: number): string {
  if (roc <= 0) return '#3b82f6';
  if (roc < 2) return '#06b6d4';
  if (roc < 4) return '#22c55e';
  if (roc < 6) return '#eab308';
  if (roc < 8) return '#f97316';
  return '#ef4444';
}

function createBaseChart(container: HTMLDivElement, height: number): IChartApi {
  return createChart(container, {
    width: container.clientWidth,
    height,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#9ca3af',
      fontSize: 11,
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.04)' },
      horzLines: { color: 'rgba(255,255,255,0.04)' },
    },
    rightPriceScale: {
      borderColor: 'rgba(255,255,255,0.08)',
    },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: CrosshairMode.Normal,
    },
  });
}

/* ─── Chart Components ───────────────────────────────────────────── */

export function PiCycleChart({ prices, piCycle }: { prices: TimePrice[]; piCycle: PiCycleData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createBaseChart(containerRef.current, 350);

    const priceSeries = chart.addLineSeries({
      color: '#eab308',
      lineWidth: 2,
      title: 'BTC Price',
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    const ma111Series = chart.addLineSeries({
      color: '#06b6d4',
      lineWidth: 2,
      title: '111-day MA',
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    const ma350x2Series = chart.addLineSeries({
      color: '#ec4899',
      lineWidth: 2,
      title: '350-day MA x2',
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    priceSeries.setData(
      prices.map((p) => ({ time: p.time as Time, value: p.price }))
    );

    ma111Series.setData(
      piCycle.ma111.map((p) => ({ time: p.time as Time, value: p.value }))
    );

    ma350x2Series.setData(
      piCycle.ma350x2.map((p) => ({ time: p.time as Time, value: p.value }))
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [prices, piCycle]);

  return <div ref={containerRef} className="w-full" />;
}

export function RainbowChartComponent({ prices, rainbow }: { prices: TimePrice[]; rainbow: RainbowData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createBaseChart(containerRef.current, 350);

    // Add bands from highest to lowest so lower bands render on top
    const reversedBands = [...rainbow.bands].reverse();

    for (const band of reversedBands) {
      if (band.values.length === 0) continue;

      const areaSeries = chart.addAreaSeries({
        topColor: `${band.color}33`,
        bottomColor: `${band.color}08`,
        lineColor: band.color,
        lineWidth: 1,
        priceFormat: { type: 'price', precision: 0, minMove: 1 },
      });

      areaSeries.setData(
        band.values.map((v) => ({ time: v.time as Time, value: v.value }))
      );
    }

    // BTC price line on top
    const priceLine = chart.addLineSeries({
      color: '#ffffff',
      lineWidth: 2,
      title: 'BTC Price',
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    priceLine.setData(
      prices.map((p) => ({ time: p.time as Time, value: p.price }))
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [prices, rainbow]);

  return <div ref={containerRef} className="w-full" />;
}

export function WeeklyMAChart({ prices, weeklyMA200 }: { prices: TimePrice[]; weeklyMA200: WeeklyMA200Data }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createBaseChart(containerRef.current, 300);

    const priceSeries = chart.addLineSeries({
      color: 'rgba(255,255,255,0.3)',
      lineWidth: 1,
      title: 'BTC Price',
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    priceSeries.setData(
      prices.map((p) => ({ time: p.time as Time, value: p.price }))
    );

    // 200-week MA colored line
    const latestRoc = weeklyMA200.rateOfChange.length > 0
      ? weeklyMA200.rateOfChange[weeklyMA200.rateOfChange.length - 1].value
      : 0;

    const maSeries = chart.addLineSeries({
      color: getRocColor(latestRoc),
      lineWidth: 3,
      title: '200-Week MA',
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    maSeries.setData(
      weeklyMA200.ma.map((p) => ({ time: p.time as Time, value: p.value }))
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [prices, weeklyMA200]);

  return <div ref={containerRef} className="w-full" />;
}
