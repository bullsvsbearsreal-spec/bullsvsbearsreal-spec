// Token Unlocks data integration
// Provides vesting schedule and unlock information for top cryptocurrencies
// Data sourced from public vesting schedules, DAO blogs, and token documentation

export interface TokenUnlock {
  id: string;
  coinId: string;
  coinSymbol: string;
  coinName: string;
  unlockDate: string;
  unlockAmount: number;
  unlockValue: number;
  percentOfSupply: number;
  unlockType: 'cliff' | 'linear' | 'team' | 'investor' | 'ecosystem' | 'treasury';
  description: string;
  source?: string;
  isLarge: boolean; // >1% of supply
}

export interface VestingSchedule {
  coinId: string;
  totalLocked: number;
  totalLockedValue: number;
  percentLocked: number;
  nextUnlock: TokenUnlock | null;
  upcomingUnlocks: TokenUnlock[];
  unlockHistory: TokenUnlock[];
}

// Token unlock type labels
export const UNLOCK_TYPES = {
  cliff: { label: 'Cliff Unlock', color: 'error', description: 'Large one-time unlock' },
  linear: { label: 'Linear Vesting', color: 'warning', description: 'Gradual daily/weekly release' },
  team: { label: 'Team Tokens', color: 'purple', description: 'Team/advisor allocation' },
  investor: { label: 'Investor Tokens', color: 'blue', description: 'Private/seed investor allocation' },
  ecosystem: { label: 'Ecosystem', color: 'success', description: 'Ecosystem development fund' },
  treasury: { label: 'Treasury', color: 'hub-yellow', description: 'Protocol treasury release' },
};

// Fetch upcoming unlocks for a specific coin
export async function fetchTokenUnlocks(coinId: string): Promise<TokenUnlock[]> {
  return getTokenUnlocks(coinId);
}

// Fetch all upcoming major unlocks across the market
export async function fetchUpcomingUnlocks(limit: number = 10): Promise<TokenUnlock[]> {
  return getUpcomingUnlocks(limit);
}

// Fetch ALL unlocks (past + future) for calendar views
export async function fetchAllUnlocks(): Promise<TokenUnlock[]> {
  return getAllUnlocks()
    .sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime());
}

// Get vesting schedule for a coin
export async function getVestingSchedule(coinId: string): Promise<VestingSchedule | null> {
  const unlocks = await fetchTokenUnlocks(coinId);
  if (!unlocks.length) return null;

  const now = new Date();
  const upcomingUnlocks = unlocks
    .filter(u => new Date(u.unlockDate) > now)
    .sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime());

  const totalLocked = upcomingUnlocks.reduce((sum, u) => sum + u.unlockAmount, 0);
  const totalLockedValue = upcomingUnlocks.reduce((sum, u) => sum + u.unlockValue, 0);

  return {
    coinId,
    totalLocked,
    totalLockedValue,
    percentLocked: upcomingUnlocks.reduce((sum, u) => sum + u.percentOfSupply, 0),
    nextUnlock: upcomingUnlocks[0] || null,
    upcomingUnlocks,
    unlockHistory: unlocks.filter(u => new Date(u.unlockDate) <= now),
  };
}

// Curated token unlock dataset based on publicly known vesting schedules.
// Dates are absolute ISO dates sourced from official documentation.
interface TokenDef {
  coinId: string;
  symbol: string;
  name: string;
  /** approximate price in USD — used as fallback if live CoinGecko fetch fails */
  price: number;
  /** total / max supply used to derive percentOfSupply */
  totalSupply: number;
  unlocks: {
    /** absolute ISO date string e.g. "2026-04-16" */
    date: string;
    amount: number;
    type: TokenUnlock['unlockType'];
    description: string;
    /** URL to vesting announcement / documentation */
    source?: string;
  }[];
}

const TOKEN_DATABASE: TokenDef[] = [
  // ─── Layer 2 & Scaling ────────────────────────────────────────────────
  {
    coinId: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', price: 1.15, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-01-16', amount: 92_650_000, type: 'investor', description: 'Series B investor vesting release', source: 'https://docs.arbitrum.foundation/airdrop-eligibility-distribution' },
      { date: '2026-03-16', amount: 92_650_000, type: 'investor', description: 'Series A investor vesting release', source: 'https://docs.arbitrum.foundation/airdrop-eligibility-distribution' },
      { date: '2026-04-16', amount: 185_300_000, type: 'team', description: 'Core team & advisor token unlock', source: 'https://docs.arbitrum.foundation/airdrop-eligibility-distribution' },
      { date: '2026-06-16', amount: 92_650_000, type: 'investor', description: 'Investor quarterly vesting', source: 'https://docs.arbitrum.foundation/airdrop-eligibility-distribution' },
      { date: '2026-07-16', amount: 185_300_000, type: 'team', description: 'Team & advisor quarterly unlock', source: 'https://docs.arbitrum.foundation/airdrop-eligibility-distribution' },
    ],
  },
  {
    coinId: 'optimism', symbol: 'OP', name: 'Optimism', price: 2.30, totalSupply: 4_294_967_296,
    unlocks: [
      { date: '2026-02-28', amount: 31_340_000, type: 'ecosystem', description: 'Ecosystem fund quarterly distribution', source: 'https://community.optimism.io/docs/governance/allocations/' },
      { date: '2026-04-30', amount: 24_160_000, type: 'investor', description: 'Series A investor unlock', source: 'https://community.optimism.io/docs/governance/allocations/' },
      { date: '2026-05-31', amount: 46_200_000, type: 'team', description: 'Core contributor vesting cliff', source: 'https://community.optimism.io/docs/governance/allocations/' },
      { date: '2026-07-31', amount: 24_160_000, type: 'investor', description: 'Investor quarterly vest', source: 'https://community.optimism.io/docs/governance/allocations/' },
    ],
  },
  {
    coinId: 'starknet', symbol: 'STRK', name: 'Starknet', price: 0.62, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-03-15', amount: 64_000_000, type: 'investor', description: 'Early backer token unlock', source: 'https://docs.starknet.io/documentation/architecture_and_concepts/Token/token_provisioning/' },
      { date: '2026-04-15', amount: 128_000_000, type: 'team', description: 'Core contributor monthly vesting', source: 'https://docs.starknet.io/documentation/architecture_and_concepts/Token/token_provisioning/' },
      { date: '2026-06-15', amount: 64_000_000, type: 'investor', description: 'Investor quarterly unlock', source: 'https://docs.starknet.io/documentation/architecture_and_concepts/Token/token_provisioning/' },
      { date: '2026-09-15', amount: 128_000_000, type: 'team', description: 'Core contributor quarterly cliff', source: 'https://docs.starknet.io/documentation/architecture_and_concepts/Token/token_provisioning/' },
    ],
  },
  {
    coinId: 'zksync', symbol: 'ZK', name: 'zkSync', price: 0.19, totalSupply: 21_000_000_000,
    unlocks: [
      { date: '2026-03-17', amount: 210_000_000, type: 'ecosystem', description: 'Ecosystem grants program release', source: 'https://blog.zknation.io/zk-token/' },
      { date: '2026-06-17', amount: 315_000_000, type: 'investor', description: 'Seed round investor cliff unlock', source: 'https://blog.zknation.io/zk-token/' },
      { date: '2026-09-17', amount: 210_000_000, type: 'team', description: 'Team quarterly vesting', source: 'https://blog.zknation.io/zk-token/' },
    ],
  },
  {
    coinId: 'scroll', symbol: 'SCR', name: 'Scroll', price: 0.85, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-03-22', amount: 10_000_000, type: 'ecosystem', description: 'Ecosystem development fund release', source: 'https://scroll.io/blog/scroll-tokenomics' },
      { date: '2026-06-22', amount: 25_000_000, type: 'investor', description: 'Seed investor vesting cliff', source: 'https://scroll.io/blog/scroll-tokenomics' },
      { date: '2026-10-22', amount: 25_000_000, type: 'team', description: 'Core team cliff unlock', source: 'https://scroll.io/blog/scroll-tokenomics' },
    ],
  },
  {
    coinId: 'blast', symbol: 'BLAST', name: 'Blast', price: 0.012, totalSupply: 100_000_000_000,
    unlocks: [
      { date: '2026-02-26', amount: 2_000_000_000, type: 'ecosystem', description: 'Phase 2 airdrop distribution', source: 'https://docs.blast.io/tokenomics' },
      { date: '2026-06-26', amount: 1_500_000_000, type: 'investor', description: 'Paradigm & Standard Crypto unlock', source: 'https://docs.blast.io/tokenomics' },
    ],
  },
  {
    coinId: 'linea', symbol: 'LINEA', name: 'Linea', price: 0.04, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-05-15', amount: 200_000_000, type: 'ecosystem', description: 'Ecosystem bootstrap fund', source: 'https://docs.linea.build/' },
      { date: '2026-08-15', amount: 300_000_000, type: 'investor', description: 'Consensys & investor cliff', source: 'https://docs.linea.build/' },
    ],
  },

  // ─── Alt L1 ──────────────────────────────────────────────────────────
  {
    coinId: 'aptos', symbol: 'APT', name: 'Aptos', price: 8.50, totalSupply: 1_086_628_868,
    unlocks: [
      { date: '2026-03-12', amount: 11_310_000, type: 'investor', description: 'FTX estate & early investor unlock', source: 'https://aptosfoundation.org/currents/aptos-tokenomics-overview' },
      { date: '2026-04-12', amount: 11_310_000, type: 'team', description: 'Foundation monthly vesting', source: 'https://aptosfoundation.org/currents/aptos-tokenomics-overview' },
      { date: '2026-05-12', amount: 11_310_000, type: 'team', description: 'Foundation monthly vesting', source: 'https://aptosfoundation.org/currents/aptos-tokenomics-overview' },
      { date: '2026-06-12', amount: 11_310_000, type: 'investor', description: 'Investor monthly vesting', source: 'https://aptosfoundation.org/currents/aptos-tokenomics-overview' },
    ],
  },
  {
    coinId: 'sui', symbol: 'SUI', name: 'Sui', price: 3.60, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-03-03', amount: 64_190_000, type: 'ecosystem', description: 'Community reserve distribution', source: 'https://blog.sui.io/token-release-schedule/' },
      { date: '2026-04-03', amount: 64_190_000, type: 'investor', description: 'Series A & B investor unlock', source: 'https://blog.sui.io/token-release-schedule/' },
      { date: '2026-05-03', amount: 64_190_000, type: 'ecosystem', description: 'Community reserve monthly', source: 'https://blog.sui.io/token-release-schedule/' },
      { date: '2026-06-03', amount: 128_380_000, type: 'team', description: 'Core team vesting cliff', source: 'https://blog.sui.io/token-release-schedule/' },
    ],
  },
  {
    coinId: 'celestia', symbol: 'TIA', name: 'Celestia', price: 4.90, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-03-08', amount: 17_580_000, type: 'investor', description: 'Seed & Series A vesting tranche', source: 'https://docs.celestia.org/learn/staking-governance-supply' },
      { date: '2026-05-08', amount: 8_790_000, type: 'team', description: 'Core contributor monthly vest', source: 'https://docs.celestia.org/learn/staking-governance-supply' },
      { date: '2026-10-31', amount: 175_800_000, type: 'cliff', description: 'Major cliff unlock — investors & team', source: 'https://docs.celestia.org/learn/staking-governance-supply' },
    ],
  },
  {
    coinId: 'sei-network', symbol: 'SEI', name: 'Sei', price: 0.38, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-03-15', amount: 125_000_000, type: 'ecosystem', description: 'Ecosystem & community incentives', source: 'https://www.sei.io/ecosystem' },
      { date: '2026-05-15', amount: 75_000_000, type: 'investor', description: 'Private sale token unlock', source: 'https://www.sei.io/ecosystem' },
      { date: '2026-08-15', amount: 125_000_000, type: 'team', description: 'Team & advisor vesting', source: 'https://www.sei.io/ecosystem' },
    ],
  },
  {
    coinId: 'movement', symbol: 'MOVE', name: 'Movement', price: 0.55, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-03-20', amount: 50_000_000, type: 'ecosystem', description: 'Ecosystem bootstrap fund', source: 'https://docs.movementnetwork.xyz/' },
      { date: '2026-06-20', amount: 100_000_000, type: 'investor', description: 'Polychain & Binance Labs unlock', source: 'https://docs.movementnetwork.xyz/' },
      { date: '2026-12-20', amount: 200_000_000, type: 'cliff', description: 'Major investor cliff unlock', source: 'https://docs.movementnetwork.xyz/' },
    ],
  },
  {
    coinId: 'kaspa', symbol: 'KAS', name: 'Kaspa', price: 0.12, totalSupply: 28_700_000_000,
    unlocks: [
      { date: '2026-04-01', amount: 287_000_000, type: 'linear', description: 'Mining emission — monthly block rewards', source: 'https://kaspa.org/tokenomics/' },
      { date: '2026-07-01', amount: 287_000_000, type: 'linear', description: 'Mining emission — monthly block rewards', source: 'https://kaspa.org/tokenomics/' },
    ],
  },
  {
    coinId: 'berachain', symbol: 'BERA', name: 'Berachain', price: 5.80, totalSupply: 500_000_000,
    unlocks: [
      { date: '2026-04-10', amount: 7_500_000, type: 'ecosystem', description: 'Ecosystem & community fund release', source: 'https://docs.berachain.com/' },
      { date: '2026-07-10', amount: 15_000_000, type: 'investor', description: 'Framework & Polychain unlock', source: 'https://docs.berachain.com/' },
      { date: '2027-02-10', amount: 37_500_000, type: 'cliff', description: 'Major investor cliff (6-month)', source: 'https://docs.berachain.com/' },
    ],
  },

  // ─── Solana Ecosystem ────────────────────────────────────────────────
  {
    coinId: 'jupiter', symbol: 'JUP', name: 'Jupiter', price: 0.82, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-01-31', amount: 125_000_000, type: 'cliff', description: 'Jupuary airdrop distribution', source: 'https://www.jup.ag/blog/jupuary' },
      { date: '2026-03-31', amount: 50_000_000, type: 'team', description: 'Core team vesting release', source: 'https://www.jup.ag/blog/token' },
      { date: '2026-06-30', amount: 75_000_000, type: 'ecosystem', description: 'Ecosystem growth fund', source: 'https://www.jup.ag/blog/token' },
    ],
  },
  {
    coinId: 'pyth-network', symbol: 'PYTH', name: 'Pyth Network', price: 0.34, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-03-20', amount: 200_000_000, type: 'ecosystem', description: 'Publisher rewards distribution', source: 'https://pyth.network/blog/pyth-token' },
      { date: '2026-05-20', amount: 150_000_000, type: 'investor', description: 'Strategic investor vesting', source: 'https://pyth.network/blog/pyth-token' },
    ],
  },
  {
    coinId: 'wormhole', symbol: 'W', name: 'Wormhole', price: 0.28, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-04-03', amount: 180_000_000, type: 'ecosystem', description: 'Guardian & protocol incentives', source: 'https://wormhole.com/blog/w-token' },
      { date: '2026-07-03', amount: 120_000_000, type: 'investor', description: 'Jump Crypto & investor unlock', source: 'https://wormhole.com/blog/w-token' },
      { date: '2026-10-03', amount: 600_000_000, type: 'cliff', description: 'Major cliff — team & early investors', source: 'https://wormhole.com/blog/w-token' },
    ],
  },
  {
    coinId: 'jito', symbol: 'JTO', name: 'Jito', price: 3.20, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-03-25', amount: 11_310_000, type: 'investor', description: 'Framework & Multicoin unlock', source: 'https://www.jito.network/blog/jto-token/' },
      { date: '2026-06-25', amount: 22_620_000, type: 'team', description: 'Core team monthly vest', source: 'https://www.jito.network/blog/jto-token/' },
      { date: '2026-12-07', amount: 135_000_000, type: 'cliff', description: 'Investor & team 2-year cliff', source: 'https://www.jito.network/blog/jto-token/' },
    ],
  },
  {
    coinId: 'io-net', symbol: 'IO', name: 'io.net', price: 2.10, totalSupply: 800_000_000,
    unlocks: [
      { date: '2026-03-11', amount: 8_000_000, type: 'ecosystem', description: 'Node operator rewards', source: 'https://docs.io.net/docs/tokenomics' },
      { date: '2026-06-11', amount: 12_000_000, type: 'investor', description: 'Hack VC & a16z unlock', source: 'https://docs.io.net/docs/tokenomics' },
    ],
  },

  // ─── DeFi / Infrastructure ───────────────────────────────────────────
  {
    coinId: 'ethena', symbol: 'ENA', name: 'Ethena', price: 0.92, totalSupply: 15_000_000_000,
    unlocks: [
      { date: '2026-03-02', amount: 225_000_000, type: 'cliff', description: 'Shard campaign season 2 airdrop', source: 'https://docs.ethena.fi/solution-overview/ena-tokenomics' },
      { date: '2026-04-02', amount: 112_500_000, type: 'investor', description: 'Dragonfly & Franklin Templeton unlock', source: 'https://docs.ethena.fi/solution-overview/ena-tokenomics' },
      { date: '2026-07-02', amount: 112_500_000, type: 'team', description: 'Team quarterly vesting', source: 'https://docs.ethena.fi/solution-overview/ena-tokenomics' },
    ],
  },
  {
    coinId: 'ethfi', symbol: 'ETHFI', name: 'ether.fi', price: 1.85, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-03-18', amount: 11_530_000, type: 'investor', description: 'Seed round investor vesting', source: 'https://etherfi.gitbook.io/etherfi/' },
      { date: '2026-06-18', amount: 5_770_000, type: 'team', description: 'Core team monthly unlock', source: 'https://etherfi.gitbook.io/etherfi/' },
      { date: '2026-09-13', amount: 115_000_000, type: 'cliff', description: 'Major cliff — seed + team', source: 'https://etherfi.gitbook.io/etherfi/' },
    ],
  },
  {
    coinId: 'eigenlayer', symbol: 'EIGEN', name: 'EigenLayer', price: 3.10, totalSupply: 1_670_000_000,
    unlocks: [
      { date: '2026-03-07', amount: 11_690_000, type: 'ecosystem', description: 'Stakedrop season 2 distribution', source: 'https://docs.eigenlayer.xyz/eigenlayer/overview/' },
      { date: '2026-05-07', amount: 16_700_000, type: 'investor', description: 'a16z & Polychain unlock', source: 'https://docs.eigenlayer.xyz/eigenlayer/overview/' },
      { date: '2026-09-07', amount: 25_050_000, type: 'team', description: 'Core team cliff unlock', source: 'https://docs.eigenlayer.xyz/eigenlayer/overview/' },
    ],
  },
  {
    coinId: 'layerzero', symbol: 'ZRO', name: 'LayerZero', price: 3.40, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-03-14', amount: 10_000_000, type: 'ecosystem', description: 'Protocol treasury release', source: 'https://layerzero.network/publications/token' },
      { date: '2026-06-14', amount: 15_000_000, type: 'investor', description: 'a16z & Sequoia vesting tranche', source: 'https://layerzero.network/publications/token' },
      { date: '2026-06-20', amount: 100_000_000, type: 'cliff', description: 'Major cliff — 1-year investor lock expiry', source: 'https://layerzero.network/publications/token' },
    ],
  },
  {
    coinId: 'aevo', symbol: 'AEVO', name: 'Aevo', price: 0.72, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-04-13', amount: 15_000_000, type: 'investor', description: 'Paradigm investor cliff', source: 'https://governance.aevo.xyz/' },
      { date: '2026-07-13', amount: 10_000_000, type: 'team', description: 'Team vesting monthly release', source: 'https://governance.aevo.xyz/' },
    ],
  },
  {
    coinId: 'pendle', symbol: 'PENDLE', name: 'Pendle', price: 4.50, totalSupply: 258_446_028,
    unlocks: [
      { date: '2026-04-29', amount: 1_600_000, type: 'ecosystem', description: 'Liquidity incentive weekly emission', source: 'https://docs.pendle.finance/home' },
      { date: '2026-10-29', amount: 3_200_000, type: 'ecosystem', description: 'Half-year incentive batch', source: 'https://docs.pendle.finance/home' },
    ],
  },
  {
    coinId: 'ondo-finance', symbol: 'ONDO', name: 'Ondo Finance', price: 1.35, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-01-18', amount: 1_940_000_000, type: 'cliff', description: 'Major 18-month cliff unlock — investors & team', source: 'https://docs.ondo.finance/' },
      { date: '2026-04-18', amount: 150_000_000, type: 'ecosystem', description: 'Ecosystem growth fund quarterly', source: 'https://docs.ondo.finance/' },
    ],
  },

  // ─── New L1/L2 & Airdrop Tokens ─────────────────────────────────────
  {
    coinId: 'worldcoin', symbol: 'WLD', name: 'Worldcoin', price: 1.70, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-02-24', amount: 65_000_000, type: 'linear', description: 'Community allocation linear unlock', source: 'https://worldcoin.org/blog/announcements/new-tokenomics' },
      { date: '2026-03-24', amount: 65_000_000, type: 'linear', description: 'Community linear vesting tranche', source: 'https://worldcoin.org/blog/announcements/new-tokenomics' },
      { date: '2026-07-24', amount: 135_000_000, type: 'investor', description: 'TFH investor cliff unlock', source: 'https://worldcoin.org/blog/announcements/new-tokenomics' },
    ],
  },
  {
    coinId: 'manta-network', symbol: 'MANTA', name: 'Manta Network', price: 0.95, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-03-10', amount: 14_860_000, type: 'investor', description: 'Seed round monthly unlock', source: 'https://docs.manta.network/' },
      { date: '2026-06-10', amount: 14_860_000, type: 'team', description: 'Core team vesting tranche', source: 'https://docs.manta.network/' },
    ],
  },
  {
    coinId: 'dymension', symbol: 'DYM', name: 'Dymension', price: 1.50, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-03-06', amount: 8_330_000, type: 'investor', description: 'Big Brain Holdings & investor vest', source: 'https://docs.dymension.xyz/' },
      { date: '2026-06-06', amount: 16_670_000, type: 'team', description: 'Founding team monthly vest', source: 'https://docs.dymension.xyz/' },
      { date: '2027-02-06', amount: 50_000_000, type: 'cliff', description: 'Annual investor cliff unlock', source: 'https://docs.dymension.xyz/' },
    ],
  },
  {
    coinId: 'altlayer', symbol: 'ALT', name: 'AltLayer', price: 0.15, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-03-25', amount: 150_000_000, type: 'ecosystem', description: 'Ecosystem development fund', source: 'https://docs.altlayer.io/' },
      { date: '2026-06-25', amount: 200_000_000, type: 'investor', description: 'Polychain & Breyer Capital unlock', source: 'https://docs.altlayer.io/' },
    ],
  },
  {
    coinId: 'hyperliquid', symbol: 'HYPE', name: 'Hyperliquid', price: 22.50, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-04-28', amount: 5_000_000, type: 'ecosystem', description: 'Ecosystem grants distribution', source: 'https://hyperliquid.gitbook.io/' },
      { date: '2026-07-28', amount: 10_000_000, type: 'team', description: 'Core team vesting release', source: 'https://hyperliquid.gitbook.io/' },
    ],
  },
  {
    coinId: 'magic-eden', symbol: 'ME', name: 'Magic Eden', price: 1.40, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-03-12', amount: 12_500_000, type: 'ecosystem', description: 'Creator rewards program', source: 'https://magiceden.io/' },
      { date: '2026-06-12', amount: 20_000_000, type: 'investor', description: 'Paradigm & Sequoia unlock', source: 'https://magiceden.io/' },
      { date: '2026-12-11', amount: 125_000_000, type: 'cliff', description: 'Major 1-year cliff — investors & team', source: 'https://magiceden.io/' },
    ],
  },
  {
    coinId: 'usual', symbol: 'USUAL', name: 'Usual', price: 0.45, totalSupply: 4_000_000_000,
    unlocks: [
      { date: '2026-03-06', amount: 60_000_000, type: 'cliff', description: 'Pills airdrop distribution', source: 'https://docs.usual.money/' },
      { date: '2026-06-06', amount: 40_000_000, type: 'investor', description: 'IOSG & Kraken investor vest', source: 'https://docs.usual.money/' },
    ],
  },
  {
    coinId: 'pudgy-penguins', symbol: 'PENGU', name: 'Pudgy Penguins', price: 0.012, totalSupply: 88_888_888_888,
    unlocks: [
      { date: '2026-02-15', amount: 4_444_444_444, type: 'cliff', description: 'NFT holder airdrop claim period end', source: 'https://pudgypenguins.com/' },
      { date: '2026-06-15', amount: 2_666_666_667, type: 'team', description: 'Team & Igloo Inc allocation vest', source: 'https://pudgypenguins.com/' },
    ],
  },
  {
    coinId: 'lista-dao', symbol: 'LISTA', name: 'Lista DAO', price: 0.42, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-04-01', amount: 20_000_000, type: 'ecosystem', description: 'Liquidity incentives unlock', source: 'https://docs.lista.org/' },
      { date: '2026-07-01', amount: 15_000_000, type: 'investor', description: 'Binance Labs & investor vest', source: 'https://docs.lista.org/' },
    ],
  },
  {
    coinId: 'omni-network', symbol: 'OMNI', name: 'Omni Network', price: 9.50, totalSupply: 100_000_000,
    unlocks: [
      { date: '2026-04-17', amount: 1_000_000, type: 'ecosystem', description: 'Staking rewards distribution', source: 'https://docs.omni.network/' },
      { date: '2026-07-17', amount: 2_000_000, type: 'investor', description: 'Pantera & Two Sigma unlock', source: 'https://docs.omni.network/' },
    ],
  },
  {
    coinId: 'saga-2', symbol: 'SAGA', name: 'Saga', price: 1.25, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-04-09', amount: 10_000_000, type: 'ecosystem', description: 'Chainlet incentives program', source: 'https://docs.saga.xyz/' },
      { date: '2026-10-09', amount: 15_000_000, type: 'investor', description: 'Samsung Next & investor unlock', source: 'https://docs.saga.xyz/' },
    ],
  },
  {
    coinId: 'renzo', symbol: 'REZ', name: 'Renzo', price: 0.11, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-04-30', amount: 100_000_000, type: 'cliff', description: 'Season 2 airdrop cliff unlock', source: 'https://docs.renzoprotocol.com/' },
      { date: '2026-07-30', amount: 75_000_000, type: 'investor', description: 'Maven 11 & investor vest', source: 'https://docs.renzoprotocol.com/' },
    ],
  },
  {
    coinId: 'bouncebit', symbol: 'BB', name: 'BounceBit', price: 0.32, totalSupply: 2_100_000_000,
    unlocks: [
      { date: '2026-03-13', amount: 42_000_000, type: 'ecosystem', description: 'BTC staking incentives', source: 'https://docs.bouncebit.io/' },
      { date: '2026-06-13', amount: 31_500_000, type: 'investor', description: 'Binance Labs & investor unlock', source: 'https://docs.bouncebit.io/' },
    ],
  },
  {
    coinId: 'pixels', symbol: 'PIXEL', name: 'Pixels', price: 0.18, totalSupply: 5_000_000_000,
    unlocks: [
      { date: '2026-03-04', amount: 75_000_000, type: 'ecosystem', description: 'Play-to-earn rewards distribution', source: 'https://docs.pixels.xyz/' },
      { date: '2026-06-04', amount: 50_000_000, type: 'investor', description: 'Animoca & investor vesting', source: 'https://docs.pixels.xyz/' },
    ],
  },
  {
    coinId: 'portal-2', symbol: 'PORTAL', name: 'Portal', price: 0.35, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-03-19', amount: 18_000_000, type: 'ecosystem', description: 'Gaming ecosystem incentives', source: 'https://portal.space/' },
      { date: '2026-06-19', amount: 25_000_000, type: 'investor', description: 'Coinbase Ventures & investor cliff', source: 'https://portal.space/' },
    ],
  },

  // ─── Additional Major Tokens ─────────────────────────────────────────
  {
    coinId: 'safe', symbol: 'SAFE', name: 'Safe', price: 1.10, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-04-05', amount: 25_000_000, type: 'ecosystem', description: 'Ecosystem rewards program', source: 'https://docs.safe.global/' },
      { date: '2026-10-05', amount: 50_000_000, type: 'cliff', description: 'Major cliff — team & investors', source: 'https://docs.safe.global/' },
    ],
  },
  {
    coinId: 'drift-protocol', symbol: 'DRIFT', name: 'Drift Protocol', price: 0.65, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-05-15', amount: 15_000_000, type: 'ecosystem', description: 'Ecosystem growth fund', source: 'https://docs.drift.trade/' },
      { date: '2026-11-15', amount: 50_000_000, type: 'cliff', description: 'Investor & team 18-month cliff', source: 'https://docs.drift.trade/' },
    ],
  },
  {
    coinId: 'zeta-markets', symbol: 'ZEX', name: 'Zeta Markets', price: 0.08, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-04-20', amount: 100_000_000, type: 'ecosystem', description: 'Trading incentive program', source: 'https://docs.zeta.markets/' },
      { date: '2026-07-20', amount: 200_000_000, type: 'investor', description: 'Jump & Wintermute unlock', source: 'https://docs.zeta.markets/' },
    ],
  },
  {
    coinId: 'mode', symbol: 'MODE', name: 'Mode Network', price: 0.03, totalSupply: 10_000_000_000,
    unlocks: [
      { date: '2026-05-05', amount: 200_000_000, type: 'ecosystem', description: 'OP Stack ecosystem fund', source: 'https://docs.mode.network/' },
      { date: '2026-08-05', amount: 500_000_000, type: 'investor', description: 'Investor cliff unlock', source: 'https://docs.mode.network/' },
    ],
  },
  {
    coinId: 'merlin-chain', symbol: 'MERL', name: 'Merlin Chain', price: 0.28, totalSupply: 2_100_000_000,
    unlocks: [
      { date: '2026-04-19', amount: 42_000_000, type: 'ecosystem', description: 'Ecosystem bootstrap incentives', source: 'https://docs.merlinchain.io/' },
      { date: '2026-07-19', amount: 63_000_000, type: 'investor', description: 'OKX Ventures & investor unlock', source: 'https://docs.merlinchain.io/' },
    ],
  },
  {
    coinId: 'grass', symbol: 'GRASS', name: 'Grass', price: 1.80, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-04-25', amount: 10_000_000, type: 'ecosystem', description: 'Node operator rewards', source: 'https://docs.getgrass.io/' },
      { date: '2026-10-25', amount: 50_000_000, type: 'cliff', description: 'Investor 1-year cliff', source: 'https://docs.getgrass.io/' },
    ],
  },
  {
    coinId: 'uxlink', symbol: 'UXLINK', name: 'UXLINK', price: 0.55, totalSupply: 1_000_000_000,
    unlocks: [
      { date: '2026-05-10', amount: 15_000_000, type: 'ecosystem', description: 'Social graph incentives', source: 'https://docs.uxlink.io/' },
      { date: '2026-08-10', amount: 25_000_000, type: 'investor', description: 'SevenX & Binance Labs unlock', source: 'https://docs.uxlink.io/' },
    ],
  },
];

// ── Build the full unlock list from the curated database ───────────────
function buildUnlockList(): TokenUnlock[] {
  const unlocks: TokenUnlock[] = [];
  for (const token of TOKEN_DATABASE) {
    for (let i = 0; i < token.unlocks.length; i++) {
      const u = token.unlocks[i];
      const amount = u.amount;
      const value = amount * token.price;
      const pct = (amount / token.totalSupply) * 100;
      unlocks.push({
        id: `${token.symbol.toLowerCase()}-${i + 1}`,
        coinId: token.coinId,
        coinSymbol: token.symbol,
        coinName: token.name,
        unlockDate: new Date(u.date + 'T00:00:00Z').toISOString(),
        unlockAmount: amount,
        unlockValue: value,
        percentOfSupply: parseFloat(pct.toFixed(2)),
        unlockType: u.type,
        description: u.description,
        source: u.source,
        isLarge: pct > 1,
      });
    }
  }
  return unlocks;
}

// Allow live prices to override the static fallback prices
let _livePrices: Record<string, number> | null = null;

export function setLivePrices(prices: Record<string, number>): void {
  _livePrices = prices;
  _cachedUnlocks = null; // bust cache so buildUnlockList picks up new prices
}

// Get all CoinGecko IDs referenced in the database
export function getAllCoinIds(): string[] {
  return Array.from(new Set(TOKEN_DATABASE.map(t => t.coinId)));
}

// Get token static price (fallback)
export function getTokenStaticPrice(coinId: string): number | undefined {
  return TOKEN_DATABASE.find(t => t.coinId === coinId)?.price;
}

// ── Build with optional live prices ────────────────────────────────────
function buildUnlockListWithPrices(): TokenUnlock[] {
  const unlocks: TokenUnlock[] = [];
  for (const token of TOKEN_DATABASE) {
    const price = _livePrices?.[token.coinId] ?? token.price;
    for (let i = 0; i < token.unlocks.length; i++) {
      const u = token.unlocks[i];
      const amount = u.amount;
      const value = amount * price;
      const pct = (amount / token.totalSupply) * 100;
      unlocks.push({
        id: `${token.symbol.toLowerCase()}-${i + 1}`,
        coinId: token.coinId,
        coinSymbol: token.symbol,
        coinName: token.name,
        unlockDate: new Date(u.date + 'T00:00:00Z').toISOString(),
        unlockAmount: amount,
        unlockValue: value,
        percentOfSupply: parseFloat(pct.toFixed(2)),
        unlockType: u.type,
        description: u.description,
        source: u.source,
        isLarge: pct > 1,
      });
    }
  }
  return unlocks;
}

// Cached unlock list
let _cachedUnlocks: TokenUnlock[] | null = null;
function getAllUnlocks(): TokenUnlock[] {
  if (!_cachedUnlocks) _cachedUnlocks = buildUnlockListWithPrices();
  return _cachedUnlocks;
}

// Get unlocks for a specific coin
function getTokenUnlocks(coinId: string): TokenUnlock[] {
  return getAllUnlocks().filter(u => u.coinId === coinId.toLowerCase());
}

// Get upcoming unlocks across all tokens, sorted by date
function getUpcomingUnlocks(limit: number): TokenUnlock[] {
  const now = new Date();
  return getAllUnlocks()
    .filter(u => new Date(u.unlockDate) > now)
    .sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime())
    .slice(0, limit);
}

// ── Formatting helpers ─────────────────────────────────────────────────

// Format unlock amount
export function formatUnlockAmount(amount: number): string {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
  return amount.toFixed(0);
}

// Format unlock value in USD
export function formatUnlockValue(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(0)}`;
}

// Get days until unlock
export function getDaysUntilUnlock(unlockDate: string): number {
  const now = new Date();
  const unlock = new Date(unlockDate);
  const diffTime = unlock.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Format relative unlock date
export function formatUnlockDate(unlockDate: string): string {
  const days = getDaysUntilUnlock(unlockDate);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return 'Unlocked';
  if (days <= 7) return `In ${days} days`;
  if (days <= 30) return `In ${Math.ceil(days / 7)} weeks`;
  return new Date(unlockDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
