'use client';

import { useRef, useEffect, useCallback, useState, memo } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type LineData, type Time, type MouseEventParams } from 'lightweight-charts';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { chartOptions, makeLineOptions } from './chartTheme';
import { getExchangeColor, getLineStyle } from '../../lib/exchange-colors';
import { fp } from '../../lib/spread-math';
import type { Pt, ViewMode } from '../../lib/types';

/** Short labels so price-scale tags don't overlap */
const SHORT: Record<string, string> = {
  Binance: 'Bin', Bybit: 'Byb', Bitget: 'Btg', Kraken: 'Kra',
  Hyperliquid: 'HL', Coinbase: 'CB', Bitfinex: 'Bfx', WhiteBIT: 'WB',
  BingX: 'BgX', Phemex: 'Phx', Bitunix: 'Bux', KuCoin: 'KC',
  Deribit: 'Drb', BitMEX: 'BMX', 'Gate.io': 'Gte',
  Extended: 'Ext', Variational: 'Var', Lighter: 'Ltr',
  Paradex: 'Pdx', Backpack: 'Bpk', Orderly: 'Ord',
};
function shortName(ex: string) { return SHORT[ex] || ex.slice(0, 3); }

interface TooltipRow {
  exchange: string;
  color: string;
  value: number;
}

interface SpreadChartProps {
  data: Pt[];
  exchanges: string[];
  viewMode: ViewMode;
  height?: number;
}

function SpreadChartInner({ data, exchanges, viewMode, height = 420 }: SpreadChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const isInitialFit = useRef(true);
  const prevExchangesRef = useRef<string[]>([]);
  const outlierSetRef = useRef<Set<string>>(new Set());
  const exchangesRef = useRef<string[]>(exchanges);
  exchangesRef.current = exchanges;
  const [tooltip, setTooltip] = useState<{ x: number; y: number; rows: TooltipRow[]; time: string } | null>(null);

  // Zoom controls
  const zoomIn = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const center = (range.from + range.to) / 2;
    const halfSpan = (range.to - range.from) / 2;
    ts.setVisibleLogicalRange({ from: center - halfSpan * 0.6, to: center + halfSpan * 0.6 });
  }, []);

  const zoomOut = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const center = (range.from + range.to) / 2;
    const halfSpan = (range.to - range.from) / 2;
    ts.setVisibleLogicalRange({ from: center - halfSpan * 1.6, to: center + halfSpan * 1.6 });
  }, []);

  const resetZoom = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      ...chartOptions,
      width: containerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;
    isInitialFit.current = true;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    // Crosshair move handler for tooltip
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const rows: TooltipRow[] = [];
      for (const [ex, series] of Array.from(seriesRef.current.entries())) {
        const d = param.seriesData.get(series) as LineData | undefined;
        if (d && typeof d.value === 'number') {
          const idx = exchangesRef.current.indexOf(ex);
          rows.push({ exchange: ex, color: getExchangeColor(ex, idx >= 0 ? idx : 0), value: d.value });
        }
      }

      if (rows.length === 0) {
        setTooltip(null);
        return;
      }

      rows.sort((a, b) => b.value - a.value);

      // Format time
      const ts = typeof param.time === 'number' ? param.time * 1000 : 0;
      const timeStr = ts > 0 ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      setTooltip({ x: param.point.x, y: param.point.y, rows, time: timeStr });
    });

    return () => {
      chart.remove();
      ro.disconnect();
      chartRef.current = null;
      seriesRef.current.clear();
    };
  }, [height]);

  // Update series data
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const exchangesChanged = exchanges.length !== prevExchangesRef.current.length
      || exchanges.some((e, i) => e !== prevExchangesRef.current[i]);
    prevExchangesRef.current = exchanges;

    // Detect outliers — exchanges far from median or with stale (flat) data
    // get pushed to a separate hidden scale so they don't squash the main view.
    const outlierExchanges = new Set<string>();
    if (viewMode === 'price' && data.length > 0) {
      const last = data[data.length - 1];
      const prices = exchanges
        .map(e => ({ e, p: last[e] as number }))
        .filter(x => typeof x.p === 'number' && x.p > 0);
      if (prices.length >= 3) {
        const sorted = prices.map(x => x.p).sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        // 0.5% of median — catches sub-percent gaps that flat-line a venue
        const threshold = Math.max(median * 0.005, 1);
        for (const x of prices) {
          if (Math.abs(x.p - median) > threshold) outlierExchanges.add(x.e);
        }
      }

      // Stale-data detection — a venue whose range over the time window is
      // < 0.05% of median while others are moving is likely a stuck feed.
      if (data.length >= 4 && prices.length >= 3) {
        const med = prices.map(x => x.p).sort((a, b) => a - b)[Math.floor(prices.length / 2)];
        const flatThreshold = Math.max(med * 0.0005, 1);
        for (const ex of exchanges) {
          let lo = Infinity, hi = -Infinity, n = 0;
          for (const pt of data) {
            const v = pt[ex] as number;
            if (typeof v === 'number' && v > 0) {
              if (v < lo) lo = v;
              if (v > hi) hi = v;
              n++;
            }
          }
          if (n >= 4 && hi - lo < flatThreshold) outlierExchanges.add(ex);
        }
      }
    }

    // Remove old series
    for (const [key, series] of Array.from(seriesRef.current.entries())) {
      if (!exchanges.includes(key)) {
        chart.removeSeries(series);
        seriesRef.current.delete(key);
      }
    }

    // Re-create series if outlier status changed
    const prevOutliers = outlierSetRef.current;
    for (const [key, series] of Array.from(seriesRef.current.entries())) {
      if (prevOutliers.has(key) !== outlierExchanges.has(key)) {
        chart.removeSeries(series);
        seriesRef.current.delete(key);
      }
    }
    outlierSetRef.current = new Set(outlierExchanges);

    // Add/update series
    for (let i = 0; i < exchanges.length; i++) {
      const ex = exchanges[i];
      let series = seriesRef.current.get(ex);
      const isOutlier = outlierExchanges.has(ex);

      if (!series) {
        // All series use width 2 so tightly-clustered lines are still visible.
        const lw: 1 | 2 | 3 | 4 = 2;
        const opts = makeLineOptions(getExchangeColor(ex, i), lw, shortName(ex), getLineStyle(i));
        if (isOutlier) {
          (opts as any).priceScaleId = `outlier_${ex}`;
          opts.lineWidth = 1;
          opts.lineStyle = 2;
        }
        series = chart.addLineSeries(opts);
        if (isOutlier) {
          chart.priceScale(`outlier_${ex}`).applyOptions({ visible: false });
        }
        seriesRef.current.set(ex, series);
      }

      const lineData: LineData[] = [];
      for (const pt of data) {
        const val = viewMode === 'pct' ? pt[ex + '_dev'] : pt[ex];
        if (typeof val === 'number' && isFinite(val)) {
          lineData.push({ time: (pt.time / 1000) as Time, value: val });
        }
      }
      series.setData(lineData);
    }

    // Only auto-fit on initial load or exchange change
    if (isInitialFit.current || exchangesChanged) {
      chart.timeScale().fitContent();
      // Also force the price scale to auto-fit so tight data ranges fill the chart
      chart.priceScale('right').applyOptions({ autoScale: true });
      isInitialFit.current = false;
    }
  }, [data, exchanges, viewMode]);

  const isPct = viewMode === 'pct';

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" data-testid="spread-chart" />

      {/* Zoom controls */}
      <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
        <button onClick={zoomIn} className="p-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-neutral-400 hover:text-white transition-colors" title="Zoom in">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={zoomOut} className="p-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-neutral-400 hover:text-white transition-colors" title="Zoom out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button onClick={resetZoom} className="p-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-neutral-400 hover:text-white transition-colors" title="Reset zoom">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Crosshair tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: Math.min(tooltip.x + 16, (containerRef.current?.clientWidth ?? 800) - 180),
            top: Math.max(tooltip.y - 10, 4),
          }}
        >
          <div className="bg-[#13161e]/95 backdrop-blur-sm border border-white/[0.08] rounded-lg px-2.5 py-2 shadow-xl min-w-[140px]">
            {tooltip.time && (
              <div className="text-[9px] text-neutral-500 font-mono mb-1.5 border-b border-white/[0.06] pb-1">{tooltip.time}</div>
            )}
            <div className="flex flex-col gap-[3px]">
              {tooltip.rows.map((r, i) => {
                const isTop = i === 0;
                const isBot = i === tooltip.rows.length - 1 && tooltip.rows.length > 1;
                return (
                  <div key={r.exchange} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
                      <span className={`text-[10px] font-medium ${isTop ? 'text-green-400' : isBot ? 'text-red-400' : 'text-neutral-300'}`}>
                        {r.exchange}
                      </span>
                    </div>
                    <span className={`font-mono text-[10px] tabular-nums font-semibold ${isTop ? 'text-green-400' : isBot ? 'text-red-400' : 'text-white'}`}>
                      {isPct ? `${r.value.toFixed(3)}%` : `$${fp(r.value)}`}
                    </span>
                  </div>
                );
              })}
              {/* Spread at bottom */}
              {tooltip.rows.length >= 2 && (
                <>
                  <div className="border-t border-white/[0.06] mt-0.5 pt-1 flex items-center justify-between">
                    <span className="text-[9px] text-neutral-500 font-medium">Spread</span>
                    <span className="font-mono text-[10px] text-hub-yellow font-bold tabular-nums">
                      {isPct
                        ? `${(tooltip.rows[0].value - tooltip.rows[tooltip.rows.length - 1].value).toFixed(3)}%`
                        : `$${fp(tooltip.rows[0].value - tooltip.rows[tooltip.rows.length - 1].value)}`
                      }
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const SpreadChart = memo(SpreadChartInner);
