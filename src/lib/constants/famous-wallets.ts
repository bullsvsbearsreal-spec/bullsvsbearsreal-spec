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

  // ── Institutions ──────────────────────────────────────────
  { label: 'MicroStrategy', address: 'bc1qazcm763858nkj2dz7g0ntv97kpc62dz4y5cyd', chain: 'btc', category: 'institutions', description: 'Michael Saylor BTC treasury' },
  { label: 'Tesla', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', chain: 'btc', category: 'institutions', description: 'Tesla BTC holdings' },
  { label: 'BlackRock iShares', address: '0x0A2815Cb7Ed5E9BF1B00110E34deBD2615d4E050', chain: 'eth', category: 'institutions', description: 'iShares Bitcoin Trust (IBIT)' },
  { label: 'Fidelity FBTC', address: '0xC8bf56Ccc716626A780E42a01C26f31F0a65e1dA', chain: 'eth', category: 'institutions', description: 'Fidelity Wise Origin Bitcoin Fund' },

  // ── CEX Wallets ──────────────────────────────────────────
  { label: 'Binance Hot', address: '0x28C6c06298d514Db089934071355E5743bf21d60', chain: 'eth', category: 'cex-wallets', description: 'Binance hot wallet' },
  { label: 'Binance Cold', address: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', chain: 'eth', category: 'cex-wallets', description: 'Binance cold storage' },
  { label: 'Coinbase Prime', address: '0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43', chain: 'eth', category: 'cex-wallets', description: 'Coinbase institutional' },
  { label: 'Coinbase Cold', address: '0xBc11295936Aa79d594139de1B2e12629414F3BDB', chain: 'eth', category: 'cex-wallets', description: 'Coinbase cold wallet 2' },
  { label: 'Kraken', address: '0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0', chain: 'eth', category: 'cex-wallets', description: 'Kraken exchange' },
  { label: 'Bitfinex', address: '0x1151314c646Ce4E0eFD76d1aF4760aE66a9Fe30F', chain: 'eth', category: 'cex-wallets', description: 'Bitfinex cold wallet' },
  { label: 'OKX', address: '0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b', chain: 'eth', category: 'cex-wallets', description: 'OKX exchange' },
  { label: 'Bybit', address: '0xf89d7b9c864f589bbF53a82105107622B35EaA40', chain: 'eth', category: 'cex-wallets', description: 'Bybit exchange' },

  // ── DEX Treasuries ──────────────────────────────────────────
  { label: 'Uniswap Treasury', address: '0x1a9C8182C09F50C8318d769245beA52c32BE35BC', chain: 'eth', category: 'dex-treasuries', description: 'Uniswap governance treasury' },
  { label: 'Aave Treasury', address: '0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c', chain: 'eth', category: 'dex-treasuries', description: 'Aave V3 collector' },
  { label: 'Compound Timelock', address: '0x6d903f6003cca6255D85CcA4D3B5E5146dC33925', chain: 'eth', category: 'dex-treasuries', description: 'Compound governance timelock' },
  { label: 'Lido DAO', address: '0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c', chain: 'eth', category: 'dex-treasuries', description: 'Lido DAO treasury' },

  // ── KOLs ──────────────────────────────────────────────────
  { label: 'Cobie', address: '0x4Cbe68d825d21cB4978F56815613eeD06Cf30152', chain: 'eth', category: 'kols', description: 'Crypto KOL / UpOnly' },
  { label: 'Arthur Hayes', address: '0x94845333028B1204Fbe14E1278Fd4Adde46B22ce', chain: 'eth', category: 'kols', description: 'BitMEX co-founder' },
  { label: 'GCR', address: '0x2e1f23DAe3f1b242b4f8b3fCE70BD7D8F4d1dBFf', chain: 'eth', category: 'kols', description: 'Gigantic Rebirth / GCR' },
  { label: 'Hsaka', address: '0x7431310e026B69BFC676C0013E12A1A11068Df23', chain: 'eth', category: 'kols', description: 'Crypto trader / analyst' },

  // ── Whales ──────────────────────────────────────────────────
  { label: 'BTC Genesis', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', chain: 'btc', category: 'whales', description: 'Satoshi Nakamoto genesis block' },
  { label: 'Wrapped BTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', chain: 'eth', category: 'whales', description: 'WBTC contract' },
  { label: 'ETH Whale 1', address: '0x00000000219ab540356cBB839Cbe05303d7705Fa', chain: 'eth', category: 'whales', description: 'ETH 2.0 Deposit Contract' },
  { label: 'Jump Trading', address: '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621', chain: 'eth', category: 'whales', description: 'Jump Trading / Crypto' },
  { label: 'SOL Whale', address: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', chain: 'sol', category: 'whales', description: 'Large Solana holder' },
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
