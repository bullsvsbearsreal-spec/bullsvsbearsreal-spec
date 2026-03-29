'use client';

import { useState, memo } from 'react';

// Exchange logos using real PNG images from /exchanges/ directory

interface ExchangeLogoProps {
  className?: string;
  size?: number;
}

// Exchanges with real PNG logos in public/exchanges/
const PNG_EXCHANGES = new Set([
  'binance', 'bybit', 'okx', 'bitget', 'deribit', 'htx', 'kucoin',
  'mexc', 'kraken', 'bingx', 'phemex', 'hyperliquid', 'gmx', 'dydx',
  'aevo', 'vertex', 'drift', 'gtrade', 'bitfinex', 'whitebit',
  'coinbase', 'coinex', 'aster', 'bitunix', 'lighter',
  'bitmex', 'gate', 'gate.io', 'edgex', 'variational', 'extended', 'nado',
  'backpack', 'orderly', 'paradex',
]);

// SVG fallbacks only for exchanges without any PNG logo at all
const svgFallbacks: Record<string, React.ComponentType<ExchangeLogoProps>> = {};

// Exchange brand colors for styling
export const exchangeColors: Record<string, string> = {
  binance: '#F3BA2F',
  bybit: '#F7A600',
  okx: '#000000',
  bitget: '#00F0FF',
  deribit: '#1261FF',
  htx: '#1B3E7B',
  gate: '#17E6A1',
  kucoin: '#24AE8F',
  mexc: '#2B6DDE',
  kraken: '#5741D9',
  bingx: '#2354E6',
  phemex: '#C8FF00',
  hyperliquid: '#7AEDC1',
  gmx: '#2D42FC',
  dydx: '#6966FF',
  aevo: '#000000',
  vertex: '#5AB8F5',
  drift: '#8B5CF6',
  gtrade: '#14B8A6',
  aster: '#EC4899',
  lighter: '#1A1A2E',
  bitmex: '#E4002B',
  bitfinex: '#16B157',
  whitebit: '#1A1E2E',
  coinbase: '#0052FF',
  coinex: '#3CC8C8',
  bitunix: '#B9F641',
  extended: '#F59E0B',
  edgex: '#38BDF8',
  variational: '#E879F9',
  nado: '#E4002B',
  backpack: '#E33E3F',
  orderly: '#A78BFA',
  paradex: '#8B5CF6',
};

// Backwards compatibility: keep the old named exports as well
// (some files may import { exchangeLogos })
export const exchangeLogos: Record<string, React.ComponentType<ExchangeLogoProps>> = svgFallbacks;

// Exchanges whose PNGs are dark/transparent and need a light bg pill to be visible on dark UI
const NEEDS_LIGHT_BG = new Set([
  'dydx', 'bingx', 'htx', 'lighter', 'aevo', 'extended',
  'whitebit', 'okx', 'backpack', 'kraken', 'deribit', 'nado',
  'variational', 'drift',
]);

// Normalize exchange key to file-safe name
const FILE_KEY_MAP: Record<string, string> = { 'gate.io': 'gate' };

// Generic exchange logo component
export const ExchangeLogo = memo(function ExchangeLogo({ exchange, size = 24, className = '' }: { exchange: string; size?: number; className?: string }) {
  const key = exchange.toLowerCase();
  const [imgError, setImgError] = useState(false);

  // Use real PNG if available
  if (PNG_EXCHANGES.has(key) && !imgError) {
    const fileKey = FILE_KEY_MAP[key] || key;
    const imgEl = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/exchanges/${fileKey}.png`}
        alt={exchange}
        width={NEEDS_LIGHT_BG.has(key) ? Math.round(size * 0.75) : size}
        height={NEEDS_LIGHT_BG.has(key) ? Math.round(size * 0.75) : size}
        className="object-contain"
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );

    // Dark/transparent PNGs get a light pill background so they're visible on dark UI
    if (NEEDS_LIGHT_BG.has(key)) {
      return (
        <span
          className={`inline-flex items-center justify-center rounded-md ${className}`}
          style={{
            width: size,
            height: size,
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        >
          {imgEl}
        </span>
      );
    }

    return <span className={`inline-flex rounded-sm ${className}`}>{imgEl}</span>;
  }

  // SVG fallback for exchanges without PNG
  const SVGComponent = svgFallbacks[key];
  if (SVGComponent) {
    return <SVGComponent size={size} className={className} />;
  }

  // Generic letter fallback — rounded square with brand-colored letter
  const color = exchangeColors[key] || '#6B7280';
  return (
    <div
      className={`flex items-center justify-center rounded-md font-bold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        backgroundColor: `${color}18`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      {exchange.charAt(0).toUpperCase()}
    </div>
  );
});
