'use client';

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
]);

// SVG fallbacks for exchanges without downloadable logos
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

// edgeX: triangle logo on sky-blue circle
function EdgeXLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#0F172A"/>
      <path d="M63 28L98 93H28L63 28Z" fill="#38BDF8" opacity="0.9"/>
      <path d="M63 45L85 83H41L63 45Z" fill="#0F172A"/>
      <path d="M55 68H71V83H55V68Z" fill="#38BDF8"/>
    </svg>
  );
}

// Variational: stylized "V" on purple circle
function VariationalLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#1A0B2E"/>
      <path d="M38 38L63 93L88 38H76L63 72L50 38H38Z" fill="#E879F9"/>
    </svg>
  );
}

// Extended: stylized "Ex" on amber circle
function ExtendedLogoSVG({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#1C1104"/>
      <text x="63" y="76" textAnchor="middle" fill="#F59E0B" fontWeight="bold" fontSize="38" fontFamily="sans-serif">Ex</text>
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
