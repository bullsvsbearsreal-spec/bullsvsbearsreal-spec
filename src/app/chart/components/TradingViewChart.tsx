'use client';

/**
 * TradingView Advanced Chart embed for the /chart terminal.
 *
 * Decisions baked in:
 *  · Top toolbar hidden — our control bar above the chart provides
 *    asset class / symbol / interval / actions, so TV's redundant
 *    top toolbar is just clutter.
 *  · Side toolbar (drawing tools, indicators) kept — power users want it.
 *  · Pure black background, candle colours matched to InfoHub's
 *    yellow/red brand. Grid alpha 3% so structure is just visible
 *    against #000.
 *  · `compareSymbol` overlays via TV's `compareSymbols` config so
 *    pairs share the price axis. Removing the prop tears down the
 *    overlay on the next render.
 */
import { useEffect, useRef, useState } from 'react';

/** TradingView chart-style codes from their widget docs:
 *   '1' candles, '2' bars, '3' line, '8' heikin ashi, '9' area. */
export type ChartStyle = '1' | '2' | '3' | '8' | '9';

export function TradingViewChart({
  tvSymbol,
  interval,
  chartStyle = '1',
  compareSymbol,
}: {
  tvSymbol: string;
  interval: string;
  chartStyle?: ChartStyle;
  compareSymbol?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    setLoading(true);
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    const compareSymbols = compareSymbol
      ? [{ symbol: compareSymbol, position: 'SameScale' as const }]
      : undefined;

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: chartStyle,    // 1 candles · 2 bars · 3 line · 8 heikin · 9 area
      locale: 'en',
      backgroundColor: 'rgba(0, 0, 0, 1)',
      gridColor: 'rgba(255, 255, 255, 0.03)',
      hide_top_toolbar: true,    // we have our own
      hide_legend: false,
      hide_side_toolbar: false,  // drawing tools — keep
      allow_symbol_change: false, // we drive symbol from our picker
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      withdateranges: false,     // bottom date-range toolbar was eating ~30px
      details: false,
      hotlist: false,
      show_popup_button: false,
      ...(compareSymbols ? { compareSymbols } : {}),
      overrides: {
        'paneProperties.backgroundType': 'solid',
        'paneProperties.background': '#000000',
        'mainSeriesProperties.candleStyle.upColor': '#eab308',
        'mainSeriesProperties.candleStyle.downColor': '#ef4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#eab308',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#eab308',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
      },
    });

    script.onload = () => setTimeout(() => setLoading(false), 600);
    script.onerror = () => setLoading(false);

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = '100%';
    widgetInner.style.width = '100%';

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    const container = containerRef.current;
    return () => {
      if (container) container.innerHTML = '';
    };
  }, [tvSymbol, interval, chartStyle, compareSymbol]);

  return (
    <div className="w-full h-full relative bg-black">
      <div ref={containerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black pointer-events-none">
          <div className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
            Loading chart...
          </div>
        </div>
      )}
    </div>
  );
}
