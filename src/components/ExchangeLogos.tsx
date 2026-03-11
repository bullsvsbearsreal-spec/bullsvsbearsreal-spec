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
  'bitmex', 'gate', 'gate.io', 'edgex', 'variational', 'extended',
]);

// SVG fallbacks for exchanges without downloadable logos
// BitMEX: red shield-shaped mark with angular "B"
function BitMEXLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect rx="16" width="126" height="126" fill="#E4002B"/>
      <path d="M40 32h30l16 24-16 24h8l16-24 16 24H80L63 56l17-24H40z" fill="#fff" opacity="0.95"/>
      <rect x="40" y="32" width="6" height="63" rx="3" fill="#fff" opacity="0.95"/>
    </svg>
  );
}

// Gate.io: green with split-gate geometric mark
function GateLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect rx="16" width="126" height="126" fill="#17E6A1"/>
      <rect x="35" y="35" width="56" height="56" rx="8" fill="none" stroke="#000" strokeWidth="8"/>
      <rect x="63" y="55" width="28" height="8" fill="#000"/>
      <rect x="63" y="55" width="8" height="28" fill="#000"/>
    </svg>
  );
}

// edgeX: dark background with geometric edge/arrow mark
function EdgeXLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect rx="16" width="126" height="126" fill="#0F172A"/>
      <path d="M32 63L63 32L94 63L63 94Z" fill="none" stroke="#38BDF8" strokeWidth="6"/>
      <path d="M50 63L63 50L76 63L63 76Z" fill="#38BDF8"/>
    </svg>
  );
}

// Variational: purple with sigma/integral-like curve
function VariationalLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect rx="16" width="126" height="126" fill="#1A0B2E"/>
      <path d="M45 35L75 35L58 63L75 91L45 91L62 63Z" fill="#E879F9" strokeLinejoin="round"/>
      <circle cx="80" cy="40" r="5" fill="#E879F9" opacity="0.5"/>
    </svg>
  );
}

// Extended: amber accent with "×" geometric cross
function ExtendedLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect rx="16" width="126" height="126" fill="#1C1104"/>
      <path d="M38 38L88 88M88 38L38 88" stroke="#F59E0B" strokeWidth="10" strokeLinecap="round"/>
      <circle cx="63" cy="63" r="10" fill="#F59E0B"/>
    </svg>
  );
}

const svgFallbacks: Record<string, React.ComponentType<ExchangeLogoProps>> = {
  bitmex: BitMEXLogoSVG,
  gate: GateLogoSVG,
  'gate.io': GateLogoSVG,
  edgex: EdgeXLogoSVG,
  variational: VariationalLogoSVG,
  extended: ExtendedLogoSVG,
};

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
};

// Backwards compatibility: keep the old named exports as well
// (some files may import { exchangeLogos })
export const exchangeLogos: Record<string, React.ComponentType<ExchangeLogoProps>> = svgFallbacks;

// Normalize exchange key to file-safe name
const FILE_KEY_MAP: Record<string, string> = { 'gate.io': 'gate' };

// Generic exchange logo component
export const ExchangeLogo = memo(function ExchangeLogo({ exchange, size = 24, className = '' }: { exchange: string; size?: number; className?: string }) {
  const key = exchange.toLowerCase();
  const [imgError, setImgError] = useState(false);

  // Use real PNG if available (with error fallback to SVG/letter)
  if (PNG_EXCHANGES.has(key) && !imgError) {
    const fileKey = FILE_KEY_MAP[key] || key;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/exchanges/${fileKey}.png`}
        alt={exchange}
        width={size}
        height={size}
        className={`rounded-sm object-contain ${className}`}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
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
