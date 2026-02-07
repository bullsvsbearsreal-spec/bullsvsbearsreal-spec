'use client';

import Image from 'next/image';
import { useState } from 'react';

interface TokenIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

// Map common symbol variations to their canonical names
const symbolMap: Record<string, string> = {
  'BTC': 'btc',
  'ETH': 'eth',
  'SOL': 'sol',
  'XRP': 'xrp',
  'DOGE': 'doge',
  'ADA': 'ada',
  'AVAX': 'avax',
  'DOT': 'dot',
  'MATIC': 'matic',
  'LINK': 'link',
  'UNI': 'uni',
  'ATOM': 'atom',
  'LTC': 'ltc',
  'BCH': 'bch',
  'ETC': 'etc',
  'XLM': 'xlm',
  'ALGO': 'algo',
  'VET': 'vet',
  'FIL': 'fil',
  'TRX': 'trx',
  'NEAR': 'near',
  'APE': 'ape',
  'SAND': 'sand',
  'MANA': 'mana',
  'AXS': 'axs',
  'AAVE': 'aave',
  'CRV': 'crv',
  'MKR': 'mkr',
  'SNX': 'snx',
  'COMP': 'comp',
  'SUSHI': 'sushi',
  'YFI': 'yfi',
  '1INCH': '1inch',
  'ENJ': 'enj',
  'CHZ': 'chz',
  'BAT': 'bat',
  'ZRX': 'zrx',
  'LRC': 'lrc',
  'ENS': 'ens',
  'GRT': 'grt',
  'FTM': 'ftm',
  'RUNE': 'rune',
  'LUNA': 'luna',
  'LUNC': 'lunc',
  'SHIB': 'shib',
  'APT': 'apt',
  'ARB': 'arb',
  'OP': 'op',
  'SUI': 'sui',
  'SEI': 'sei',
  'INJ': 'inj',
  'TIA': 'tia',
  'JUP': 'jup',
  'WIF': 'wif',
  'PEPE': 'pepe',
  'BONK': 'bonk',
  'ORDI': 'ordi',
  'STX': 'stx',
  'IMX': 'imx',
  'BLUR': 'blur',
  'LDO': 'ldo',
  'RPL': 'rpl',
  'GMX': 'gmx',
  'DYDX': 'dydx',
  'FXS': 'fxs',
  'FRAX': 'frax',
  'CVX': 'cvx',
  'PENDLE': 'pendle',
  'SSV': 'ssv',
  'EIGEN': 'eigen',
  'ETHFI': 'ethfi',
  'W': 'w',
  'ENA': 'ena',
  'TON': 'ton',
  'NOT': 'not',
  'KAS': 'kas',
  'RENDER': 'render',
  'FET': 'fet',
  'AGIX': 'agix',
  'OCEAN': 'ocean',
  'TAO': 'tau',
  'WLD': 'wld',
  'ARKM': 'arkm',
  'CFX': 'cfx',
  'MINA': 'mina',
  'ROSE': 'rose',
  'ZIL': 'zil',
  'KAVA': 'kava',
  'OSMO': 'osmo',
  'ICP': 'icp',
  'HBAR': 'hbar',
  'QNT': 'qnt',
  'EGLD': 'egld',
  'FLOW': 'flow',
  'XTZ': 'xtz',
  'THETA': 'theta',
  'NEO': 'neo',
  'EOS': 'eos',
  'IOTA': 'iota',
  'XMR': 'xmr',
  'ZEC': 'zec',
  'DASH': 'dash',
  'DCR': 'dcr',
  'WAVES': 'waves',
  'CAKE': 'cake',
  'PERP': 'perp',
  'MASK': 'mask',
  'API3': 'api3',
  'BAND': 'band',
  'RLC': 'rlc',
  'STORJ': 'storj',
  'AR': 'ar',
  'CELO': 'celo',
  'ONE': 'one',
  'GLMR': 'glmr',
  'MOVR': 'movr',
  'ASTR': 'astr',
  'KSM': 'ksm',
  'GALA': 'gala',
  'ILV': 'ilv',
  'MAGIC': 'magic',
  'GMT': 'gmt',
  'GST': 'gst',
  'LQTY': 'lqty',
  'SPELL': 'spell',
  'ICX': 'icx',
  'ONT': 'ont',
  'QTUM': 'qtum',
  'ZEN': 'zen',
  'SC': 'sc',
  'BTT': 'btt',
  'JST': 'jst',
  'SRM': 'srm',
  'RAY': 'ray',
  'MNGO': 'mngo',
  'ORCA': 'orca',
  'FIDA': 'fida',
  'SBR': 'sbr',
  'STEP': 'step',
  'COPE': 'cope',
  'MAPS': 'maps',
  'TULIP': 'tulip',
  'SAMO': 'samo',
  'GRAPE': 'grape',
  '10000SATS': 'sats',
  'SATS': 'sats',
  '1000SATS': 'sats',
  'RATS': 'rats',
  'MEME': 'meme',
  'FLOKI': 'floki',
  'TURBO': 'turbo',
  'LADYS': 'ladys',
  'BNB': 'bnb',
  'USDT': 'usdt',
  'USDC': 'usdc',
  'BUSD': 'busd',
  'DAI': 'dai',
  'TUSD': 'tusd',
  'USDP': 'usdp',
  'WBTC': 'wbtc',
  'WETH': 'weth',
  'STETH': 'steth',
  'CBETH': 'cbeth',
  'RETH': 'reth',
  'POL': 'pol',
  'CKB': 'ckb',
  'PYTH': 'pyth',
  'JTO': 'jto',
  'STRK': 'strk',
  'DYM': 'dym',
  'PIXEL': 'pixel',
  'PORTAL': 'portal',
  'ALT': 'alt',
  'MANTA': 'manta',
  'AI': 'ai',
  'XAI': 'xai',
  'ACE': 'ace',
  'NFP': 'nfp',
  'MYRO': 'myro',
  'ONDO': 'ondo',
  'AEVO': 'aevo',
  'BOME': 'bome',
  'SLERF': 'slerf',
  'ETHW': 'ethw',
  'POW': 'pow',
  'MEW': 'mew',
  'TRUMP': 'trump',
  'MELANIA': 'melania',
};

export default function TokenIcon({ symbol, size = 24, className = '' }: TokenIconProps) {
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  // Normalize symbol
  const normalizedSymbol = symbol.toUpperCase().replace(/[-_]/g, '');
  const mappedSymbol = symbolMap[normalizedSymbol] || normalizedSymbol.toLowerCase();

  // Multiple fallback sources for icons
  const iconSources = [
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${mappedSymbol}.png`,
    `https://assets.coingecko.com/coins/images/1/small/${mappedSymbol}.png`,
    `https://cryptologos.cc/logos/${mappedSymbol}-${mappedSymbol}-logo.png`,
    `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/${mappedSymbol}.png`,
  ];

  // Get first letter(s) for fallback
  const fallbackText = normalizedSymbol.slice(0, 2);

  if (hasError || !imgSrc) {
    // Try to load image
    if (!imgSrc && !hasError) {
      const img = new window.Image();
      img.onload = () => setImgSrc(iconSources[0]);
      img.onerror = () => {
        // Try next source
        const img2 = new window.Image();
        img2.onload = () => setImgSrc(iconSources[3]);
        img2.onerror = () => setHasError(true);
        img2.src = iconSources[3];
      };
      img.src = iconSources[0];
    }

    // Fallback to simple icon with letters
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-hub-yellow/20 ${className}`}
        style={{ width: size, height: size }}
      >
        <span
          className="font-bold text-hub-yellow"
          style={{ fontSize: size * 0.45 }}
        >
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
      <Image
        src={imgSrc}
        alt={`${symbol} icon`}
        width={size}
        height={size}
        className="object-cover"
        onError={() => setHasError(true)}
        unoptimized
      />
    </div>
  );
}

// Memoized version for better performance in lists
export function TokenIconSimple({ symbol, size = 24, className = '' }: TokenIconProps) {
  const normalizedSymbol = symbol.toUpperCase().replace(/[-_]/g, '');
  const mappedSymbol = symbolMap[normalizedSymbol] || normalizedSymbol.toLowerCase();
  const fallbackText = normalizedSymbol.slice(0, 2);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${mappedSymbol}.png`}
        alt={`${symbol} icon`}
        width={size}
        height={size}
        className="rounded-full object-cover"
        onError={(e) => {
          // Replace with fallback div
          const parent = e.currentTarget.parentElement;
          if (parent) {
            parent.innerHTML = `
              <div class="flex items-center justify-center rounded-full" style="width: ${size}px; height: ${size}px; background: rgba(255, 165, 0, 0.2);">
                <span class="font-bold" style="font-size: ${size * 0.45}px; color: #FFA500;">${fallbackText}</span>
              </div>
            `;
          }
        }}
      />
    </div>
  );
}
