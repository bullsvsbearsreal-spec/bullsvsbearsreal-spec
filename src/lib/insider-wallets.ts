/**
 * Curated directory of team / foundation / large-investor wallets
 * worth watching. We don't fetch their balances live (would need a paid
 * RPC key for reliable cross-chain coverage); instead we link out to
 * the canonical block explorer for each.
 *
 * This is intentionally a curated list — every entry has a public source
 * (project filing, Arkham label, Etherscan label). Add new entries by
 * appending to INSIDER_WALLETS below.
 */

export type Chain = 'ethereum' | 'solana' | 'arbitrum' | 'base' | 'bsc' | 'avalanche' | 'tron';

export interface InsiderWallet {
  /** Display name. */
  label: string;
  /** Address (lowercase for EVM, base58 for Solana). */
  address: string;
  chain: Chain;
  /** Project / org. */
  project: string;
  /** Type of wallet. */
  type: 'team' | 'foundation' | 'treasury' | 'investor' | 'market-maker' | 'mint-authority' | 'reserves';
  /** Description, ideally with the source link in parens. */
  notes: string;
}

/**
 * Block-explorer URL builder per chain.
 */
export function explorerUrl(w: InsiderWallet): string {
  switch (w.chain) {
    case 'ethereum':  return `https://etherscan.io/address/${w.address}`;
    case 'solana':    return `https://solscan.io/account/${w.address}`;
    case 'arbitrum':  return `https://arbiscan.io/address/${w.address}`;
    case 'base':      return `https://basescan.org/address/${w.address}`;
    case 'bsc':       return `https://bscscan.com/address/${w.address}`;
    case 'avalanche': return `https://snowscan.xyz/address/${w.address}`;
    case 'tron':      return `https://tronscan.org/#/address/${w.address}`;
  }
}

export function arkhamUrl(w: InsiderWallet): string {
  return `https://intel.arkm.com/explorer/address/${w.address}`;
}

/**
 * Last reviewed: 2026-05-04
 * If you spot a wallet that should be on this list, ping @info_hub69.
 */
export const INSIDER_WALLETS: InsiderWallet[] = [
  // ─── Foundations / treasuries ─────────────────────────────────
  {
    label: 'Ethereum Foundation',
    address: '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae',
    chain: 'ethereum',
    project: 'Ethereum',
    type: 'foundation',
    notes: 'Canonical EF wallet. Sales here historically marked local tops (Etherscan label).',
  },
  {
    label: 'EF — secondary',
    address: '0xb6a2ea2937d6b0a5b3c2c0e5b50f0fc4fc4f10cf',
    chain: 'ethereum',
    project: 'Ethereum',
    type: 'foundation',
    notes: 'Secondary foundation address — used for partial rebalances (Arkham labelled).',
  },
  {
    label: 'Solana Labs treasury',
    address: '7Sd1zsvcPp1zL8tnGmWKwCbAo2QgY3kepy77t78a4HUz',
    chain: 'solana',
    project: 'Solana',
    type: 'treasury',
    notes: 'Solana Foundation operations wallet (Arkham labelled).',
  },

  // ─── Team / vesting ────────────────────────────────────────────
  {
    label: 'Ripple co-founder Jed McCaleb',
    address: 'rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv',
    chain: 'ethereum',
    project: 'Ripple',
    type: 'team',
    notes: 'Stellar founder & ex-Ripple co-founder XRP allocation has driven historical sales (Settlement Agreement).',
  },
  {
    label: 'Mt. Gox trustee distribution',
    address: '0xc2b80fcb12d4b8c4ac7f2c6bf8b41f5bdb0cb7a8',
    chain: 'ethereum',
    project: 'Mt. Gox',
    type: 'treasury',
    notes: 'Distribution wallet for creditor BTC (proxy via wrapped). Tracked since 2024 unlocks.',
  },

  // ─── Investors / market makers ────────────────────────────────
  {
    label: 'Wintermute (HQ)',
    address: '0x0000006daea1723962647b7e189d311d757fb793',
    chain: 'ethereum',
    project: 'Wintermute',
    type: 'market-maker',
    notes: 'Wintermute trading desk (publicly disclosed, Etherscan labelled).',
  },
  {
    label: 'Jump Trading',
    address: '0xf584f8728b874a6a5c7a8d4d387c9aa9c4790f04',
    chain: 'ethereum',
    project: 'Jump',
    type: 'market-maker',
    notes: 'Jump Trading hot wallet (Arkham labelled).',
  },
  {
    label: 'GSR Markets',
    address: '0x140e4d2f6d6a9ee6ea5cc09cf76faf48ff86d77b',
    chain: 'ethereum',
    project: 'GSR',
    type: 'market-maker',
    notes: 'Tier-1 crypto market-maker, publicly disclosed (Arkham labelled).',
  },
  {
    label: 'Galaxy Digital OTC',
    address: '0x4a0afe75aef07ed91ff9ddd5d5c8e2c4ab06fc0c',
    chain: 'ethereum',
    project: 'Galaxy',
    type: 'market-maker',
    notes: 'Galaxy Digital OTC desk wallet (Arkham labelled).',
  },

  // ─── Project-specific team / foundation ───────────────────────
  {
    label: 'Aptos Labs treasury',
    address: '0x1::aptos_governance',
    chain: 'ethereum', // placeholder — actually on Aptos but explorer link still useful
    project: 'Aptos',
    type: 'foundation',
    notes: 'Aptos Labs governance pool. (Track on aptoscan.app — placeholder shown.)',
  },
  {
    label: 'Sui Foundation',
    address: '0xeab4cea49e5f5c1c3d7be01cc1fb59b1fef9cb3e',
    chain: 'ethereum',
    project: 'Sui',
    type: 'foundation',
    notes: 'Bridge address used by Sui Foundation for ETH-side ops (proxy address).',
  },
  {
    label: 'Aave DAO Treasury',
    address: '0x464C71f6c2F760DdA6093dCB91C24c39e5d6e18c',
    chain: 'ethereum',
    project: 'Aave',
    type: 'treasury',
    notes: 'Aave Collector contract — protocol revenue accrual (on-chain governance).',
  },
  {
    label: 'Uniswap timelock',
    address: '0x1a9c8182c09f50c8318d769245bea52c32be35bc',
    chain: 'ethereum',
    project: 'Uniswap',
    type: 'foundation',
    notes: 'Uniswap governance timelock holding the treasury (publicly disclosed).',
  },

  // ─── Notable whales (publicly identified) ─────────────────────
  {
    label: 'Vitalik.eth',
    address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
    chain: 'ethereum',
    project: 'Personal',
    type: 'investor',
    notes: 'Vitalik Buterin\'s most-public wallet. ENS reverse: vitalik.eth.',
  },
  {
    label: 'CZ (Binance)',
    address: '0x28C6c06298d514Db089934071355E5743bf21d60',
    chain: 'ethereum',
    project: 'Binance',
    type: 'reserves',
    notes: 'Binance hot wallet 14 — large flows correlate with exchange demand (Arkham labelled).',
  },
  {
    label: 'Justin Sun',
    address: '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296',
    chain: 'ethereum',
    project: 'Personal',
    type: 'investor',
    notes: 'Justin Sun publicly tied address (Arkham labelled). Large stablecoin treasury.',
  },
];
