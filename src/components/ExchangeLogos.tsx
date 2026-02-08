'use client';

// Exchange logo components using official brand colors
// These are simplified representations of exchange logos

interface ExchangeLogoProps {
  className?: string;
  size?: number;
}

export function BinanceLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#F3BA2F"/>
      <path fill="#FFFFFF" d="M63 28.2L77.4 42.8 54.7 65.5 40.3 51.1zM86.8 51.1L101.2 65.5 63 103.7 24.8 65.5 39.2 51.1 63 74.9zM24.8 51.1L39.2 36.7 63 60.5 86.8 36.7 101.2 51.1 63 89.3z"/>
    </svg>
  );
}

export function BybitLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#F7A600"/>
      <path fill="#FFFFFF" d="M35 45h20v36H35V45zm36 0h20v36H71V45z"/>
    </svg>
  );
}

export function OKXLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <rect width="126" height="126" rx="20" fill="#000000"/>
      <rect x="23" y="23" width="26" height="26" rx="4" fill="#FFFFFF"/>
      <rect x="50" y="23" width="26" height="26" rx="4" fill="#FFFFFF"/>
      <rect x="77" y="23" width="26" height="26" rx="4" fill="#FFFFFF"/>
      <rect x="23" y="50" width="26" height="26" rx="4" fill="#FFFFFF"/>
      <rect x="77" y="50" width="26" height="26" rx="4" fill="#FFFFFF"/>
      <rect x="23" y="77" width="26" height="26" rx="4" fill="#FFFFFF"/>
      <rect x="50" y="77" width="26" height="26" rx="4" fill="#FFFFFF"/>
      <rect x="77" y="77" width="26" height="26" rx="4" fill="#FFFFFF"/>
    </svg>
  );
}

export function BitgetLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#00F0FF"/>
      <path fill="#FFFFFF" d="M40 35L86 63L40 91V35z"/>
    </svg>
  );
}

export function DeribitLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#04AA6D"/>
      <path fill="#FFFFFF" d="M38 40h50v10H48v26h40v10H38V40z"/>
    </svg>
  );
}

export function HTXLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#2B3139"/>
      <path fill="#00A3FF" d="M63 25c-21 0-38 17-38 38s17 38 38 38 38-17 38-38-17-38-38-38zm0 66c-15.5 0-28-12.5-28-28s12.5-28 28-28 28 12.5 28 28-12.5 28-28 28z"/>
    </svg>
  );
}

export function GateLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#17E6A1"/>
      <text x="63" y="75" textAnchor="middle" fill="#000000" fontWeight="bold" fontSize="40">G</text>
    </svg>
  );
}

export function KucoinLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#24AE8F"/>
      <path fill="#FFFFFF" d="M63 35l25 28-25 28-25-28 25-28z"/>
    </svg>
  );
}

export function MEXCLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#00B897"/>
      <text x="63" y="78" textAnchor="middle" fill="#FFFFFF" fontWeight="bold" fontSize="36">M</text>
    </svg>
  );
}

export function KrakenLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#5741D9"/>
      <path fill="#FFFFFF" d="M40 40h10v46H40V40zm36 0h10v46H76V40zm-18 20h10v26H58V60z"/>
    </svg>
  );
}

export function BingXLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#2354E6"/>
      <text x="63" y="78" textAnchor="middle" fill="#FFFFFF" fontWeight="bold" fontSize="32">BX</text>
    </svg>
  );
}

export function PhemexLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#C8FF00"/>
      <text x="63" y="78" textAnchor="middle" fill="#000000" fontWeight="bold" fontSize="32">PH</text>
    </svg>
  );
}

// DEX Logos
export function HyperliquidLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#00D1FF"/>
      <path fill="#FFFFFF" d="M38 35h50l-25 56-25-56z"/>
    </svg>
  );
}

export function GMXLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#2D42FC"/>
      <text x="63" y="78" textAnchor="middle" fill="#FFFFFF" fontWeight="bold" fontSize="32">GMX</text>
    </svg>
  );
}

export function DYDXLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#6966FF"/>
      <path fill="#FFFFFF" d="M33 33h30v60H33V33zm30 30h30v30H63V63z"/>
    </svg>
  );
}

export function AevoLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#FFFFFF"/>
      <circle cx="63" cy="63" r="35" fill="#000000"/>
    </svg>
  );
}

export function VertexLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#00E99E"/>
      <path fill="#FFFFFF" d="M63 30l35 66H28l35-66z"/>
    </svg>
  );
}

export function DriftLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#8B5CF6"/>
      <path fill="#FFFFFF" d="M30 63h66l-33 33-33-33z"/>
    </svg>
  );
}

export function GTradeLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#14B8A6"/>
      <path fill="#FFFFFF" d="M63 28c-19.3 0-35 15.7-35 35 0 19.3 15.7 35 35 35 9.7 0 18.4-3.9 24.7-10.3l-10-10C74 81.4 68.8 84 63 84c-11.6 0-21-9.4-21-21s9.4-21 21-21c5.8 0 11 2.6 14.7 6.7l10-10C81.4 31.9 72.7 28 63 28z"/>
      <rect x="63" y="53" width="30" height="14" rx="2" fill="#FFFFFF"/>
    </svg>
  );
}

export function AsterLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#EC4899"/>
      <path fill="#FFFFFF" d="M63 25l8 23h24l-19 14 7 23-20-15-20 15 7-23-19-14h24z"/>
    </svg>
  );
}

export function LighterLogo({ className = '', size = 24 }: ExchangeLogoProps) {
  return (
    <svg viewBox="0 0 126 126" width={size} height={size} className={className}>
      <circle cx="63" cy="63" r="63" fill="#34D399"/>
      <path fill="#FFFFFF" d="M50 35h26v56H50V35zm-10 20h10v16H40V55zm36 0h10v16H86V55z"/>
    </svg>
  );
}

// Exchange logo mapping
export const exchangeLogos: Record<string, React.ComponentType<ExchangeLogoProps>> = {
  binance: BinanceLogo,
  bybit: BybitLogo,
  okx: OKXLogo,
  bitget: BitgetLogo,
  deribit: DeribitLogo,
  htx: HTXLogo,
  gate: GateLogo,
  kucoin: KucoinLogo,
  mexc: MEXCLogo,
  kraken: KrakenLogo,
  bingx: BingXLogo,
  phemex: PhemexLogo,
  hyperliquid: HyperliquidLogo,
  gmx: GMXLogo,
  dydx: DYDXLogo,
  aevo: AevoLogo,
  vertex: VertexLogo,
  drift: DriftLogo,
  gtrade: GTradeLogo,
  aster: AsterLogo,
  lighter: LighterLogo,
};

// Exchange brand colors for styling
export const exchangeColors: Record<string, string> = {
  binance: '#F3BA2F',
  bybit: '#F7A600',
  okx: '#000000',
  bitget: '#00F0FF',
  deribit: '#04AA6D',
  htx: '#00A3FF',
  gate: '#17E6A1',
  kucoin: '#24AE8F',
  mexc: '#00B897',
  kraken: '#5741D9',
  bingx: '#2354E6',
  phemex: '#C8FF00',
  hyperliquid: '#00D1FF',
  gmx: '#2D42FC',
  dydx: '#6966FF',
  aevo: '#000000',
  vertex: '#00E99E',
  drift: '#8B5CF6',
  gtrade: '#14B8A6',
  aster: '#EC4899',
  lighter: '#34D399',
};

// Generic exchange logo component
export function ExchangeLogo({ exchange, size = 24, className = '' }: { exchange: string; size?: number; className?: string }) {
  const LogoComponent = exchangeLogos[exchange.toLowerCase()];

  if (!LogoComponent) {
    // Fallback to a generic exchange icon
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-hub-gray-light text-white font-bold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {exchange.charAt(0).toUpperCase()}
      </div>
    );
  }

  return <LogoComponent size={size} className={className} />;
}