'use client';

import { useState, useCallback } from 'react';

interface TokenIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

// Map common symbol variations to their canonical file names
const symbolMap: Record<string, string> = {
  'BTC': 'btc', 'ETH': 'eth', 'SOL': 'sol', 'XRP': 'xrp', 'DOGE': 'doge',
  'ADA': 'ada', 'AVAX': 'avax', 'DOT': 'dot', 'MATIC': 'matic', 'LINK': 'link',
  'UNI': 'uni', 'ATOM': 'atom', 'LTC': 'ltc', 'BCH': 'bch', 'ETC': 'etc',
  'XLM': 'xlm', 'ALGO': 'algo', 'VET': 'vet', 'FIL': 'fil', 'TRX': 'trx',
  'NEAR': 'near', 'APE': 'ape', 'SAND': 'sand', 'MANA': 'mana', 'AXS': 'axs',
  'AAVE': 'aave', 'CRV': 'crv', 'MKR': 'mkr', 'SNX': 'snx', 'COMP': 'comp',
  'SUSHI': 'sushi', 'YFI': 'yfi', '1INCH': '1inch', 'ENJ': 'enj', 'CHZ': 'chz',
  'BAT': 'bat', 'ZRX': 'zrx', 'LRC': 'lrc', 'ENS': 'ens', 'GRT': 'grt',
  'FTM': 'ftm', 'RUNE': 'rune', 'LUNA': 'luna', 'LUNC': 'lunc', 'SHIB': 'shib',
  'APT': 'apt', 'ARB': 'arb', 'OP': 'op', 'SUI': 'sui', 'SEI': 'sei',
  'INJ': 'inj', 'TIA': 'tia', 'JUP': 'jup', 'WIF': 'wif', 'PEPE': 'pepe',
  'BONK': 'bonk', 'ORDI': 'ordi', 'STX': 'stx', 'IMX': 'imx', 'BLUR': 'blur',
  'LDO': 'ldo', 'RPL': 'rpl', 'GMX': 'gmx', 'DYDX': 'dydx', 'FXS': 'fxs',
  'FRAX': 'frax', 'CVX': 'cvx', 'PENDLE': 'pendle', 'SSV': 'ssv', 'EIGEN': 'eigen',
  'ETHFI': 'ethfi', 'W': 'w', 'ENA': 'ena', 'TON': 'ton', 'NOT': 'not',
  'KAS': 'kas', 'RENDER': 'render', 'FET': 'fet', 'AGIX': 'agix', 'OCEAN': 'ocean',
  'TAO': 'tao', 'WLD': 'wld', 'ARKM': 'arkm', 'CFX': 'cfx', 'MINA': 'mina',
  'ROSE': 'rose', 'ZIL': 'zil', 'KAVA': 'kava', 'OSMO': 'osmo', 'ICP': 'icp',
  'HBAR': 'hbar', 'QNT': 'qnt', 'EGLD': 'egld', 'FLOW': 'flow', 'XTZ': 'xtz',
  'THETA': 'theta', 'NEO': 'neo', 'EOS': 'eos', 'IOTA': 'iota', 'XMR': 'xmr',
  'ZEC': 'zec', 'DASH': 'dash', 'DCR': 'dcr', 'WAVES': 'waves', 'CAKE': 'cake',
  'PERP': 'perp', 'MASK': 'mask', 'API3': 'api3', 'BAND': 'band', 'RLC': 'rlc',
  'STORJ': 'storj', 'AR': 'ar', 'CELO': 'celo', 'ONE': 'one', 'GLMR': 'glmr',
  'MOVR': 'movr', 'ASTR': 'astr', 'KSM': 'ksm', 'GALA': 'gala', 'ILV': 'ilv',
  'MAGIC': 'magic', 'GMT': 'gmt', 'GST': 'gst', 'LQTY': 'lqty', 'SPELL': 'spell',
  'ICX': 'icx', 'ONT': 'ont', 'QTUM': 'qtum', 'ZEN': 'zen', 'SC': 'sc',
  'BTT': 'btt', 'JST': 'jst', 'SRM': 'srm', 'RAY': 'ray', 'MNGO': 'mngo',
  'ORCA': 'orca', 'FIDA': 'fida', 'SBR': 'sbr', 'STEP': 'step', 'COPE': 'cope',
  'MAPS': 'maps', 'TULIP': 'tulip', 'SAMO': 'samo', 'GRAPE': 'grape',
  '10000SATS': 'sats', 'SATS': 'sats', '1000SATS': 'sats', 'RATS': 'rats',
  'MEME': 'meme', 'FLOKI': 'floki', 'TURBO': 'turbo', 'LADYS': 'ladys',
  'BNB': 'bnb', 'USDT': 'usdt', 'USDC': 'usdc', 'BUSD': 'busd', 'DAI': 'dai',
  'TUSD': 'tusd', 'USDP': 'usdp', 'WBTC': 'wbtc', 'WETH': 'weth',
  'STETH': 'steth', 'CBETH': 'cbeth', 'RETH': 'reth', 'POL': 'pol',
  'CKB': 'ckb', 'PYTH': 'pyth', 'JTO': 'jto', 'STRK': 'strk', 'DYM': 'dym',
  'PIXEL': 'pixel', 'PORTAL': 'portal', 'ALT': 'alt', 'MANTA': 'manta',
  'AI': 'ai', 'XAI': 'xai', 'ACE': 'ace', 'NFP': 'nfp', 'MYRO': 'myro',
  'ONDO': 'ondo', 'AEVO': 'aevo', 'BOME': 'bome', 'SLERF': 'slerf',
  'ETHW': 'ethw', 'POW': 'pow', 'MEW': 'mew', 'TRUMP': 'trump', 'MELANIA': 'melania',
  // Newer tokens (2024-2025)
  'PNUT': 'pnut', 'FARTCOIN': 'fartcoin', 'VIRTUAL': 'virtual', 'GOAT': 'goat',
  'GRASS': 'grass', 'IO': 'io', 'NEIRO': 'neiro', 'POPCAT': 'popcat', 'LISTA': 'lista',
  'ZRO': 'zro', 'MORPHO': 'morpho', 'SAFE': 'safe', 'USUAL': 'usual', 'HYPE': 'hype',
  'BERA': 'bera', 'KAITO': 'kaito', 'ANIME': 'anime', 'IP': 'ip', 'S': 'sonic',
  'SONIC': 'sonic', 'MOG': 'mog', 'BRETT': 'brett', 'ZETA': 'zeta', 'OMNI': 'omni',
  'DOGS': 'dogs', 'HMSTR': 'hmstr', 'CATI': 'cati', 'PONKE': 'ponke', 'BANANA': 'banana',
  'ACT': 'act', 'AI16Z': 'ai16z', 'BB': 'bb', 'REZ': 'rez', 'SOLV': 'solv',
  'NFT': 'nft',
};

// Local tokens directory has:
// - .png files for crypto (from CMC)
// - .svg files for stocks, forex, commodities (generated)
// Try local first, then remote CDN fallback for crypto

function getLocalPath(symbol: string): string | null {
  const upper = symbol.toUpperCase().replace(/[-_]/g, '');
  const mapped = symbolMap[upper] || upper.toLowerCase();

  // Check for PNG (crypto coins from CMC)
  // Check for SVG (stocks, forex, commodities)
  // We'll try both extensions — the img tag will handle the fallback
  return mapped;
}

// Remote CDN fallback for crypto tokens not in local cache
function getRemotePath(symbol: string): string {
  const upper = symbol.toUpperCase().replace(/[-_]/g, '');
  const mapped = symbolMap[upper] || upper.toLowerCase();
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${mapped}.png`;
}

export default function TokenIcon({ symbol, size = 24, className = '' }: TokenIconProps) {
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  const normalizedSymbol = symbol.toUpperCase().replace(/[-_]/g, '');
  const mappedSymbol = symbolMap[normalizedSymbol] || normalizedSymbol.toLowerCase();
  const fallbackText = normalizedSymbol.slice(0, 2);

  if (hasError || !imgSrc) {
    if (!imgSrc && !hasError) {
      const img = new window.Image();
      // Try local PNG first
      img.onload = () => setImgSrc(`/tokens/${mappedSymbol}.png`);
      img.onerror = () => {
        // Try local SVG
        const img2 = new window.Image();
        img2.onload = () => setImgSrc(`/tokens/${mappedSymbol}.svg`);
        img2.onerror = () => {
          // Try remote CDN
          const img3 = new window.Image();
          img3.onload = () => setImgSrc(getRemotePath(symbol));
          img3.onerror = () => setHasError(true);
          img3.src = getRemotePath(symbol);
        };
        img2.src = `/tokens/${mappedSymbol}.svg`;
      };
      img.src = `/tokens/${mappedSymbol}.png`;
    }

    return (
      <div
        className={`flex items-center justify-center rounded-full bg-hub-yellow/20 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="font-bold text-hub-yellow" style={{ fontSize: size * 0.45 }}>
          {fallbackText}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-full overflow-hidden bg-hub-gray/30 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt={`${symbol} icon`}
        width={size}
        height={size}
        className="object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

// Simple version for lists — tries local PNG → local SVG → remote CDN → letter fallback
export function TokenIconSimple({ symbol, size = 24, className = '' }: TokenIconProps) {
  const normalizedSymbol = symbol.toUpperCase().replace(/[-_]/g, '');
  const mappedSymbol = symbolMap[normalizedSymbol] || normalizedSymbol.toLowerCase();
  const fallbackText = normalizedSymbol.slice(0, 2);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const src = img.src;

    // Try local SVG if PNG failed
    if (src.endsWith('.png') && src.includes('/tokens/')) {
      img.src = `/tokens/${mappedSymbol}.svg`;
      return;
    }

    // Try remote CDN if local SVG failed
    if (src.endsWith('.svg') && src.includes('/tokens/')) {
      img.src = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${mappedSymbol}.png`;
      return;
    }

    // Final fallback: replace with letter div
    const parent = img.parentElement;
    if (parent) {
      parent.innerHTML = `
        <div class="flex items-center justify-center rounded-full" style="width: ${size}px; height: ${size}px; background: rgba(255, 165, 0, 0.2);">
          <span class="font-bold" style="font-size: ${size * 0.45}px; color: #FFA500;">${fallbackText}</span>
        </div>
      `;
    }
  }, [mappedSymbol, size, fallbackText]);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/tokens/${mappedSymbol}.png`}
        alt={`${symbol} icon`}
        width={size}
        height={size}
        className="rounded-full object-cover"
        onError={handleError}
      />
    </div>
  );
}
