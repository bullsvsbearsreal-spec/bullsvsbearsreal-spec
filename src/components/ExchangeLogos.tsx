'use client';

// Exchange logos using real PNG images from /exchanges/ directory
// Lighter uses SVG fallback (no public logo source available)

interface ExchangeLogoProps {
  className?: string;
  size?: number;
}

// Exchanges with real PNG logos in public/exchanges/
const PNG_EXCHANGES = new Set([
  'binance', 'bybit', 'okx', 'bitget', 'deribit', 'htx', 'kucoin',
  'mexc', 'kraken', 'bingx', 'phemex', 'hyperliquid', 'gmx', 'dydx',
  'aevo', 'vertex', 'drift', 'gtrade', 'bitfinex', 'whitebit',
  'coinbase', 'coinex', 'aster',
]);

// SVG fallbacks for exchanges without downloadable logos
function LighterLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#34D399"/>
      <path fill="#FFFFFF" d="M50 35h26v56H50V35zm-10 20h10v16H40V55zm36 0h10v16H86V55z"/>
    </svg>
  );
}

function BitMEXLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#E4002B"/>
      <text x="63" y="74" textAnchor="middle" fill="#FFFFFF" fontWeight="bold" fontSize="28">BMX</text>
    </svg>
  );
}

function GateLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#17E6A1"/>
      <text x="63" y="75" textAnchor="middle" fill="#000000" fontWeight="bold" fontSize="40">G</text>
    </svg>
  );
}

function CryptoComLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#002D74"/>
      <path fill="#FFFFFF" d="M63 30c-18.2 0-33 14.8-33 33s14.8 33 33 33 33-14.8 33-33-14.8-33-33-33zm0 55c-12.1 0-22-9.9-22-22s9.9-22 22-22 22 9.9 22 22-9.9 22-22 22z"/>
    </svg>
  );
}

const svgFallbacks: Record<string, React.ComponentType<ExchangeLogoProps>> = {
  lighter: LighterLogoSVG,
  bitmex: BitMEXLogoSVG,
  gate: GateLogoSVG,
  'gate.io': GateLogoSVG,
  'crypto.com': CryptoComLogoSVG,
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
  lighter: '#34D399',
  bitmex: '#E4002B',
  bitfinex: '#16B157',
  whitebit: '#1A1E2E',
  coinbase: '#0052FF',
  coinex: '#3CC8C8',
  'crypto.com': '#002D74',
};

// Backwards compatibility: keep the old named exports as well
// (some files may import { exchangeLogos })
export const exchangeLogos: Record<string, React.ComponentType<ExchangeLogoProps>> = svgFallbacks;

// Generic exchange logo component
export function ExchangeLogo({ exchange, size = 24, className = '' }: { exchange: string; size?: number; className?: string }) {
  const key = exchange.toLowerCase();

  // Use real PNG if available
  if (PNG_EXCHANGES.has(key)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/exchanges/${key}.png`}
        alt={exchange}
        width={size}
        height={size}
        className={`rounded-sm object-contain ${className}`}
        loading="lazy"
      />
    );
  }

  // SVG fallback for exchanges without PNG
  const SVGComponent = svgFallbacks[key];
  if (SVGComponent) {
    return <SVGComponent size={size} className={className} />;
  }

  // Generic letter fallback
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-hub-gray-light text-white font-bold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {exchange.charAt(0).toUpperCase()}
    </div>
  );
}
