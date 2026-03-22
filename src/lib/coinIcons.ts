// Coin icon URLs from CoinGecko CDN (small 32px thumbnails)
// Map: symbol → CoinGecko coin ID
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
  ZK: 'zksync', PYTH: 'pyth-network',
};

export function getCoinIconUrl(symbol: string, size: 'small' | 'large' = 'small'): string | null {
  const id = COINGECKO_IDS[symbol.toUpperCase()];
  if (!id) return null;
  // CoinGecko CDN pattern
  return `https://assets.coingecko.com/coins/images/${getCoinGeckoImageId(id)}/small/${id}.png`;
}

// Use a simpler CDN that doesn't need image IDs
export function getCoinIcon(symbol: string): string {
  const s = symbol.toUpperCase();
  // Use CryptoCompare free icon CDN (no API key needed, just symbol)
  return `https://www.cryptocompare.com/media/37746251/${s.toLowerCase()}.png`;
}

// Exchange icon URLs
const EXCHANGE_ICONS: Record<string, string> = {
  Binance: 'https://www.cryptocompare.com/media/44081950/binance.png',
  Bybit: 'https://www.cryptocompare.com/media/44082098/bybit.png',
  OKX: 'https://www.cryptocompare.com/media/44082148/okx.png',
  Bitget: 'https://www.cryptocompare.com/media/44082024/bitget.png',
  MEXC: 'https://www.cryptocompare.com/media/44082136/mexc.png',
  HTX: 'https://www.cryptocompare.com/media/37747208/huobi.png',
  Hyperliquid: 'https://assets.coingecko.com/markets/images/1523/small/hyperliquid.jpeg',
  dYdX: 'https://www.cryptocompare.com/media/44082071/dydx.png',
  Kraken: 'https://www.cryptocompare.com/media/44081960/kraken.png',
  'Gate.io': 'https://www.cryptocompare.com/media/44081964/gate-io.png',
  Coinbase: 'https://www.cryptocompare.com/media/44082047/coinbase.png',
  BingX: 'https://assets.coingecko.com/markets/images/812/small/bingx.jpeg',
  Phemex: 'https://assets.coingecko.com/markets/images/565/small/phemex.jpeg',
  KuCoin: 'https://www.cryptocompare.com/media/44081958/kucoin.png',
  Bitfinex: 'https://www.cryptocompare.com/media/37747208/bitfinex.png',
  WhiteBIT: 'https://assets.coingecko.com/markets/images/418/small/whitebit.jpeg',
  CoinEx: 'https://assets.coingecko.com/markets/images/135/small/coinex.jpeg',
  Drift: 'https://assets.coingecko.com/coins/images/28185/small/drift.png',
  GMX: 'https://assets.coingecko.com/coins/images/18323/small/arbit.png',
  Aevo: 'https://assets.coingecko.com/coins/images/35096/small/aevo.png',
  Bitunix: '',
};

export function getExchangeIcon(exchange: string): string | null {
  return EXCHANGE_ICONS[exchange] || null;
}

// CoinGecko image ID mapping (simplified - just use the numeric ID)
function getCoinGeckoImageId(coinId: string): number {
  const ids: Record<string, number> = {
    bitcoin: 1, ethereum: 279, solana: 4128, binancecoin: 825,
    ripple: 44, cardano: 975, dogecoin: 5, 'avalanche-2': 12559,
    chainlink: 877, 'the-open-network': 17980, polkadot: 12171,
    'matic-network': 4713, sui: 26375, aptos: 26455, near: 10365,
    arbitrum: 16547, optimism: 25244, filecoin: 12817, cosmos: 3794,
    'injective-protocol': 12882, pepe: 24613, dogwifcoin: 28752,
  };
  return ids[coinId] || 1;
}
