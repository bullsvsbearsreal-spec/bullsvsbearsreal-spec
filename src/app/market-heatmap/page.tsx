'use client';

import { useState, useEffect, useRef } from 'react';
import { TerminalPageTitle } from '@/components/design-system';

/* ─── Types ──────────────────────────────────────────────────────── */

type BlockColor =
  | '24h_close_change|5'
  | '7d_close_change|5'
  | '30d_close_change|5'
  | 'YTD_close_change|5'
  | 'market_cap_calc'
  | '24h_volume|5';

type BlockSize = 'market_cap_calc' | '24h_volume_cap_change_abs|5';

interface ColorOption { id: BlockColor; label: string }
interface SizeOption  { id: BlockSize;  label: string }

const COLOR_OPTIONS: ColorOption[] = [
  { id: '24h_close_change|5',  label: '1D'  },
  { id: '7d_close_change|5',   label: '1W'  },
  { id: '30d_close_change|5',  label: '1M'  },
  { id: 'YTD_close_change|5',  label: 'YTD' },
  { id: 'market_cap_calc',     label: 'Market Cap' },
  { id: '24h_volume|5',        label: 'Volume' },
];

const SIZE_OPTIONS: SizeOption[] = [
  { id: 'market_cap_calc',                label: 'Mcap'   },
  { id: '24h_volume_cap_change_abs|5',    label: 'Volume' },
];

/* ─── TradingView crypto heatmap widget ─────────────────────────── */

function CryptoHeatmapWidget({ blockColor, blockSize }: { blockColor: BlockColor; blockSize: BlockSize }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width  = '100%';

    const widgetInner = document.createElement('div');
    widgetInner.className = 'tradingview-widget-container__widget';
    widgetInner.style.height = '100%';
    widgetInner.style.width  = '100%';

    const script = document.createElement('script');
    script.src  = 'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      dataSource:        'Crypto',
      blockSize:         blockSize,
      blockColor:        blockColor,
      locale:            'en',
      symbolUrl:         '',
      colorTheme:        'dark',
      hasTopBar:         false,
      isDataSetEnabled:  false,
      isZoomEnabled:     true,
      hasSymbolTooltip:  true,
      isMonoSize:        false,
      width:             '100%',
      height:            '100%',
    });

    widgetContainer.appendChild(widgetInner);
    widgetContainer.appendChild(script);
    container.appendChild(widgetContainer);

    return () => {
      container.querySelectorAll('iframe').forEach((iframe) => {
        iframe.src = 'about:blank';
        iframe.remove();
      });
      container.innerHTML = '';
    };
  }, [blockColor, blockSize]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

/* ─── Pill toggle ─────────────────────────────────────────────────── */

function PillToggle<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{
        fontSize: 10, fontWeight: 700,
        color: 'var(--fg-muted)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>{label}</span>
      <div style={{
        display: 'inline-flex',
        background: 'var(--hub-darker)',
        border: '1px solid var(--hub-border-subtle)',
        borderRadius: 8, overflow: 'hidden',
      }}>
        {options.map(o => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: '5px 10px',
              fontSize: 11, fontWeight: 600,
              background: value === o.id ? 'var(--hub-accent)' : 'transparent',
              color: value === o.id ? '#000' : 'var(--fg-muted)',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function MarketHeatmapPage() {
  const [blockColor, setBlockColor] = useState<BlockColor>('24h_close_change|5');
  const [blockSize,  setBlockSize ] = useState<BlockSize>('market_cap_calc');

  return (
    <div
      id="main-content"
      style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Controls bar */}
      <div style={{
        flexShrink: 0,
        padding: '12px 18px',
        borderBottom: '1px solid var(--hub-border-subtle)',
        background: 'rgba(7,9,13,0.6)',
        backdropFilter: 'blur(6px)',
      }}>
        <TerminalPageTitle
          title="MARKET HEATMAP"
          subtitle="Crypto · live · TradingView"
          accent="var(--hub-accent)"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <PillToggle label="Size"     value={blockSize}  options={SIZE_OPTIONS}  onChange={setBlockSize} />
              <PillToggle label="Color by" value={blockColor} options={COLOR_OPTIONS} onChange={setBlockColor} />
            </div>
          }
        />
      </div>

      {/* Heatmap fills remaining vertical space */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#000' }}>
        <CryptoHeatmapWidget blockColor={blockColor} blockSize={blockSize} />
      </div>
    </div>
  );
}
