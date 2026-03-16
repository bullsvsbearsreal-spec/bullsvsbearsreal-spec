export interface FamousWallet {
  label: string;
  address: string;
  chain: 'eth' | 'btc' | 'sol';
  category: WalletCategory;
  description?: string;
}

export type WalletCategory =
  | 'defi-builders'
  | 'institutions'
  | 'cex-wallets'
  | 'dex-treasuries'
  | 'kols'
  | 'whales';

export const WALLET_CATEGORIES: Record<WalletCategory, { label: string }> = {
  'defi-builders': { label: 'DeFi Builders' },
  'institutions': { label: 'Institutions' },
  'cex-wallets': { label: 'CEX Wallets' },
  'dex-treasuries': { label: 'DEX Treasuries' },
  'kols': { label: 'KOLs' },
  'whales': { label: 'Whales' },
};

export const FAMOUS_WALLETS: FamousWallet[] = [
  // ── DeFi Builders ──────────────────────────────────────────
  { label: 'Vitalik Buterin', address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', chain: 'eth', category: 'defi-builders', description: 'Ethereum co-founder' },
  { label: 'Andre Cronje', address: '0x2D407dDb06311396fE14D4b49da5F0471447d45C', chain: 'eth', category: 'defi-builders', description: 'Yearn / Fantom founder' },
  { label: 'Hayden Adams', address: '0x11E4857Bb9993a50c685A79AFad4E6F65D518DDa', chain: 'eth', category: 'defi-builders', description: 'Uniswap creator' },
  { label: 'Stani Kulechov', address: '0x6Bd59F6d2aDA593695b9a0C7a193C24C78C793e0', chain: 'eth', category: 'defi-builders', description: 'Aave founder' },
  { label: 'Ansem', address: '9EYEWbFFeXxyZSixUaCkfQjbiMDGxnZQycGuAhbMjFjg', chain: 'sol', category: 'defi-builders', description: 'Solana ecosystem builder' },
  { label: 'Robert Leshner', address: '0x34039aF7159CfC1e0c44e7e09F1E040FC32a6964', chain: 'eth', category: 'defi-builders', description: 'Compound founder' },
  { label: 'Sam Bankman-Fried', address: '0x477573f212A7bdD5F7C12889bd1ad0aA44fb82aa', chain: 'eth', category: 'defi-builders', description: 'FTX founder (seized)' },
  { label: 'Justin Sun', address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'eth', category: 'defi-builders', description: 'TRON / Poloniex founder' },
  { label: 'toly (Anatoly)', address: 'toly.sol', chain: 'sol', category: 'defi-builders', description: 'Solana co-founder' },

  // ── Institutions ──────────────────────────────────────────
  { label: 'MicroStrategy', address: 'bc1qazcm763858nkj2dz7g0ntv97kpc62dz4y5cyd', chain: 'btc', category: 'institutions', description: 'Michael Saylor BTC treasury' },
  { label: 'Tesla', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', chain: 'btc', category: 'institutions', description: 'Tesla BTC holdings' },
  { label: 'BlackRock iShares', address: '0x0A2815Cb7Ed5E9BF1B00110E34deBD2615d4E050', chain: 'eth', category: 'institutions', description: 'iShares Bitcoin Trust (IBIT)' },
  { label: 'Fidelity FBTC', address: '0xC8bf56Ccc716626A780E42a01C26f31F0a65e1dA', chain: 'eth', category: 'institutions', description: 'Fidelity Wise Origin Bitcoin Fund' },
  { label: 'Grayscale GBTC', address: '0x7Be3D1DE1Bd08b52A837B5eCDd89A1e3d0270A6D', chain: 'eth', category: 'institutions', description: 'Grayscale Bitcoin Trust' },
  { label: 'Ethereum Foundation', address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe', chain: 'eth', category: 'institutions', description: 'Ethereum Foundation treasury' },
  { label: 'Paradigm', address: '0x3A23F943181408EAC424116Af7b7790c94Cb97a5', chain: 'eth', category: 'institutions', description: 'Paradigm venture fund' },
  { label: 'a16z Crypto', address: '0x05E793cE0C6027323Ac150F6d45C2344d28B6019', chain: 'eth', category: 'institutions', description: 'Andreessen Horowitz crypto' },
  { label: 'Galaxy Digital', address: '0x6EcE0B6E31dB0d0Da9D4CC3a75B57C57668D1798', chain: 'eth', category: 'institutions', description: 'Galaxy Digital Holdings' },

  // ── CEX Wallets ──────────────────────────────────────────
  { label: 'Binance Hot', address: '0x28C6c06298d514Db089934071355E5743bf21d60', chain: 'eth', category: 'cex-wallets', description: 'Binance hot wallet' },
  { label: 'Binance Cold', address: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', chain: 'eth', category: 'cex-wallets', description: 'Binance cold storage' },
  { label: 'Binance 8', address: '0xF977814e90dA44bFA03b6295A0616a897441aceC', chain: 'eth', category: 'cex-wallets', description: 'Binance wallet 8' },
  { label: 'Coinbase Prime', address: '0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43', chain: 'eth', category: 'cex-wallets', description: 'Coinbase institutional' },
  { label: 'Coinbase Cold', address: '0xBc11295936Aa79d594139de1B2e12629414F3BDB', chain: 'eth', category: 'cex-wallets', description: 'Coinbase cold wallet 2' },
  { label: 'Kraken', address: '0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0', chain: 'eth', category: 'cex-wallets', description: 'Kraken exchange' },
  { label: 'Bitfinex', address: '0x1151314c646Ce4E0eFD76d1aF4760aE66a9Fe30F', chain: 'eth', category: 'cex-wallets', description: 'Bitfinex cold wallet' },
  { label: 'OKX', address: '0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b', chain: 'eth', category: 'cex-wallets', description: 'OKX exchange' },
  { label: 'Bybit', address: '0xf89d7b9c864f589bbF53a82105107622B35EaA40', chain: 'eth', category: 'cex-wallets', description: 'Bybit exchange' },
  { label: 'KuCoin', address: '0xD6216fC19DB775Df9774a6E33526131dA7D19a2c', chain: 'eth', category: 'cex-wallets', description: 'KuCoin hot wallet' },
  { label: 'Gemini', address: '0x5f65f7b609678448494De4C87521CdF6cEf1e932', chain: 'eth', category: 'cex-wallets', description: 'Gemini exchange' },
  { label: 'Crypto.com', address: '0x6262998Ced04146fA42253a5C0AF90CA02dfd2A3', chain: 'eth', category: 'cex-wallets', description: 'Crypto.com exchange' },
  { label: 'Gate.io', address: '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', chain: 'eth', category: 'cex-wallets', description: 'Gate.io exchange' },
  { label: 'HTX (Huobi)', address: '0x5C985E89DDe482eFE97ea9f1950aD149Eb73829B', chain: 'eth', category: 'cex-wallets', description: 'HTX / Huobi exchange' },

  // ── DEX Treasuries ──────────────────────────────────────────
  { label: 'Uniswap Treasury', address: '0x1a9C8182C09F50C8318d769245beA52c32BE35BC', chain: 'eth', category: 'dex-treasuries', description: 'Uniswap governance treasury' },
  { label: 'Aave Treasury', address: '0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c', chain: 'eth', category: 'dex-treasuries', description: 'Aave V3 collector' },
  { label: 'Compound Timelock', address: '0x6d903f6003cca6255D85CcA4D3B5E5146dC33925', chain: 'eth', category: 'dex-treasuries', description: 'Compound governance timelock' },
  { label: 'Lido DAO', address: '0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c', chain: 'eth', category: 'dex-treasuries', description: 'Lido DAO treasury' },
  { label: 'MakerDAO', address: '0xBE8E3e3618f7474F8cB1d074A26afFef007E98FB', chain: 'eth', category: 'dex-treasuries', description: 'MakerDAO / Sky treasury' },
  { label: 'Curve Treasury', address: '0xeCb456EA5365865EbAb8a2661B0c503410e9B347', chain: 'eth', category: 'dex-treasuries', description: 'Curve Finance treasury' },
  { label: 'Sushiswap Treasury', address: '0xe94B5EEC1fA96CEecbD33EF5Baa8d00E4493F4f3', chain: 'eth', category: 'dex-treasuries', description: 'Sushiswap ops multisig' },
  { label: 'dYdX Treasury', address: '0xE710CEd57456D3A16152c32835B5FB4E72D9eA5b', chain: 'eth', category: 'dex-treasuries', description: 'dYdX community treasury' },
  { label: 'Arbitrum DAO', address: '0xF3FC178157fb3c87548bAA86F9d24BA38E649B58', chain: 'eth', category: 'dex-treasuries', description: 'Arbitrum DAO treasury' },
  { label: 'Optimism Treasury', address: '0x2501c477D0A35545a387Aa4A3EEe4292A9a8B3F0', chain: 'eth', category: 'dex-treasuries', description: 'Optimism governance fund' },

  // ── KOLs ──────────────────────────────────────────────────
  { label: 'Cobie', address: '0x4Cbe68d825d21cB4978F56815613eeD06Cf30152', chain: 'eth', category: 'kols', description: 'Crypto KOL / UpOnly' },
  { label: 'Arthur Hayes', address: '0x94845333028B1204Fbe14E1278Fd4Adde46B22ce', chain: 'eth', category: 'kols', description: 'BitMEX co-founder' },
  { label: 'GCR', address: '0x2e1f23DAe3f1b242b4f8b3fCE70BD7D8F4d1dBFf', chain: 'eth', category: 'kols', description: 'Gigantic Rebirth / GCR' },
  { label: 'Hsaka', address: '0x7431310e026B69BFC676C0013E12A1A11068Df23', chain: 'eth', category: 'kols', description: 'Crypto trader / analyst' },
  { label: 'Tetranode', address: '0x9c5083dd4838E120Dbeac44C052179692Aa5dAC5', chain: 'eth', category: 'kols', description: 'DeFi whale / KOL' },
  { label: 'DegenSpartan', address: '0x76F948E5F13B9A84A81E5681df8682BBf524805e', chain: 'eth', category: 'kols', description: 'DeFi degen / trader' },
  { label: 'Lookonchain', address: '0xDbF5E9c5206d0dB70a90108bf936DA60221dC080', chain: 'eth', category: 'kols', description: 'On-chain analytics' },
  { label: 'CL207', address: '0x3bce14553aa54FF2D2fD92D32EBf3607dBaA4935', chain: 'eth', category: 'kols', description: 'Crypto trader' },

  // ── Whales ──────────────────────────────────────────────────
  { label: 'BTC Genesis', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', chain: 'btc', category: 'whales', description: 'Satoshi Nakamoto genesis block' },
  { label: 'Wrapped BTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', chain: 'eth', category: 'whales', description: 'WBTC contract' },
  { label: 'ETH 2.0 Deposit', address: '0x00000000219ab540356cBB839Cbe05303d7705Fa', chain: 'eth', category: 'whales', description: 'Beacon chain deposit contract' },
  { label: 'Jump Trading', address: '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621', chain: 'eth', category: 'whales', description: 'Jump Trading / Crypto' },
  { label: 'SOL Whale', address: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', chain: 'sol', category: 'whales', description: 'Large Solana holder' },
  { label: 'Wintermute', address: '0x0000000fe6A514a32aBDCDfcc076C85243De899b', chain: 'eth', category: 'whales', description: 'Wintermute trading' },
  { label: 'Alameda Research', address: '0x84D34f4f83a87596Cd3FB6887cFf8F17Bf5A7B83', chain: 'eth', category: 'whales', description: 'Alameda (seized assets)' },
  { label: 'Tether Treasury', address: '0x5754284f345afc66a98fbB0a0Afe71e0F007B949', chain: 'eth', category: 'whales', description: 'Tether USDT treasury' },
  { label: 'Circle (USDC)', address: '0x55FE002aefF02F77364de339a1292923A15844B8', chain: 'eth', category: 'whales', description: 'Circle USDC reserve' },
  { label: 'Celsius', address: '0x8aceab8167c80cb8b3de7fa6228b1c6c3ee82346', chain: 'eth', category: 'whales', description: 'Celsius Network (bankrupt)' },
  { label: 'Three Arrows', address: '0x4862733B5FdDFd35f35ea8CCf08F5045e57388B3', chain: 'eth', category: 'whales', description: '3AC (liquidated)' },
  { label: 'Dragonfly', address: '0x002A5dc50bB2EfbE5b7c3580B4dF5b3d34a0f37A', chain: 'eth', category: 'whales', description: 'Dragonfly Capital' },
];

/** Get top wallets (one per category) for quick-add bar */
export function getQuickAddWallets(count = 6): FamousWallet[] {
  const seen = new Set<WalletCategory>();
  const result: FamousWallet[] = [];
  for (const w of FAMOUS_WALLETS) {
    if (seen.has(w.category)) continue;
    seen.add(w.category);
    result.push(w);
    if (result.length >= count) break;
  }
  return result;
}
