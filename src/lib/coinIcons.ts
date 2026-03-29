// Coin icon URLs — multi-source with fallbacks
// Primary: CoinGecko CDN (reliable for top coins)
// Fallback: CryptoCompare symbol-based CDN

// Full CoinGecko image ID mapping: coinId → numeric image folder ID
const CG_IMAGE_IDS: Record<string, number> = {
  bitcoin: 1, ethereum: 279, solana: 4128, binancecoin: 825,
  ripple: 44, cardano: 975, dogecoin: 5, 'avalanche-2': 12559,
  chainlink: 877, 'the-open-network': 17980, polkadot: 12171,
  'matic-network': 4713, sui: 26375, aptos: 26455, near: 10365,
  arbitrum: 16547, optimism: 25244, filecoin: 12817, cosmos: 3794,
  'injective-protocol': 12882, pepe: 24613, dogwifcoin: 28752,
  'hedera-hashgraph': 3688, litecoin: 2, 'bitcoin-cash': 780,
  'ethereum-classic': 453, fantom: 4001, celestia: 31967,
  'render-token': 11636, 'sei-network': 28205, blockstack: 4847,
  'immutable-x': 17233, 'manta-network': 33479, 'jupiter-exchange-solana': 33093,
  'worldcoin-wld': 31069, bonk: 28600, floki: 10804,
  'shiba-inu': 11939, popcat: 33566, brett: 33783,
  'mog-coin': 31510, 'cat-in-a-dogs-world': 33440, 'official-trump': 36034,
  'pudgy-penguins': 35225, turbo: 30420, 'neiro-on-eth': 37250,
  aave: 12645, uniswap: 12504, maker: 1364, 'curve-dao-token': 12124,
  'dydx-chain': 28324, havven: 2138, 'compound-governance-token': 10775,
  'lido-dao': 13573, eigenlayer: 35547, ethena: 33613, 'ondo-finance': 26580,
  tron: 1094, algorand: 4030, vechain: 3077, 'the-sandbox': 12129,
  decentraland: 1218, 'axie-infinity': 13029, gala: 12493,
  'ethereum-name-service': 19785, blur: 28478, wormhole: 35088,
  layerzero: 35853, starknet: 26667, zksync: 24091, 'pyth-network': 28177,
  kaspa: 25210, jasmycoin: 13876, iota: 1024, eos: 738,
  stellar: 100, 'theta-token': 2416, 'elrond-erd-2': 11033,
  'the-graph': 13397, arweave: 4343, fetch: 5681,
  arkham: 30579, 'akash-network': 7431, 'ocean-protocol': 3621,
  'singularitynet': 5765, pendle: 15585, pancakeswap: 12632,
  'sushi': 12271, '1inch': 8104, 'gmx': 18323, 'reserve-rights-token': 3738,
  pixel: 35376, portal: 35498, prime: 29997, ronin: 30174, beam: 28729,
  bittensor: 28452, degen: 34559, 'book-of-meme': 34779,
  'myro': 33311, moo_deng: 37168, metis: 15234, blast: 35719,
};

// Symbol → CoinGecko coin ID
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2',
  LINK: 'chainlink', TON: 'the-open-network', DOT: 'polkadot', MATIC: 'matic-network',
  SUI: 'sui', APT: 'aptos', NEAR: 'near', ARB: 'arbitrum',
  OP: 'optimism', FIL: 'filecoin', ATOM: 'cosmos', INJ: 'injective-protocol',
  HBAR: 'hedera-hashgraph', LTC: 'litecoin', BCH: 'bitcoin-cash', ETC: 'ethereum-classic',
  FTM: 'fantom', TIA: 'celestia', RENDER: 'render-token', SEI: 'sei-network',
  STX: 'blockstack', IMX: 'immutable-x', MANTA: 'manta-network', JUP: 'jupiter-exchange-solana',
  WLD: 'worldcoin-wld', PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk',
  FLOKI: 'floki', SHIB: 'shiba-inu', POPCAT: 'popcat', BRETT: 'brett',
  MOG: 'mog-coin', MEW: 'cat-in-a-dogs-world', TRUMP: 'official-trump',
  PENGU: 'pudgy-penguins', TURBO: 'turbo', NEIRO: 'neiro-on-eth',
  AAVE: 'aave', UNI: 'uniswap', MKR: 'maker', CRV: 'curve-dao-token',
  DYDX: 'dydx-chain', SNX: 'havven', COMP: 'compound-governance-token',
  LDO: 'lido-dao', EIGEN: 'eigenlayer', ENA: 'ethena', ONDO: 'ondo-finance',
  TRX: 'tron', ALGO: 'algorand', VET: 'vechain', SAND: 'the-sandbox',
  MANA: 'decentraland', AXS: 'axie-infinity', GALA: 'gala', ENS: 'ethereum-name-service',
  BLUR: 'blur', W: 'wormhole', ZRO: 'layerzero', STRK: 'starknet',
  ZK: 'zksync', PYTH: 'pyth-network', KAS: 'kaspa', JASMY: 'jasmycoin',
  IOTA: 'iota', EOS: 'eos', XLM: 'stellar', THETA: 'theta-token',
  EGLD: 'elrond-erd-2', GRT: 'the-graph', AR: 'arweave', FET: 'fetch',
  ARKM: 'arkham', AKT: 'akash-network', OCEAN: 'ocean-protocol',
  AGIX: 'singularitynet', PENDLE: 'pendle', CAKE: 'pancakeswap',
  SUSHI: 'sushi', '1INCH': '1inch', GMX: 'gmx', RSR: 'reserve-rights-token',
  PIXEL: 'pixel', PORTAL: 'portal', PRIME: 'prime', RONIN: 'ronin', BEAM: 'beam',
  TAO: 'bittensor', DEGEN: 'degen', BOME: 'book-of-meme',
  MYRO: 'myro', MOODENG: 'moo_deng', METIS: 'metis', BLAST: 'blast',
  RNDR: 'render-token',
};

// Non-crypto asset icons (emoji fallbacks encoded as SVG data URIs)
const NON_CRYPTO_ICONS: Record<string, string> = {
  // Precious Metals
  XAU: '🥇', XAG: '🥈', XAUT: '🥇', XPT: '⚪', XPD: '⚪',
  // Energy
  WTI: '🛢️', BRENT: '🛢️', NATGAS: '🔥',
  // Industrial
  COPPER: '🟤',
  // Forex
  EURUSD: '🇪🇺', GBPUSD: '🇬🇧', USDJPY: '🇯🇵', USDCHF: '🇨🇭',
  AUDUSD: '🇦🇺', USDCAD: '🇨🇦', NZDUSD: '🇳🇿',
  EURGBP: '🇪🇺', EURJPY: '🇪🇺', GBPJPY: '🇬🇧', AUDJPY: '🇦🇺',
  EURAUD: '🇪🇺', EURCHF: '🇪🇺',
  // Stocks
  AAPL: '🍎', TSLA: '⚡', NVDA: '💚', GOOGL: '🔍', MSFT: '🪟',
  AMZN: '📦', META: '👁️', NFLX: '🎬', INTC: '🔵', ARM: '💪',
  COIN: '🪙', MSTR: '📊', HOOD: '🟢', PLTR: '🔮',
  // Indices
  SPX: '📈', QQQ: '📊', DIA: '💎', IWM: '📉',
};

function getCoinGeckoUrl(coinId: string): string | null {
  const imageId = CG_IMAGE_IDS[coinId];
  if (!imageId) return null;
  return `https://assets.coingecko.com/coins/images/${imageId}/small/${coinId}.png`;
}

// Generate a tiny SVG with an emoji for non-crypto assets
function emojiToDataUri(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="20">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Generate a fallback icon with initials
function initialsFallback(symbol: string): string {
  const s = symbol.slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#333"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="12" fill="#aaa" font-family="sans-serif">${s}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getCoinIconUrl(symbol: string, size: 'small' | 'large' = 'small'): string | null {
  const s = symbol.toUpperCase();
  const coinId = COINGECKO_IDS[s];
  if (!coinId) return null;
  return getCoinGeckoUrl(coinId);
}

// Get coin icon with multi-source fallbacks
export function getCoinIcon(symbol: string): string {
  const s = symbol.toUpperCase();

  // Non-crypto assets → emoji icons
  const emoji = NON_CRYPTO_ICONS[s];
  if (emoji) return emojiToDataUri(emoji);

  // Crypto: try CoinGecko first
  const coinId = COINGECKO_IDS[s];
  if (coinId) {
    const url = getCoinGeckoUrl(coinId);
    if (url) return url;
  }

  // Fallback: CryptoCompare (works for most by symbol)
  return `https://www.cryptocompare.com/media/37746251/${s.toLowerCase()}.png`;
}

// Returns true if symbol has a known icon (not just a generic fallback)
export function hasKnownIcon(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return !!(COINGECKO_IDS[s] || NON_CRYPTO_ICONS[s]);
}

// Exchange icon URLs
const FV = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const EXCHANGE_ICONS: Record<string, string> = {
  Binance: FV('binance.com'),
  Bybit: FV('bybit.com'),
  OKX: FV('okx.com'),
  Bitget: FV('bitget.com'),
  MEXC: FV('mexc.com'),
  HTX: FV('htx.com'),
  Hyperliquid: FV('hyperliquid.xyz'),
  dYdX: FV('dydx.exchange'),
  Kraken: FV('kraken.com'),
  'Gate.io': FV('gate.io'),
  Coinbase: FV('coinbase.com'),
  BingX: FV('bingx.com'),
  Phemex: FV('phemex.com'),
  KuCoin: FV('kucoin.com'),
  Bitfinex: FV('bitfinex.com'),
  WhiteBIT: FV('whitebit.com'),
  CoinEx: FV('coinex.com'),
  Drift: FV('drift.trade'),
  GMX: FV('gmx.io'),
  Aevo: FV('aevo.xyz'),
  Bitunix: FV('bitunix.com'),
  Lighter: FV('lighter.xyz'),
  Nado: FV('nado.trade'),
  Aster: FV('aster.finance'),
};

export function getExchangeIcon(exchange: string): string | null {
  return EXCHANGE_ICONS[exchange] || null;
}
