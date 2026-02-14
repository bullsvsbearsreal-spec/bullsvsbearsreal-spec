// Token Unlocks data integration
// Provides vesting schedule and unlock information for top cryptocurrencies

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

// Helper: offset days from now as ISO string
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// Curated token unlock dataset based on publicly known vesting schedules.
// Dates are generated relative to "now" so the dataset always contains a mix
// of past, imminent, and future events.
interface TokenDef {
  coinId: string;
  symbol: string;
  name: string;
  /** approximate price in USD used to compute unlockValue */
  price: number;
  /** total / max supply used to derive percentOfSupply */
  totalSupply: number;
  unlocks: {
    dayOffset: number;
    amount: number;
    type: TokenUnlock['unlockType'];
    description: string;
  }[];
}

const TOKEN_DATABASE: TokenDef[] = [
  // --- Layer 2 & Scaling ---
  { coinId: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', price: 1.15, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: -5, amount: 92_650_000, type: 'investor', description: 'Series B investor vesting release' },
    { dayOffset: 16, amount: 92_650_000, type: 'investor', description: 'Series A investor vesting release' },
    { dayOffset: 47, amount: 185_300_000, type: 'team', description: 'Core team & advisor token unlock' },
  ]},
  { coinId: 'optimism', symbol: 'OP', name: 'Optimism', price: 2.30, totalSupply: 4_294_967_296, unlocks: [
    { dayOffset: 4, amount: 31_340_000, type: 'ecosystem', description: 'Ecosystem fund quarterly distribution' },
    { dayOffset: 38, amount: 24_160_000, type: 'investor', description: 'Series A investor unlock' },
    { dayOffset: 72, amount: 46_200_000, type: 'team', description: 'Core contributor vesting cliff' },
  ]},
  { coinId: 'starknet', symbol: 'STRK', name: 'Starknet', price: 0.62, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: 8, amount: 64_000_000, type: 'investor', description: 'Early backer token unlock' },
    { dayOffset: 52, amount: 128_000_000, type: 'team', description: 'Core contributor monthly vesting' },
  ]},
  { coinId: 'zksync', symbol: 'ZK', name: 'zkSync', price: 0.19, totalSupply: 21_000_000_000, unlocks: [
    { dayOffset: 11, amount: 210_000_000, type: 'ecosystem', description: 'Ecosystem grants program release' },
    { dayOffset: 55, amount: 315_000_000, type: 'investor', description: 'Seed round investor cliff unlock' },
  ]},
  { coinId: 'blast', symbol: 'BLAST', name: 'Blast', price: 0.012, totalSupply: 100_000_000_000, unlocks: [
    { dayOffset: -3, amount: 2_000_000_000, type: 'ecosystem', description: 'Phase 2 airdrop distribution' },
    { dayOffset: 30, amount: 1_500_000_000, type: 'investor', description: 'Paradigm & Standard Crypto unlock' },
  ]},
  { coinId: 'scroll', symbol: 'SCR', name: 'Scroll', price: 0.85, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 19, amount: 10_000_000, type: 'ecosystem', description: 'Ecosystem development fund release' },
    { dayOffset: 62, amount: 25_000_000, type: 'investor', description: 'Seed investor vesting cliff' },
  ]},

  // --- Alt L1 ---
  { coinId: 'aptos', symbol: 'APT', name: 'Aptos', price: 8.50, totalSupply: 1_086_628_868, unlocks: [
    { dayOffset: 2, amount: 11_310_000, type: 'investor', description: 'FTX estate & early investor unlock' },
    { dayOffset: 33, amount: 11_310_000, type: 'team', description: 'Foundation monthly vesting' },
  ]},
  { coinId: 'sui', symbol: 'SUI', name: 'Sui', price: 3.60, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: 6, amount: 64_190_000, type: 'ecosystem', description: 'Community reserve distribution' },
    { dayOffset: 37, amount: 64_190_000, type: 'investor', description: 'Series A & B investor unlock' },
    { dayOffset: 68, amount: 128_380_000, type: 'team', description: 'Core team vesting cliff' },
  ]},
  { coinId: 'celestia', symbol: 'TIA', name: 'Celestia', price: 4.90, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 10, amount: 17_580_000, type: 'investor', description: 'Seed & Series A vesting tranche' },
    { dayOffset: 44, amount: 8_790_000, type: 'team', description: 'Core contributor monthly vest' },
  ]},
  { coinId: 'sei-network', symbol: 'SEI', name: 'Sei', price: 0.38, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: 7, amount: 125_000_000, type: 'ecosystem', description: 'Ecosystem & community incentives' },
    { dayOffset: 42, amount: 75_000_000, type: 'investor', description: 'Private sale token unlock' },
  ]},
  { coinId: 'movement', symbol: 'MOVE', name: 'Movement', price: 0.55, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: 14, amount: 50_000_000, type: 'ecosystem', description: 'Ecosystem bootstrap fund' },
    { dayOffset: 58, amount: 100_000_000, type: 'investor', description: 'Polychain & Binance Labs unlock' },
  ]},

  // --- Solana Ecosystem ---
  { coinId: 'jupiter', symbol: 'JUP', name: 'Jupiter', price: 0.82, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: -2, amount: 125_000_000, type: 'cliff', description: 'Jupuary airdrop distribution' },
    { dayOffset: 22, amount: 50_000_000, type: 'team', description: 'Core team vesting release' },
    { dayOffset: 53, amount: 75_000_000, type: 'ecosystem', description: 'Ecosystem growth fund' },
  ]},
  { coinId: 'pyth-network', symbol: 'PYTH', name: 'Pyth Network', price: 0.34, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: 12, amount: 200_000_000, type: 'ecosystem', description: 'Publisher rewards distribution' },
    { dayOffset: 43, amount: 150_000_000, type: 'investor', description: 'Strategic investor vesting' },
  ]},
  { coinId: 'wormhole', symbol: 'W', name: 'Wormhole', price: 0.28, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: 9, amount: 180_000_000, type: 'ecosystem', description: 'Guardian & protocol incentives' },
    { dayOffset: 40, amount: 120_000_000, type: 'investor', description: 'Jump Crypto & investor unlock' },
  ]},
  { coinId: 'jito', symbol: 'JTO', name: 'Jito', price: 3.20, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 15, amount: 11_310_000, type: 'investor', description: 'Framework & Multicoin unlock' },
    { dayOffset: 46, amount: 22_620_000, type: 'team', description: 'Core team monthly vest' },
  ]},
  { coinId: 'io-net', symbol: 'IO', name: 'io.net', price: 2.10, totalSupply: 800_000_000, unlocks: [
    { dayOffset: 18, amount: 8_000_000, type: 'ecosystem', description: 'Node operator rewards' },
    { dayOffset: 49, amount: 12_000_000, type: 'investor', description: 'Hack VC & a16z unlock' },
  ]},

  // --- DeFi / Infra ---
  { coinId: 'ethena', symbol: 'ENA', name: 'Ethena', price: 0.92, totalSupply: 15_000_000_000, unlocks: [
    { dayOffset: 3, amount: 225_000_000, type: 'cliff', description: 'Shard campaign season 2 airdrop' },
    { dayOffset: 35, amount: 112_500_000, type: 'investor', description: 'Dragonfly & Franklin Templeton unlock' },
  ]},
  { coinId: 'ethfi', symbol: 'ETHFI', name: 'ether.fi', price: 1.85, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 20, amount: 11_530_000, type: 'investor', description: 'Seed round investor vesting' },
    { dayOffset: 51, amount: 5_770_000, type: 'team', description: 'Core team monthly unlock' },
  ]},
  { coinId: 'eigenlayer', symbol: 'EIGEN', name: 'EigenLayer', price: 3.10, totalSupply: 1_670_000_000, unlocks: [
    { dayOffset: 5, amount: 11_690_000, type: 'ecosystem', description: 'Stakedrop season 2 distribution' },
    { dayOffset: 36, amount: 16_700_000, type: 'investor', description: 'a16z & Polychain unlock' },
    { dayOffset: 67, amount: 25_050_000, type: 'team', description: 'Core team cliff unlock' },
  ]},
  { coinId: 'layerzero', symbol: 'ZRO', name: 'LayerZero', price: 3.40, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 13, amount: 10_000_000, type: 'ecosystem', description: 'Protocol treasury release' },
    { dayOffset: 44, amount: 15_000_000, type: 'investor', description: 'a16z & Sequoia vesting tranche' },
  ]},
  { coinId: 'aevo', symbol: 'AEVO', name: 'Aevo', price: 0.72, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 17, amount: 15_000_000, type: 'investor', description: 'Paradigm investor cliff' },
    { dayOffset: 48, amount: 10_000_000, type: 'team', description: 'Team vesting monthly release' },
  ]},
  { coinId: 'lista-dao', symbol: 'LISTA', name: 'Lista DAO', price: 0.42, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 21, amount: 20_000_000, type: 'ecosystem', description: 'Liquidity incentives unlock' },
    { dayOffset: 54, amount: 15_000_000, type: 'investor', description: 'Binance Labs & investor vest' },
  ]},

  // --- New L1/L2 / Airdrop Tokens ---
  { coinId: 'worldcoin', symbol: 'WLD', name: 'Worldcoin', price: 1.70, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: -7, amount: 65_000_000, type: 'linear', description: 'Community allocation linear unlock' },
    { dayOffset: 25, amount: 65_000_000, type: 'linear', description: 'Community linear vesting tranche' },
    { dayOffset: 56, amount: 135_000_000, type: 'investor', description: 'TFH investor cliff unlock' },
  ]},
  { coinId: 'manta-network', symbol: 'MANTA', name: 'Manta Network', price: 0.95, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 10, amount: 14_860_000, type: 'investor', description: 'Seed round monthly unlock' },
    { dayOffset: 41, amount: 14_860_000, type: 'team', description: 'Core team vesting tranche' },
  ]},
  { coinId: 'dymension', symbol: 'DYM', name: 'Dymension', price: 1.50, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 8, amount: 8_330_000, type: 'investor', description: 'Big Brain Holdings & investor vest' },
    { dayOffset: 39, amount: 16_670_000, type: 'team', description: 'Founding team monthly vest' },
  ]},
  { coinId: 'altlayer', symbol: 'ALT', name: 'AltLayer', price: 0.15, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: 14, amount: 150_000_000, type: 'ecosystem', description: 'Ecosystem development fund' },
    { dayOffset: 45, amount: 200_000_000, type: 'investor', description: 'Polychain & Breyer Capital unlock' },
  ]},
  { coinId: 'pixels', symbol: 'PIXEL', name: 'Pixels', price: 0.18, totalSupply: 5_000_000_000, unlocks: [
    { dayOffset: 6, amount: 75_000_000, type: 'ecosystem', description: 'Play-to-earn rewards distribution' },
    { dayOffset: 37, amount: 50_000_000, type: 'investor', description: 'Animoca & investor vesting' },
  ]},
  { coinId: 'portal-2', symbol: 'PORTAL', name: 'Portal', price: 0.35, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 12, amount: 18_000_000, type: 'ecosystem', description: 'Gaming ecosystem incentives' },
    { dayOffset: 43, amount: 25_000_000, type: 'investor', description: 'Coinbase Ventures & investor cliff' },
  ]},
  { coinId: 'omni-network', symbol: 'OMNI', name: 'Omni Network', price: 9.50, totalSupply: 100_000_000, unlocks: [
    { dayOffset: 19, amount: 1_000_000, type: 'ecosystem', description: 'Staking rewards distribution' },
    { dayOffset: 50, amount: 2_000_000, type: 'investor', description: 'Pantera & Two Sigma unlock' },
  ]},
  { coinId: 'saga-2', symbol: 'SAGA', name: 'Saga', price: 1.25, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 16, amount: 10_000_000, type: 'ecosystem', description: 'Chainlet incentives program' },
    { dayOffset: 47, amount: 15_000_000, type: 'investor', description: 'Samsung Next & investor unlock' },
  ]},
  { coinId: 'renzo', symbol: 'REZ', name: 'Renzo', price: 0.11, totalSupply: 10_000_000_000, unlocks: [
    { dayOffset: 23, amount: 100_000_000, type: 'cliff', description: 'Season 2 airdrop cliff unlock' },
    { dayOffset: 54, amount: 75_000_000, type: 'investor', description: 'Maven 11 & investor vest' },
  ]},
  { coinId: 'bouncebit', symbol: 'BB', name: 'BounceBit', price: 0.32, totalSupply: 2_100_000_000, unlocks: [
    { dayOffset: 11, amount: 42_000_000, type: 'ecosystem', description: 'BTC staking incentives' },
    { dayOffset: 42, amount: 31_500_000, type: 'investor', description: 'Binance Labs & investor unlock' },
  ]},
  { coinId: 'hyperliquid', symbol: 'HYPE', name: 'Hyperliquid', price: 22.50, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 28, amount: 5_000_000, type: 'ecosystem', description: 'Ecosystem grants distribution' },
    { dayOffset: 60, amount: 10_000_000, type: 'team', description: 'Core team vesting release' },
  ]},
  { coinId: 'magic-eden', symbol: 'ME', name: 'Magic Eden', price: 1.40, totalSupply: 1_000_000_000, unlocks: [
    { dayOffset: 15, amount: 12_500_000, type: 'ecosystem', description: 'Creator rewards program' },
    { dayOffset: 46, amount: 20_000_000, type: 'investor', description: 'Paradigm & Sequoia unlock' },
  ]},
  { coinId: 'usual', symbol: 'USUAL', name: 'Usual', price: 0.45, totalSupply: 4_000_000_000, unlocks: [
    { dayOffset: 9, amount: 60_000_000, type: 'cliff', description: 'Pills airdrop distribution' },
    { dayOffset: 40, amount: 40_000_000, type: 'investor', description: 'IOSG & Kraken investor vest' },
  ]},
  { coinId: 'pudgy-penguins', symbol: 'PENGU', name: 'Pudgy Penguins', price: 0.012, totalSupply: 88_888_888_888, unlocks: [
    { dayOffset: -4, amount: 4_444_444_444, type: 'cliff', description: 'NFT holder airdrop claim period' },
    { dayOffset: 32, amount: 2_666_666_667, type: 'team', description: 'Team & Igloo Inc allocation vest' },
  ]},
];

// Build the full unlock list from the curated database
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
        unlockDate: daysFromNow(u.dayOffset),
        unlockAmount: amount,
        unlockValue: value,
        percentOfSupply: parseFloat(pct.toFixed(2)),
        unlockType: u.type,
        description: u.description,
        isLarge: pct > 1,
      });
    }
  }
  return unlocks;
}

// Cached unlock list (rebuilt on each server invocation / client load)
let _cachedUnlocks: TokenUnlock[] | null = null;
function getAllUnlocks(): TokenUnlock[] {
  if (!_cachedUnlocks) _cachedUnlocks = buildUnlockList();
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
