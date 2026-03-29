'use client';

import { useRef, useEffect, useCallback, memo } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type LineData, type Time } from 'lightweight-charts';
import { chartOptions, makeLineOptions } from './chartTheme';
import { getExchangeColor } from '../../lib/exchange-colors';
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

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      ...chartOptions,
      width: containerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    // Handle resize
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current.clear();
    };
  }, [height]);

  // Update series data when exchanges or data change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove old series
    Array.from(seriesRef.current.entries()).forEach(([key, series]) => {
      if (!exchanges.includes(key)) {
        chart.removeSeries(series);
        seriesRef.current.delete(key);
      }
    });

    // Add/update series for each exchange
    for (let i = 0; i < exchanges.length; i++) {
      const ex = exchanges[i];
      let series = seriesRef.current.get(ex);

      if (!series) {
        series = chart.addLineSeries(makeLineOptions(getExchangeColor(ex, i), 2, shortName(ex)));
        seriesRef.current.set(ex, series);
      }

      // Build line data
      const lineData: LineData[] = [];
      for (const pt of data) {
        const val = viewMode === 'pct' ? pt[ex + '_dev'] : pt[ex];
        if (typeof val === 'number' && isFinite(val)) {
          lineData.push({
            time: (pt.time / 1000) as Time,
            value: val,
          });
        }
      }

      series.setData(lineData);
    }

    // Format price scale
    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.05 },
    });

    // Auto-fit
    chart.timeScale().fitContent();
  }, [data, exchanges, viewMode]);

  return (
    <div ref={containerRef} className="w-full" data-testid="spread-chart" style={{ height }} />
  );
}

export const SpreadChart = memo(SpreadChartInner);
