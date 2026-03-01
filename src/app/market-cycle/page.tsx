'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UpdatedAgo from '@/components/UpdatedAgo';
import { RefreshCw, Activity, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
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

interface StockToFlowData {
  ratio: number;
  modelPrice: number;
  actualPrice: number;
  deviation: number;
}

interface MarketCycleData {
  prices: TimePrice[];
  piCycle: PiCycleData;
  rainbow: RainbowData;
  weeklyMA200: WeeklyMA200Data;
  stockToFlow: StockToFlowData;
  timestamp: number;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const REFRESH_INTERVAL = 5 * 60 * 1000;

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function getRocColor(roc: number): string {
  if (roc <= 0) return '#3b82f6';
  if (roc < 2) return '#06b6d4';
  if (roc < 4) return '#22c55e';
  if (roc < 6) return '#eab308';
  if (roc < 8) return '#f97316';
  return '#ef4444';
}

function getSignalConfig(signal: PiCycleData['signal']): { label: string; color: string; bg: string } {
  switch (signal) {
    case 'approaching_top':
      return { label: 'Approaching Top', color: '#ef4444', bg: 'bg-red-500/10' };
    case 'approaching_bottom':
      return { label: 'Approaching Bottom', color: '#22c55e', bg: 'bg-green-500/10' };
    default:
      return { label: 'Neutral', color: '#9ca3af', bg: 'bg-white/[0.04]' };
  }
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

function PiCycleChart({ prices, piCycle }: { prices: TimePrice[]; piCycle: PiCycleData }) {
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

function RainbowChartComponent({ prices, rainbow }: { prices: TimePrice[]; rainbow: RainbowData }) {
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

function WeeklyMAChart({ prices, weeklyMA200 }: { prices: TimePrice[]; weeklyMA200: WeeklyMA200Data }) {
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
    // Since lightweight-charts v4 doesn't support per-point coloring on a single
    // line series, we use a solid line and note the current RoC in the UI.
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

/* ─── Skeleton Loaders ───────────────────────────────────────────── */

function ChartSkeleton({ height = 350 }: { height?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-40 bg-white/[0.06] rounded mb-4" />
      <div className="rounded-lg bg-white/[0.04]" style={{ height }} />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 animate-pulse">
      <div className="h-4 w-32 bg-white/[0.06] rounded mb-4" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="h-3 w-20 bg-white/[0.06] rounded mb-2" />
            <div className="h-8 w-24 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page Component ────────────────────────────────────────── */

export default function MarketCyclePage() {
  const [data, setData] = useState<MarketCycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await fetch('/api/market-cycle');
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const signalConfig = data ? getSignalConfig(data.piCycle.signal) : null;

  const latestRoc = data && data.weeklyMA200.rateOfChange.length > 0
    ? data.weeklyMA200.rateOfChange[data.weeklyMA200.rateOfChange.length - 1].value
    : null;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="heading-page flex items-center gap-2">
              <Activity className="w-6 h-6 text-hub-yellow" />
              Market Cycle Indicators
            </h1>
            <p className="text-neutral-600 text-xs mt-0.5">
              Bitcoin on-chain models and technical cycle indicators
            </p>
          </div>
          <div className="flex items-center gap-3">
            <UpdatedAgo date={lastUpdated} />
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-white transition-colors text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-6 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button
              onClick={() => fetchData(true)}
              className="ml-auto text-xs text-hub-yellow hover:underline whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <ChartSkeleton height={350} />
            </div>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <ChartSkeleton height={350} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <ChartSkeleton height={300} />
              </div>
              <CardSkeleton />
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* ─── 1. Pi Cycle Top/Bottom Indicator ─────────────────── */}
            <section className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Pi Cycle Top / Bottom Indicator</h2>
                  <p className="text-neutral-500 text-xs mt-1">
                    When the 111-day MA crosses above the 350-day MA &times; 2, it has historically signaled cycle tops.
                  </p>
                </div>
                {signalConfig && (
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${signalConfig.bg}`}
                    style={{ color: signalConfig.color }}
                  >
                    {signalConfig.label}
                  </span>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded bg-[#eab308]" />
                  <span className="text-xs text-neutral-400">BTC Price</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded bg-[#06b6d4]" />
                  <span className="text-xs text-neutral-400">111-day MA</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded bg-[#ec4899]" />
                  <span className="text-xs text-neutral-400">350-day MA &times; 2</span>
                </div>
              </div>

              {/* Pi Cycle distance indicator */}
              {data.piCycle.ma111.length > 0 && data.piCycle.ma350x2.length > 0 && (() => {
                const latest111 = data.piCycle.ma111[data.piCycle.ma111.length - 1].value;
                const latest350x2 = data.piCycle.ma350x2[data.piCycle.ma350x2.length - 1].value;
                const gap = latest350x2 > 0 ? ((latest350x2 - latest111) / latest350x2) * 100 : 0;
                return (
                  <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <span className="text-xs text-neutral-500">MA gap:</span>
                    <span className={`text-sm font-mono font-semibold ${gap > 20 ? 'text-green-400' : gap > 5 ? 'text-amber-400' : 'text-red-400'}`}>
                      {gap.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-neutral-600">
                      {gap > 20 ? '— far from crossover' : gap > 5 ? '— narrowing' : '— very close to signal'}
                    </span>
                    <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full ml-2 max-w-[120px]">
                      <div
                        className={`h-full rounded-full transition-all ${gap > 20 ? 'bg-green-500' : gap > 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, Math.max(2, 100 - gap))}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              <PiCycleChart prices={data.prices} piCycle={data.piCycle} />
            </section>

            {/* ─── 2. Rainbow Chart ────────────────────────────────── */}
            <section className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Rainbow Chart</h2>
                  <p className="text-neutral-500 text-xs mt-1">
                    Logarithmic regression bands showing where BTC sits in its long-term valuation cycle.
                  </p>
                </div>
                {data.rainbow.currentBand && (
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/[0.06] text-white whitespace-nowrap">
                    Current: {data.rainbow.currentBand}
                  </span>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded bg-white" />
                  <span className="text-xs text-neutral-400">BTC Price</span>
                </div>
                {data.rainbow.bands.map((band) => (
                  <div key={band.label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: band.color, opacity: 0.7 }} />
                    <span className="text-xs text-neutral-400">{band.label}</span>
                  </div>
                ))}
              </div>

              <RainbowChartComponent prices={data.prices} rainbow={data.rainbow} />
            </section>

            {/* ─── Bottom Row: 200-Week MA + Stock-to-Flow ─────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ─── 3. 200-Week MA Heatmap ───────────────────────── */}
              <section className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">200-Week MA Heatmap</h2>
                  <p className="text-neutral-500 text-xs mt-1">
                    The 200-week MA colored by its month-over-month rate of change. Blue indicates slow growth (accumulation zones), red indicates rapid growth (overheated market).
                  </p>
                </div>

                {/* Rate of Change indicator */}
                {latestRoc !== null && (
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-neutral-500">Current Rate of Change:</span>
                    <span
                      className="text-sm font-mono font-semibold"
                      style={{ color: getRocColor(latestRoc) }}
                    >
                      {latestRoc >= 0 ? '+' : ''}{latestRoc.toFixed(2)}%
                    </span>
                    <div className="flex items-center gap-1 ml-2">
                      {[
                        { color: '#3b82f6', label: 'Slow' },
                        { color: '#06b6d4', label: '' },
                        { color: '#22c55e', label: '' },
                        { color: '#eab308', label: '' },
                        { color: '#f97316', label: '' },
                        { color: '#ef4444', label: 'Fast' },
                      ].map((c, i) => (
                        <div key={i} className="flex flex-col items-center">
                          <div className="w-4 h-2 rounded-sm" style={{ backgroundColor: c.color }} />
                          {c.label && (
                            <span className="text-[9px] text-neutral-600 mt-0.5">{c.label}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 rounded bg-white/30" />
                    <span className="text-xs text-neutral-400">BTC Price</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: getRocColor(latestRoc ?? 0) }} />
                    <span className="text-xs text-neutral-400">200-Week MA</span>
                  </div>
                </div>

                <WeeklyMAChart prices={data.prices} weeklyMA200={data.weeklyMA200} />
              </section>

              {/* ─── 4. Stock-to-Flow Model ────────────────────────── */}
              <section className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-white">Stock-to-Flow Model</h2>
                  <p className="text-neutral-500 text-xs mt-1">
                    Compares Bitcoin&apos;s scarcity ratio against PlanB&apos;s original S2F pricing model.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* S2F Ratio */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <p className="text-xs text-neutral-500 mb-1">S2F Ratio</p>
                    <p className="text-3xl font-bold text-white font-mono">
                      {data.stockToFlow.ratio.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-neutral-600 mt-1">Stock / Annual Flow</p>
                  </div>

                  {/* Model Price */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <p className="text-xs text-neutral-500 mb-1">Model Price</p>
                    <p className="text-3xl font-bold text-white font-mono">
                      {formatUsd(data.stockToFlow.modelPrice)}
                    </p>
                    <p className="text-[10px] text-neutral-600 mt-1">S2F predicted</p>
                  </div>

                  {/* Actual Price */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <p className="text-xs text-neutral-500 mb-1">Actual Price</p>
                    <p className="text-3xl font-bold text-hub-yellow font-mono">
                      {formatUsd(data.stockToFlow.actualPrice)}
                    </p>
                    <p className="text-[10px] text-neutral-600 mt-1">Current BTC/USD</p>
                  </div>

                  {/* Deviation */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <p className="text-xs text-neutral-500 mb-1">Deviation</p>
                    <div className="flex items-center gap-2">
                      {data.stockToFlow.deviation >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                      <p
                        className="text-3xl font-bold font-mono"
                        style={{ color: data.stockToFlow.deviation >= 0 ? '#4ade80' : '#ef4444' }}
                      >
                        {data.stockToFlow.deviation >= 0 ? '+' : ''}{data.stockToFlow.deviation.toFixed(1)}%
                      </p>
                    </div>
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      data.stockToFlow.deviation < -50 ? 'bg-green-500/15 text-green-400'
                      : data.stockToFlow.deviation < -20 ? 'bg-amber-500/15 text-amber-400'
                      : data.stockToFlow.deviation < 20 ? 'bg-white/[0.06] text-neutral-400'
                      : data.stockToFlow.deviation < 100 ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-red-500/15 text-red-400'
                    }`}>
                      {data.stockToFlow.deviation < -50 ? 'Deeply undervalued'
                      : data.stockToFlow.deviation < -20 ? 'Below model'
                      : data.stockToFlow.deviation < 20 ? 'Near model'
                      : data.stockToFlow.deviation < 100 ? 'Above model'
                      : 'Overextended'}
                    </span>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="mt-6 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
                  <p className="text-neutral-500 text-[11px] leading-relaxed">
                    Based on PlanB&apos;s original S2F model. This model has significant limitations &mdash; it does not account for demand-side factors, regulatory changes, or competing assets. It should not be used as investment advice.
                  </p>
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {/* Footer info */}
        {data && (
          <div className="mt-6 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            <p className="text-neutral-500 text-xs leading-relaxed">
              Market cycle indicators use daily BTC price data from CoinGecko. Pi Cycle uses the 111-day and 350-day moving averages to identify potential tops and bottoms. The Rainbow Chart fits a logarithmic regression to historical price data. The 200-Week MA Heatmap tracks the rate of change of the long-term moving average. Stock-to-Flow models Bitcoin&apos;s scarcity using supply and issuance rate. These indicators are for educational purposes only &mdash; past patterns do not guarantee future outcomes. Data refreshes every 5 minutes.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
