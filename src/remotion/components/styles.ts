/** Shared styles & constants for the market recap video */
import { CSSProperties } from 'react';

// Brand colors
export const colors = {
  bg: '#0A0A0A',
  bgCard: '#111111',
  bgCardHover: '#1A1A1A',
  accent: '#F59E0B',    // amber/gold
  green: '#22C55E',
  red: '#EF4444',
  blue: '#3B82F6',
  purple: '#A78BFA',
  cyan: '#06B6D4',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  border: '#1F1F1F',
  gradientStart: '#F59E0B',
  gradientEnd: '#EF4444',
};

// Video dimensions
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

// Common styles
export const fullScreen: CSSProperties = {
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
  backgroundColor: colors.bg,
  fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  color: colors.textPrimary,
  overflow: 'hidden',
  position: 'relative',
};

export const centerFlex: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const cardStyle: CSSProperties = {
  backgroundColor: colors.bgCard,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  padding: '20px 24px',
};

export function formatPrice(n: number): string {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toPrecision(4);
}

export function formatRate(r: number): string {
  const sign = r >= 0 ? '+' : '';
  return `${sign}${r.toFixed(4)}%`;
}

export function formatPct(r: number): string {
  const sign = r >= 0 ? '+' : '';
  return `${sign}${r.toFixed(2)}%`;
}

export function formatOI(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

/** Get coin icon URL from CryptoCompare CDN */
export function getCoinIconUrl(symbol: string, size: number = 64): string {
  const sym = symbol.toUpperCase().replace(/^1000|^1M/, '');
  return `https://cryptocompare.com/media/37746251/${sym.toLowerCase()}.png`;
}

/** CoinGecko fallback icon URL */
export function getCoinIconFallback(symbol: string): string {
  const map: Record<string, string> = {
    BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
    BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
    ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
    AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    DOT: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
    LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
    SUI: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg',
    PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
    ARB: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
    OP: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
    HYPE: 'https://assets.coingecko.com/coins/images/40488/small/HYPE.png',
  };
  return map[symbol.toUpperCase()] || `https://ui-avatars.com/api/?name=${symbol}&background=1a1a1a&color=fff&size=64&bold=true&format=png`;
}
