'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';

/* ─── Types ──────────────────────────────────────────────────────── */

type DataSource = 'SPX500' | 'AllUSA' | 'AllWorld' | 'Crypto';
type BlockColor = 'change' | 'Perf.W' | 'Perf.1M' | 'Perf.YTD' | 'market_cap_basic' | 'volume';

interface SourceOption { id: DataSource; label: string }
interface ColorOption { id: BlockColor; label: string }

const DATA_SOURCES: SourceOption[] = [
  { id: 'SPX500', label: 'S&P 500' },
  { id: 'AllUSA', label: 'All US' },
  { id: 'AllWorld', label: 'World' },
  { id: 'Crypto', label: 'Crypto' },
];

const COLOR_OPTIONS: ColorOption[] = [
  { id: 'change', label: '1D' },
  { id: 'Perf.W', label: '1W' },
  { id: 'Perf.1M', label: '1M' },
  { id: 'Perf.YTD', label: 'YTD' },
  { id: 'market_cap_basic', label: 'Market Cap' },
  { id: 'volume', label: 'Volume' },
];

/* ─── Widget ─────────────────────────────────────────────────────── */

function StockHeatmapWidget({ dataSource, blockColor }: { dataSource: DataSource; blockColor: BlockColor }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = '100%';
    widgetInner.style.width = '100%';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    script.type = 'text/javascript';
    script.async = true;

    const isCrypto = dataSource === 'Crypto';
    script.innerHTML = JSON.stringify({
      exchanges: [],
      dataSource: dataSource,
      grouping: isCrypto ? 'no_group' : 'sector',
      blockSize: 'market_cap_basic',
      blockColor: blockColor,
      locale: 'en',
      symbolUrl: '',
      colorTheme: 'dark',
      hasTopBar: false,
      isDataSet498Enabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    });

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    container.appendChild(widgetContainer);

    return () => {
      // Remove all iframes (TradingView widgets) to release their connections
      container.querySelectorAll('iframe').forEach((iframe) => {
        iframe.src = 'about:blank';
        iframe.remove();
      });
      container.innerHTML = '';
    };
  }, [dataSource, blockColor]);

  return <div ref={containerRef} className="w-full h-full" />;
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function StockHeatmapPage() {
  const [dataSource, setDataSource] = useState<DataSource>('SPX500');
  const [blockColor, setBlockColor] = useState<BlockColor>('change');

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <Header />

      {/* Controls bar */}
      <div className="shrink-0 border-b border-white/[0.06] bg-black/80 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex flex-wrap items-center gap-4">
          <h1 className="text-sm font-bold text-white">Stock Heatmap</h1>

          <div className="flex-1" />

          {/* Data source toggle */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500 mr-1.5">Market:</span>
            {DATA_SOURCES.map(s => (
              <button
                key={s.id}
                onClick={() => setDataSource(s.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  dataSource === s.id
                    ? 'bg-hub-yellow/15 text-hub-yellow'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Color-by toggle */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500 mr-1.5">Color by:</span>
            {COLOR_OPTIONS.map(c => (
              <button
                key={c.id}
                onClick={() => setBlockColor(c.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  blockColor === c.id
                    ? 'bg-hub-yellow/15 text-hub-yellow'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap widget — fills all remaining space */}
      <div className="flex-1 min-h-0">
        <StockHeatmapWidget dataSource={dataSource} blockColor={blockColor} />
      </div>
    </div>
  );
}
