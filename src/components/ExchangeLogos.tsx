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
  'blofin', 'backpack', 'orderly', 'paradex',
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

// Nado: black background with white storm/trident mark
function NadoLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} className={className}>
      <rect width="256" height="256" rx="8" fill="black"/>
      <path d="M94.284 145.768L160.639 219.178L165.812 222L181.58L184.872 218.708V192.354L182.521 186.941L142.289 141.528C132.173 130.232 124.408 119.877 109.581 117.055L111.463 110.702L101.578 111.882L92.634 140.587L94.284 145.761V145.768ZM144.879 65.296L47.938 85.767L42.764 88.828L35 102.706L36.411 107.178L59.233 120.355L64.877 121.065L124.408 108.829C139.235 105.767 152.173 104.125 162.058 92.83L167.231 98.242L171.233 89.067L150.053 66.476L144.879 65.304V65.296ZM189.815 148.822L220.401 54.702V48.588L212.398 34.941L207.695 34L184.872 47.177L181.341 51.649L162.281 109.299C157.578 123.656 152.396 135.653 157.339 150.001L150.045 151.651L155.928 159.655L186.044 152.831L189.807 148.83L189.815 148.822Z" fill="white"/>
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

// Paradex: purple/violet with "P" geometric mark
function ParadexLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect rx="16" width="126" height="126" fill="#1A0530"/>
      <path d="M48 35h25c12 0 22 10 22 22s-10 22-22 22H58v12H48V35zm10 34h15c7 0 12-5 12-12s-5-12-12-12H58v24z" fill="#8B5CF6"/>
    </svg>
  );
}

// BloFin: green with "B" shield mark
function BloFinLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect rx="16" width="126" height="126" fill="#0D1117"/>
      <circle cx="63" cy="63" r="35" fill="#00D084" opacity="0.2"/>
      <text x="63" y="75" textAnchor="middle" fill="#00D084" fontSize="52" fontWeight="bold" fontFamily="Arial">B</text>
    </svg>
  );
}

// Backpack: red with backpack silhouette
function BackpackLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect rx="16" width="126" height="126" fill="#1A1A2E"/>
      <rect x="40" y="45" width="46" height="50" rx="8" fill="#E33E3F"/>
      <rect x="48" y="35" width="30" height="18" rx="6" fill="none" stroke="#E33E3F" strokeWidth="5"/>
      <rect x="50" y="60" width="26" height="12" rx="3" fill="#1A1A2E"/>
    </svg>
  );
}

// Orderly: purple with order-book-like bars
function OrderlyLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect rx="16" width="126" height="126" fill="#0F0A1F"/>
      <rect x="35" y="40" width="56" height="8" rx="2" fill="#A78BFA"/>
      <rect x="35" y="55" width="42" height="8" rx="2" fill="#A78BFA" opacity="0.7"/>
      <rect x="35" y="70" width="50" height="8" rx="2" fill="#A78BFA" opacity="0.5"/>
      <rect x="35" y="85" width="36" height="8" rx="2" fill="#A78BFA" opacity="0.3"/>
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
  nado: NadoLogoSVG,
  blofin: BloFinLogoSVG,
  backpack: BackpackLogoSVG,
  orderly: OrderlyLogoSVG,
  paradex: ParadexLogoSVG,
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
  nado: '#E4002B',
  blofin: '#00D084',
  backpack: '#E33E3F',
  orderly: '#A78BFA',
  paradex: '#8B5CF6',
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
